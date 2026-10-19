"""Unit tests cho /health endpoint của room-service."""


def test_health_returns_200_when_db_up(client, db_up):
    """Health endpoint trả 200 khi DB kết nối được."""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "room-service"
    assert body["database"] == "ok"


def test_health_returns_503_when_db_down(client, db_down):
    """Health endpoint trả 503 khi DB không kết nối được."""
    resp = client.get("/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["database"] == "unavailable"


def test_health_with_api_prefix(client, db_up):
    """Health cũng accessible qua /api/rooms/health (Nginx path)."""
    resp = client.get("/api/rooms/health")
    assert resp.status_code == 200
    assert resp.json()["service"] == "room-service"


def test_health_returns_request_id_header(client, db_up):
    """Response có header X-Request-ID."""
    resp = client.get("/health")
    assert "x-request-id" in resp.headers
