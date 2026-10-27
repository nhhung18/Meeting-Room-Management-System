from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "notification-worker"
    api_prefix: str = "/api/notifications"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    notifications_queue: str = "notifications"
    # SMTP — để trống → dev mode (log thay vì gửi email thật)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@mrms.local"
    # booking_db — dùng để track processed_events (idempotency)
    database_url: str = ""
    # Retry + DLQ: số lần thử lại tối đa trước khi route sang DLQ
    max_retries: int = 3
    dlq_queue: str = "notifications.dlq"


@lru_cache
def get_settings() -> Settings:
    return Settings()
