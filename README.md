# Orchestra Research

> Production-grade, Apple Pages-inspired research authoring with a multi-agent NVIDIA NIM backend.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRA RESEARCH                              │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────────────────────────────────┐   │
│  │   GALLERY    │    │              EDITOR SHELL                   │   │
│  │              │    │  ┌─────────┐  ┌──────────────┐  ┌────────┐ │   │
│  │ IEEE / Nature│───▶│  │ Outline │  │  Page Canvas │  │  AI    │ │   │
│  │ APA / Blank  │    │  │ Nav     │  │  (Tiptap)    │  │Sidebar │ │   │
│  └──────────────┘    │  └─────────┘  └──────────────┘  └────────┘ │   │
│                       └─────────────────────────────────────────────┘   │
│                                         │                               │
│                           FASTAPI BACKEND (port 8000)                  │
│                                         │                               │
│  ┌──────────────────────────────────────┼──────────────────────────┐   │
│  │              LANGGRAPH ORCHESTRATOR  │                          │   │
│  │                                      ▼                          │   │
│  │  load_config ──▶ rag_retrieval ──▶ route_mention               │   │
│  │       │                │                  │                     │   │
│  │       │         ChromaDB Query     @Flux / @DeepSeek / @Qwen    │   │
│  │       ▼                                   │                     │   │
│  │  lead_synthesis (kimi-k2.5)               ▼                     │   │
│  │       │                         flux_generation                 │   │
│  │       ▼                         deepseek_audit                  │   │
│  │  glm_enrichment (z-ai/glm-5)    qwen_logic_check                │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  deepseek_audit ──▶ qwen_logic_check ──▶ assemble_output        │   │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐   ┌────────────────┐   ┌──────────────────────┐  │
│  │   ChromaDB      │   │    Sidecars    │   │   NVIDIA NIM APIs    │  │
│  │  Vector Store   │   │  (JSON files)  │   │  kimi-k2.5 / glm-5   │  │
│  │  all-MiniLM-L6  │   │  Inference     │   │  deepseek-v3.2       │  │
│  │  512-tok chunks │   │  Tracking      │   │  qwen3.5 / flux.2    │  │
│  └─────────────────┘   └────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Python 3.11+
- Node.js 20+ (for Next.js frontend) — or open `frontend/index.html` directly
- NVIDIA NIM API key (get at [build.nvidia.com](https://build.nvidia.com))
- Serper API key (optional, for web search)

## Setup

### 1. Clone & configure

```bash
git clone <repo>
cd orchestra-research

cp backend/.env.example backend/.env
# Edit backend/.env:
# NVIDIA_API_KEY=nvapi-your-key-here
# SERPER_API_KEY=your-serper-key (optional)
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO: directory_ready path=uploads
INFO: directory_ready path=sidecars
INFO: directory_ready path=chroma_db
INFO: orchestra_research_started env=development
INFO: Application startup complete.
```

### 3. Frontend

**Option A — Direct open (no Node.js required):**
```bash
open frontend/index.html
# or: python3 -m http.server 3000 --directory frontend
```

**Option B — Next.js (full production setup):**
```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:3000
```

## Smoke Tests

```bash
# Health check
curl http://localhost:8000/api/health

# Read config
curl http://localhost:8000/api/config | python3 -m json.tool

# Create a document
curl -X POST http://localhost:8000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"template":"ieee","title":"My Paper"}' | python3 -m json.tool

# Web search
curl -X POST http://localhost:8000/api/references/web-search \
  -H "Content-Type: application/json" \
  -d '{"topic":"quantum error correction","n":3}'
```

## Key Features

| Feature | Description |
|---|---|
| **Multi-agent Orchestration** | kimi-k2.5 (synthesis) → glm-5 (enrichment) → deepseek-v3.2 (audit) → qwen3.5 (logic) |
| **Live SSE Streaming** | Tokens streamed to frontend; abort at any point via `/api/abort/{id}` |
| **RAG Pipeline** | PDF/DOCX → pypdf/python-docx → tiktoken chunking → MiniLM embeddings → ChromaDB |
| **Sidecar Tracking** | Every verified claim tracked in JSON sidecars; unverified on paragraph deletion |
| **Ghost Drafts** | AI output shown as dashed-border ghost text; Accept (Cmd+Enter) or Reject (Cmd+Backspace) |
| **Scrutiny View** | Color-heatmap overlay: blue=original, green=RAG-verified, red=needs review |
| **Pivot Dialog** | Stop generation mid-stream: keep partial, discard, or switch NIM model |
| **Figure Generation** | @Flux mention routes to flux.2-klein-4b for scientific diagram generation |
| **Instruction Ledger** | `config.json` controls journal, citation standard, tone, rigor — read on every invocation |

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/config` | GET/PUT | Read/write Instruction Ledger |
| `/api/documents` | POST | Create document |
| `/api/documents/{id}` | GET/PUT/DELETE | Document CRUD |
| `/api/documents/{id}/upload` | POST | Upload PDF/DOCX for RAG |
| `/api/documents/{id}/references/status/{job_id}` | GET | Poll ingest job |
| `/api/generate` | POST | SSE generation stream |
| `/api/abort/{request_id}` | POST | Abort running generation |
| `/api/references/{doc_id}` | GET | List references for document |
| `/api/references/{ref_id}/source/{chunk_idx}` | GET | Get verbatim source chunk |
| `/api/references/web-search` | POST | Search related papers |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM API key |
| `NVIDIA_BASE_URL` | No | Default: `https://integrate.api.nvidia.com/v1` |
| `SERPER_API_KEY` | No | For web search; falls back to mock results |
| `CHROMA_PERSIST_DIR` | No | Default: `./chroma_db` |
| `SIDECAR_DIR` | No | Default: `./sidecars` |
| `UPLOAD_DIR` | No | Default: `./uploads` |
| `CORS_ORIGINS` | No | Default: `http://localhost:3000` |

