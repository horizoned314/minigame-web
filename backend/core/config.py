import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Web Minigame"
    
    # Pastikan menggunakan postgresql+asyncpg untuk operasi I/O asinkron
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    
    # Secret Key JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    
    # CORS Origins (tambahin url frontend)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173", 
        "http://127.0.0.1:5173",

        ]

    model_config = ConfigDict(env_file=".env")

settings = Settings()