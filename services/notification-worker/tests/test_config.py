"""Unit tests cho notification-worker config và core modules.

Không cần RabbitMQ hay Docker để chạy.
"""


def test_settings_defaults(monkeypatch):
    """Settings load được với defaults; rabbitmq_url và queue name đúng."""
    monkeypatch.setenv("SERVICE_NAME", "notification-worker")
    # Xóa cache từ lần import trước (nếu có)
    from importlib import reload

    import app.core.config as cfg_module

    reload(cfg_module)

    from app.core.config import Settings

    s = Settings()
    assert s.service_name == "notification-worker"
    assert "rabbitmq" in s.rabbitmq_url
    assert s.notifications_queue == "notifications"
    assert s.api_prefix == "/api/notifications"


def test_settings_env_override(monkeypatch):
    """RABBITMQ_URL từ env được đọc đúng."""
    monkeypatch.setenv("RABBITMQ_URL", "amqp://user:pass@myhost:5672/vhost")
    monkeypatch.setenv("SERVICE_NAME", "notification-worker")

    from importlib import reload

    import app.core.config as cfg_module

    reload(cfg_module)

    from app.core.config import Settings

    s = Settings()
    assert s.rabbitmq_url == "amqp://user:pass@myhost:5672/vhost"


def test_logging_reexport():
    """app.core.logging re-export đúng symbol từ libs/common."""
    from app.core.logging import JsonFormatter, configure_logging

    assert callable(configure_logging)
    assert JsonFormatter is not None


def test_request_id_reexport():
    """app.core.request_id re-export đúng symbols từ libs/common."""
    from app.core.request_id import REQUEST_ID_HEADER, resolve_request_id

    assert REQUEST_ID_HEADER == "X-Request-ID"
    assert callable(resolve_request_id)
    rid = resolve_request_id(None)
    assert len(rid) == 32  # uuid4().hex — 32 hex chars, no dashes
