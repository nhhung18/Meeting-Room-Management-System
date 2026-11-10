from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "room-service"
    api_prefix: str = "/api/rooms"
    database_url: str
    cloudinary_url: str | None = None  # cloudinary://key:secret@cloud_name


@lru_cache
def get_settings() -> Settings:
    return Settings()
