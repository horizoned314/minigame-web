from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, ConfigDict
import uuid

from database import get_db
from models.invite import Invitation

router = APIRouter(prefix="/invites", tags=["Invitations"])

# ==========================================
# 1. SCHEMA PYDANTIC (Validasi)
# ==========================================
class InviteCreate(BaseModel):
    from_user: str
    to_user: str
    game_name: str

class InviteResponse(BaseModel):
    id: uuid.UUID
    from_user: str
    to_user: str
    game_name: str
    status: str

    # WAJIB: Agar Pydantic bisa membaca data dari object SQLAlchemy (ORM)
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# 2. ENDPOINTS API
# ==========================================

# API POST: Dipanggil pas tombol [OK] diklik
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invite(data: InviteCreate, db: AsyncSession = Depends(get_db)):
    # Cek apakah sudah ada invite pending yang sama (biar gak spam)
    query = select(Invitation).where(
        (Invitation.from_user == data.from_user) & 
        (Invitation.to_user == data.to_user) & 
        (Invitation.status == "pending")
    )
    result = await db.execute(query)
    
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Undangan sudah terkirim dan masih pending.")

    new_invite = Invitation(
        from_user=data.from_user,
        to_user=data.to_user,
        game_name=data.game_name
    )
    
    db.add(new_invite)
    await db.commit()
    await db.refresh(new_invite)
    
    return {"status": "success", "message": "Undangan tersimpan di database", "id": new_invite.id}


# API GET: Dipanggil di useEffect pas user login
# PERBAIKAN: Tambahkan response_model agar data ORM di-convert ke JSON dengan benar
@router.get("/{username}", response_model=list[InviteResponse])
async def get_my_invites(username: str, db: AsyncSession = Depends(get_db)):
    query = select(Invitation).where(
        (Invitation.to_user == username) & 
        (Invitation.status == "pending")
    )
    result = await db.execute(query)
    invites = result.scalars().all()
    
    return invites


# API PUT: Dipanggil pas handleAcceptInvite / handleRejectInvite
# PERBAIKAN: Ubah path menjadi "/{invite_id}/{action}" agar frontend lebih mudah hit API-nya
@router.put("/{invite_id}/{action}")
async def respond_invite(invite_id: uuid.UUID, action: str, db: AsyncSession = Depends(get_db)):
    # Validasi action dari URL
    if action not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="Action hanya boleh 'accept' atau 'reject'")
        
    # Cari undangan
    query = select(Invitation).where(Invitation.id == invite_id)
    result = await db.execute(query)
    invite = result.scalar_one_or_none()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Undangan tidak ditemukan")
        
    # Update status
    invite.status = action # Karena action pasti "accept" atau "reject"
    await db.commit()
    
    return {"status": "success", "message": f"Undangan berhasil di-{action}"}