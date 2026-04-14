"""
Vector store wrapper around ChromaDB.
All queries run in asyncio.to_thread() to avoid blocking the FastAPI event loop.
"""
import asyncio
import os
from typing import Optional
import structlog

logger = structlog.get_logger()

_client = None
_embedding_fn = None


def _get_client():
    global _client
    if _client is None:
        import chromadb
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        _client = chromadb.PersistentClient(path=persist_dir)
    return _client


def _get_embedding_fn():
    global _embedding_fn
    if _embedding_fn is None:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        _embedding_fn = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    return _embedding_fn


def _sync_upsert(collection_name: str, documents: list[str], metadatas: list[dict], ids: list[str]):
    client = _get_client()
    ef = _get_embedding_fn()
    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )
    collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
    return len(documents)


def _sync_query(collection_names: list[str], query_text: str, top_k: int = 8) -> list[dict]:
    client = _get_client()
    ef = _get_embedding_fn()
    results = []
    for name in collection_names:
        try:
            collection = client.get_collection(name=name, embedding_function=ef)
            res = collection.query(
                query_texts=[query_text],
                n_results=min(top_k, collection.count()),
                include=["documents", "metadatas", "distances"]
            )
            for i, doc in enumerate(res["documents"][0]):
                results.append({
                    "text": doc,
                    "metadata": res["metadatas"][0][i],
                    "distance": res["distances"][0][i],
                    "collection": name,
                })
        except Exception as e:
            logger.warning("chroma_query_failed", collection=name, error=str(e))
    results.sort(key=lambda x: x["distance"])
    return results[:top_k]


def _sync_get_chunk(collection_name: str, chunk_index: int) -> Optional[str]:
    client = _get_client()
    ef = _get_embedding_fn()
    try:
        collection = client.get_collection(name=collection_name, embedding_function=ef)
        res = collection.get(
            where={"chunk_index": chunk_index},
            include=["documents"]
        )
        if res["documents"]:
            return res["documents"][0]
    except Exception as e:
        logger.warning("chroma_get_chunk_failed", error=str(e))
    return None


def _sync_delete_collection(collection_name: str):
    client = _get_client()
    try:
        client.delete_collection(name=collection_name)
    except Exception as e:
        logger.warning("chroma_delete_failed", collection=collection_name, error=str(e))


async def upsert_chunks(doc_id: str, documents: list[str], metadatas: list[dict], ids: list[str]) -> int:
    """Upsert chunks into ChromaDB for a document."""
    collection_name = f"doc_{doc_id.replace('-', '_')}"
    return await asyncio.to_thread(_sync_upsert, collection_name, documents, metadatas, ids)


async def query(query_text: str, doc_ids: list[str], top_k: int = 8) -> list[dict]:
    """Query across all specified document collections. Returns chunks with source metadata."""
    collection_names = [f"doc_{did.replace('-', '_')}" for did in doc_ids]
    return await asyncio.to_thread(_sync_query, collection_names, query_text, top_k)


async def get_chunk(doc_id: str, chunk_index: int) -> Optional[str]:
    """Retrieve exact chunk text for citation display."""
    collection_name = f"doc_{doc_id.replace('-', '_')}"
    return await asyncio.to_thread(_sync_get_chunk, collection_name, chunk_index)


async def delete_document(doc_id: str):
    """Remove all chunks for a document from ChromaDB."""
    collection_name = f"doc_{doc_id.replace('-', '_')}"
    await asyncio.to_thread(_sync_delete_collection, collection_name)
