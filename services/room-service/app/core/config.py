from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "room-service"
    api_prefix: str = "/api/rooms"
    database_url: str

    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    notifications_queue: str = "notifications"
    outbox_relay_interval_seconds: int = 5

    cloudinary_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
