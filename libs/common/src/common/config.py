"""Base settings class dùng chung cho mọi service (tương đương application.yml của Spring).

Mỗi service extend class này và thêm các field riêng (database_url, rabbitmq_url, ...).
Không bao giờ hardcode secret ở đây: mọi giá trị nhạy cảm đến từ biến môi trường.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class ServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str
    environment: str = "local"
    log_level: str = "INFO"
