from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from core.config import settings
import ssl

ssl_context = ssl.create_default_context()
DATABASE_URL = settings.DATABASE_URL.replace("?sslmode=require", "")

engine = create_async_engine(
    DATABASE_URL, 
    echo=False,
    connect_args={
        "ssl": ssl_context,
    }, 
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    """Yields a database session and safely closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()