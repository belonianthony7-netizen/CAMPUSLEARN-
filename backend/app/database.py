from functools import lru_cache
from typing import Generator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./campuslearn.db"
    jwt_secret: str = "CHANGE_ME_BEFORE_PRODUCTION_THIS_IS_DEVELOPMENT_ONLY"
    jwt_expire_minutes: int = 120
    upload_directory: str = "./data/uploads"
    app_env: str = "development"
    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
if settings.database_url.startswith("sqlite"):
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        yield db
