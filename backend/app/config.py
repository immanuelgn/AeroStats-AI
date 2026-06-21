from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "aerostats-flight-files"
    model_artifact_bucket: str = "aerostats-model-artifacts"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    cors_origins: str = "http://localhost:3000,https://aerostats-ai.vercel.app"
    max_upload_mb: int = 15
    rate_limit_per_minute: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
