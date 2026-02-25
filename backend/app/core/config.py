from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "GHG Emissions Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ghg_user:ghg_pass@localhost:5432/ghg_emissions"
    DATABASE_SYNC_URL: str = "postgresql://ghg_user:ghg_pass@localhost:5432/ghg_emissions"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Emission Factor APIs
    EPA_API_BASE_URL: str = "https://api.epa.gov/ghg"
    DEFRA_API_BASE_URL: str = "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting"
    IEA_API_KEY: Optional[str] = None

    # Factor Update Schedule
    FACTOR_UPDATE_CRON_HOUR: int = 2
    FACTOR_UPDATE_CRON_MINUTE: int = 0
    FACTOR_CHANGE_THRESHOLD_PCT: float = 5.0

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
