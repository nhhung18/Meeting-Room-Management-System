"""Cấu hình booking-service, đọc từ biến môi trường (tương đương application.yml của Spring).

Extend ServiceSettings từ libs/common — giữ pattern chung (service_name, environment,
log_level) và thêm các field riêng của booking-service.
"""

from functools import lru_cache

from common.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "booking-service"

    # Tiền tố URL công khai mà Nginx chuyển tới service này.
    api_prefix: str = "/api/bookings"

    # Bắt buộc phải có: thiếu thì service dừng ngay khi khởi động (fail fast).
    database_url: str

    # URL của room-service để đồng bộ room snapshots (ADR-0003).
    room_service_url: str = "http://room-service:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
