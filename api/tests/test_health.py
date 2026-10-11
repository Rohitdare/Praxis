import pytest
from httpx import ASGITransport, AsyncClient

from personal_memory_api.main import app


@pytest.mark.asyncio
async def test_health_check() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_cors_headers_production_origin() -> None:
    transport = ASGITransport(app=app)
    headers = {"Origin": "https://praxis-memo.vercel.app"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health", headers=headers)
        assert response.status_code == 200
        assert (
            response.headers.get("access-control-allow-origin") == "https://praxis-memo.vercel.app"
        )


@pytest.mark.asyncio
async def test_cors_headers_unauthorized_origin() -> None:
    transport = ASGITransport(app=app)
    headers = {"Origin": "https://unauthorized-evil-site.com"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") is None
