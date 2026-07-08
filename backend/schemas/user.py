from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid

# input dari frontend
class UserCreate(BaseModel):
    username: str
    password: str

# output ke frontend
class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    created_at: datetime

    # Mengizinkan Pydantic membaca data dari objek SQLAlchemy ORM
    model_config = ConfigDict(from_attributes=True)

# response Login (JWT Token)
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"