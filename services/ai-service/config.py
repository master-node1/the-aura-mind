from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"

    redis_url: str = "redis://localhost:6379"

    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # Internal HTTP URL of memory-service for semantic search/save
    memory_service_url: str = "http://memory-service:3000"

    short_term_memory_ttl: int = 3600
    max_short_term_messages: int = 50
    memory_importance_threshold: float = 0.6


settings = Settings()
