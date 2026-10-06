import pytest


@pytest.mark.parametrize("path", ["/health", "/api/bookings/health"])
def test_health_ok_when_database_up(client, db_up, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "booking-service",
        "database": "ok",
    }


def test_health_returns_503_when_database_down(client, db_down):
    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"


def test_request_id_is_propagated(client, db_up):
    response = client.get("/health", headers={"X-Request-ID": "abc-123"})

    assert response.headers["X-Request-ID"] == "abc-123"


def test_request_id_is_generated_when_missing(client, db_up):
    response = client.get("/health")

    assert len(response.headers["X-Request-ID"]) == 32


def test_invalid_request_id_is_replaced(client, db_up):
    response = client.get("/health", headers={"X-Request-ID": "bad id\nwith newline"})

    assert response.headers["X-Request-ID"] != "bad id\nwith newline"
