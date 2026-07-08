from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.user import User
from schemas.user import UserCreate, UserResponse, Token
from core.security import get_password_hash, verify_password, create_access_token
import traceback

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # 1. Cek apakah username sudah dipakai
    query = select(User).where(User.username == user_data.username)
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    
    # 2. Hash Password
    hashed_password = get_password_hash(user_data.password)
    new_user = User(username=user_data.username, password_hash=hashed_password)
    
    # 3. Simpan ke Database
    try:
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except Exception as e:
        await db.rollback()
        #print(f"🔥 ERROR DATABASE: {e}") 
        #raise HTTPException(status_code=500, detail=f"Error DB: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan data ke database")

@router.post("/login", response_model=Token)
async def login(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Cari user di database
        query = select(User).where(User.username == user_data.username)
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        
        # 2. Verifikasi User & Password
        if not user or not verify_password(user_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username atau password salah",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 3. Generate JWT Token
        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        # Biarkan HTTPException (seperti 401 Salah Password) lewat dengan normal
        raise