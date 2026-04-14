# Orchestra Research — Makefile
# Usage: make <target>

.PHONY: help install dev dev-backend dev-frontend build lint test clean \
        docker-up docker-down db-reset ingest-example check-env

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[0;32m
CYAN  := \033[0;36m
RED   := \033[0;31m

help: ## Show this help
	@echo "$(BOLD)Orchestra Research$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Environment ───────────────────────────────────────────────────────────────
check-env: ## Verify required env vars are set
	@echo "$(BOLD)Checking environment...$(RESET)"
	@[ -f backend/.env ] || (echo "$(RED)✗ backend/.env missing — copy from backend/.env.example$(RESET)" && exit 1)
	@grep -q "NVIDIA_API_KEY=nvapi-" backend/.env 2>/dev/null \
		|| echo "$(RED)⚠  NVIDIA_API_KEY not set in backend/.env$(RESET)"
	@echo "$(GREEN)✓ Environment OK$(RESET)"

# ── Install ───────────────────────────────────────────────────────────────────
install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python dependencies
	@echo "$(BOLD)Installing backend dependencies...$(RESET)"
	cd backend && python3 -m venv .venv && \
		. .venv/bin/activate && \
		pip install --upgrade pip -q && \
		pip install -r requirements.txt -q
	@echo "$(GREEN)✓ Backend dependencies installed$(RESET)"

install-frontend: ## Install Node.js dependencies
	@echo "$(BOLD)Installing frontend dependencies...$(RESET)"
	cd frontend && npm install --silent
	@echo "$(GREEN)✓ Frontend dependencies installed$(RESET)"

# ── Development ───────────────────────────────────────────────────────────────
dev: ## Start both backend and frontend in parallel
	@echo "$(BOLD)Starting Orchestra Research dev servers...$(RESET)"
	@echo "  Backend : http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Docs    : http://localhost:8000/docs"
	@echo ""
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Start FastAPI backend (hot reload)
	cd backend && . .venv/bin/activate && \
		uvicorn main:app --reload --port 8000 --log-level info

dev-frontend: ## Start Next.js frontend
	cd frontend && npm run dev

# ── Standalone ────────────────────────────────────────────────────────────────
standalone: ## Open the standalone HTML (no backend needed)
	@echo "$(BOLD)Opening standalone frontend...$(RESET)"
	@open frontend/orchestra-research-standalone.html 2>/dev/null || \
		xdg-open frontend/orchestra-research-standalone.html 2>/dev/null || \
		echo "Open frontend/orchestra-research-standalone.html in your browser"

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build the Next.js frontend for production
	cd frontend && npm run build

# ── Lint / Format ─────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python with ruff + type-check with pyright
	@echo "$(BOLD)Linting backend...$(RESET)"
	cd backend && . .venv/bin/activate && \
		python3 -c "import ast, os; \
		[print(f'✓ {f}') if ast.parse(open(f).read()) else None \
		 for f in (os.path.join(r,fn) for r,_,fs in os.walk('.') \
		 for fn in fs if fn.endswith('.py') and '.venv' not in r)]"
	@echo "$(GREEN)✓ Backend syntax OK$(RESET)"

lint-frontend: ## Lint TypeScript with ESLint
	cd frontend && npm run lint --silent 2>/dev/null || \
		echo "$(CYAN)ℹ  Run: cd frontend && npm run lint$(RESET)"

format-backend: ## Format Python with black
	cd backend && . .venv/bin/activate && \
		pip install black -q && black . --exclude .venv

# ── Tests ─────────────────────────────────────────────────────────────────────
test: test-backend ## Run all tests

test-backend: ## Run backend unit tests
	@echo "$(BOLD)Running backend tests...$(RESET)"
	cd backend && . .venv/bin/activate && \
		python3 -m pytest tests/ -v 2>/dev/null || \
		echo "$(CYAN)ℹ  No tests directory found — create backend/tests/ to add tests$(RESET)"

# ── Smoke tests ───────────────────────────────────────────────────────────────
smoke: ## Run API smoke tests against running backend
	@echo "$(BOLD)Running smoke tests...$(RESET)"
	@curl -sf http://localhost:8000/api/health | python3 -m json.tool \
		&& echo "$(GREEN)✓ Health check passed$(RESET)" \
		|| echo "$(RED)✗ Backend not running — start with: make dev-backend$(RESET)"
	@curl -sf http://localhost:8000/api/config | python3 -m json.tool > /dev/null \
		&& echo "$(GREEN)✓ Config endpoint OK$(RESET)"
	@DOC_ID=$$(curl -sf -X POST http://localhost:8000/api/documents \
		-H "Content-Type: application/json" \
		-d '{"template":"ieee","title":"Smoke Test"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])") && \
		echo "$(GREEN)✓ Document created: $$DOC_ID$(RESET)"

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up: ## Start services with docker-compose
	docker-compose up --build -d
	@echo "$(GREEN)✓ Services running$(RESET)"
	@echo "  Backend : http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"

docker-down: ## Stop docker-compose services
	docker-compose down

docker-logs: ## Tail docker-compose logs
	docker-compose logs -f

# ── Data ──────────────────────────────────────────────────────────────────────
db-reset: ## Delete ChromaDB, sidecars, and uploads
	@echo "$(RED)This will delete all indexed documents and uploads.$(RESET)"
	@read -p "Continue? [y/N] " yn; [ "$$yn" = "y" ] || exit 0
	rm -rf backend/chroma_db backend/sidecars backend/uploads
	@echo "$(GREEN)✓ Data directories cleared$(RESET)"

ingest-example: ## Ingest an example PDF via the API
	@echo "$(BOLD)Ingesting example document...$(RESET)"
	@[ -n "$(DOC_ID)" ] || (echo "$(RED)Set DOC_ID: make ingest-example DOC_ID=<uuid>$(RESET)" && exit 1)
	@[ -f "$(FILE)" ] || (echo "$(RED)Set FILE: make ingest-example DOC_ID=... FILE=path/to/paper.pdf$(RESET)" && exit 1)
	curl -X POST http://localhost:8000/api/documents/$(DOC_ID)/upload \
		-F "file=@$(FILE)" | python3 -m json.tool

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Remove build artifacts, caches, venv
	rm -rf backend/.venv backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/.next frontend/node_modules
	rm -rf backend/chroma_db backend/sidecars backend/uploads backend/static
	find . -name "*.pyc" -delete
	find . -name ".DS_Store" -delete
	@echo "$(GREEN)✓ Clean$(RESET)"
