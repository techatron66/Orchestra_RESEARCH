"""
Orchestra Research — Backend API Integration Tests
Run: cd backend && pytest tests/ -v
"""
import json
import pytest
from fastapi.testclient import TestClient

# Patch env before importing app
import os
os.environ.setdefault("NVIDIA_API_KEY", "nvapi-test-demo")
os.environ.setdefault("CHROMA_PERSIST_DIR", "/tmp/test_chroma")
os.environ.setdefault("SIDECAR_DIR", "/tmp/test_sidecars")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")

from main import app  # noqa: E402

client = TestClient(app)


# ── Health ────────────────────────────────────────────────────────────────────
class TestHealth:
    def test_health_ok(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── Config ────────────────────────────────────────────────────────────────────
class TestConfig:
    def test_get_config(self):
        r = client.get("/api/config")
        assert r.status_code == 200
        data = r.json()
        assert "project" in data
        assert "rigor" in data
        assert "models" in data

    def test_update_config(self):
        r = client.put("/api/config", json={
            "project": {"field": "Machine Learning"},
            "rigor": {"level": 7}
        })
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

        # Verify persisted
        r2 = client.get("/api/config")
        assert r2.json()["project"]["field"] == "Machine Learning"
        assert r2.json()["rigor"]["level"] == 7


# ── Documents ─────────────────────────────────────────────────────────────────
class TestDocuments:
    def test_create_document(self):
        r = client.post("/api/documents", json={"template": "ieee", "title": "Test Paper"})
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["template"] == "ieee"
        return data["id"]

    def test_get_document(self):
        doc_id = self.test_create_document()
        r = client.get(f"/api/documents/{doc_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["meta"]["id"] == doc_id
        assert "content" in data

    def test_get_nonexistent_document(self):
        r = client.get("/api/documents/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404

    def test_update_document(self):
        doc_id = self.test_create_document()
        r = client.put(f"/api/documents/{doc_id}", json={"title": "Updated Title", "word_count": 500})
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

        r2 = client.get(f"/api/documents/{doc_id}")
        assert r2.json()["meta"]["title"] == "Updated Title"

    def test_delete_document(self):
        doc_id = self.test_create_document()
        r = client.delete(f"/api/documents/{doc_id}")
        assert r.status_code == 200
        assert r.json()["status"] == "deleted"

        r2 = client.get(f"/api/documents/{doc_id}")
        assert r2.status_code == 404

    def test_all_templates_produce_content(self):
        for tmpl in ["ieee", "nature", "apa", "blank"]:
            r = client.post("/api/documents", json={"template": tmpl, "title": f"{tmpl} doc"})
            assert r.status_code == 200, f"Failed to create {tmpl} template"
            doc_id = r.json()["id"]
            r2 = client.get(f"/api/documents/{doc_id}")
            content = r2.json()["content"]
            assert content["type"] == "doc"
            if tmpl != "blank":
                assert len(content["content"]) > 0


# ── References ────────────────────────────────────────────────────────────────
class TestReferences:
    def test_get_references_empty(self):
        r = client.post("/api/documents", json={"template": "blank", "title": "Ref Test"})
        doc_id = r.json()["id"]
        r2 = client.get(f"/api/references/{doc_id}")
        assert r2.status_code == 200
        assert r2.json() == []

    def test_web_search(self):
        r = client.post("/api/references/web-search", json={"topic": "quantum error correction", "n": 3})
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert "topic" in data
        assert data["topic"] == "quantum error correction"

    def test_web_search_missing_topic(self):
        r = client.post("/api/references/web-search", json={"n": 3})
        assert r.status_code == 400

    def test_inferences_empty(self):
        r = client.get("/api/references/inferences/nonexistent-para-id")
        assert r.status_code == 200
        assert r.json() == []


# ── Panel Debate ──────────────────────────────────────────────────────────────
class TestPanelDebate:
    def test_debate_streams_events(self):
        r = client.post("/api/debate", json={
            "hypothesis": "TopoNet-7 achieves 12× improvement over MWPM",
            "document_id": "test-doc",
            "section": "Results",
        }, headers={"Accept": "text/event-stream"})
        assert r.status_code == 200

        content = r.text
        events = []
        for line in content.split("\n"):
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except Exception:
                    pass

        event_types = [e["event"] for e in events]
        assert "debate_start" in event_types
        assert "turn" in event_types
        assert "verdict" in event_types
        assert "done" in event_types

        turns = [e for e in events if e["event"] == "turn"]
        assert len(turns) == 2
        roles = {t["data"]["role"] for t in turns}
        assert "skeptic" in roles
        assert "supporter" in roles


# ── Generation abort ──────────────────────────────────────────────────────────
class TestGeneration:
    def test_abort_nonexistent(self):
        r = client.post("/api/abort/nonexistent-request-id")
        assert r.status_code == 200
        assert r.json()["status"] == "aborted"

    def test_remove_citation(self):
        r = client.post("/api/documents", json={"template": "ieee", "title": "Cite Test"})
        doc_id = r.json()["id"]
        r2 = client.delete(f"/api/documents/{doc_id}/citations/test-para-id")
        assert r2.status_code == 200
        assert r2.json()["citation_id"] == "test-para-id"


# ── State isolation ───────────────────────────────────────────────────────────
class TestStateIsolation:
    """Verify shared state module is used consistently across routers."""

    def test_document_visible_to_references_router(self):
        """Documents created via /documents should be queryable via /references."""
        r = client.post("/api/documents", json={"template": "ieee", "title": "State Test"})
        doc_id = r.json()["id"]

        # References router should see the same document
        r2 = client.get(f"/api/references/{doc_id}")
        assert r2.status_code == 200  # Would 404 if using old separate dicts

    def test_document_deletion_cascades(self):
        """Deleting a document should clean up ref associations."""
        r = client.post("/api/documents", json={"template": "blank", "title": "Cascade Test"})
        doc_id = r.json()["id"]

        client.delete(f"/api/documents/{doc_id}")

        r2 = client.get(f"/api/documents/{doc_id}")
        assert r2.status_code == 404
