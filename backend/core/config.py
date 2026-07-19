import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Web Minigame"
    
    # Pydantic otomatis membaca dari environment variable yang namanya sama
    DATABASE_URL: str
    database_url_test: str = "" # Beri default string kosong agar tidak crash jika lupa dipasang
    supabase_url: str = ""
    
    # Secret Key JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS Origins (PASTIKAN TANPA SLASH DI ULANG URL)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "https://playgrounds-game.vercel.app", # <-- Sudah bersih dari tanda slash /
    ]

    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()