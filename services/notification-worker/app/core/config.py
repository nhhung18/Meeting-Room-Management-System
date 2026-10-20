from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "notification-worker"
    api_prefix: str = "/api/notifications"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    # Queue mà worker lắng nghe
    notifications_queue: str = "notifications"


@lru_cache
def get_settings() -> Settings:
    return Settings()
