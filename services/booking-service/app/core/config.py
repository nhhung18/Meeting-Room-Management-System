"""Cấu hình service, đọc từ biến môi trường (tương đương application.yml của Spring).

Không bao giờ hardcode secret ở đây: mọi giá trị nhạy cảm (mật khẩu DB, Auth0 secret)
đều đến từ biến môi trường do Docker Compose truyền vào.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "booking-service"
    environment: str = "local"
    log_level: str = "INFO"

    # Tiền tố URL công khai mà Nginx chuyển tới service này.
    api_prefix: str = "/api/bookings"

    # Bắt buộc phải có: thiếu thì service dừng ngay khi khởi động (fail fast).
    database_url: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
