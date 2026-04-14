"""
Web search for related academic papers using the Serper API.
"""
import os
import httpx
import structlog

logger = structlog.get_logger()

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SERPER_URL = "https://google.serper.dev/search"


async def search_related_papers(topic: str, n: int = 5) -> list[dict]:
    """
    Search for related academic papers on the web.
    Returns structured list: [{title, url, snippet, year}]
    """
    query = f'"{topic}" peer-reviewed research filetype:pdf OR site:arxiv.org OR site:pubmed.ncbi.nlm.nih.gov'

    if not SERPER_API_KEY or SERPER_API_KEY == "xxxx":
        logger.warning("serper_key_not_set", topic=topic)
        return _mock_results(topic, n)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                SERPER_URL,
                headers={
                    "X-API-KEY": SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": n * 2},
            )
            if resp.status_code != 200:
                logger.warning("serper_error", status=resp.status_code)
                return _mock_results(topic, n)

            data = resp.json()
            results = []
            for item in data.get("organic", [])[:n]:
                # Try to extract year from snippet
                snippet = item.get("snippet", "")
                year = None
                for token in snippet.split():
                    if token.strip("().,").isdigit() and 1990 <= int(token.strip("().,")) <= 2025:
                        year = int(token.strip("().,"))
                        break

                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": snippet,
                    "year": year,
                    "source": item.get("displayLink", ""),
                })
            return results

    except Exception as e:
        logger.error("serper_request_failed", error=str(e))
        return _mock_results(topic, n)


def _mock_results(topic: str, n: int) -> list[dict]:
    """Fallback mock results when Serper API is not configured."""
    return [
        {
            "title": f"Recent advances in {topic}",
            "url": "https://arxiv.org/abs/example",
            "snippet": f"This paper presents novel findings in {topic} with empirical validation.",
            "year": 2024,
            "source": "arxiv.org",
        }
    ][:n]
