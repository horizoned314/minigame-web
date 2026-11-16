from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel, ConfigDict
import uuid

from database import get_db
from models.invite import Invitation

router = APIRouter(prefix="/invites", tags=["Invitations"])


# ==========================
# PYDANTIC
# ==========================

class InviteCreate(BaseModel):
    from_user: str
    to_user: str
    game_name: str
    room_code: str


class InviteResponse(BaseModel):
    id: uuid.UUID
    from_user: str
    to_user: str
    game_name: str
    room_code: str
    status: str

    model_config = ConfigDict(from_attributes=True)


# ==========================
# CREATE INVITE
# ==========================

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invite(
    data: InviteCreate,
    db: AsyncSession = Depends(get_db)
):

    if data.from_user.strip().upper() == data.to_user.strip().upper():
        raise HTTPException(
            status_code=400,
            detail="Tidak bisa mengundang diri sendiri."
        )

    query = select(Invitation).where(
        (func.upper(Invitation.from_user) == data.from_user.upper())
        &
        (func.upper(Invitation.to_user) == data.to_user.upper())
        &
        (Invitation.status == "pending")
    )

    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    # Kalau undangan lama masih pending, perbarui saja. Dulu endpoint ini
    # menolak (400), sehingga undangan basi ke room yang sudah ditutup
    # memblokir pemain untuk mengundang teman yang sama selamanya.
    if existing:
        existing.game_name = data.game_name
        existing.room_code = data.room_code
        await db.commit()
        await db.refresh(existing)

        return {
            "status": "success",
            "message": "Invitation updated",
            "id": existing.id,
            "room_code": existing.room_code
        }

    invite = Invitation(
        from_user=data.from_user,
        to_user=data.to_user,
        game_name=data.game_name,
        room_code=data.room_code
    )

    db.add(invite)

    await db.commit()

    await db.refresh(invite)

    return {
        "status": "success",
        "message": "Invitation created",
        "id": invite.id,
        "room_code": invite.room_code
    }


# ==========================
# GET INVITE
# ==========================

@router.get(
    "/{username}",
    response_model=list[InviteResponse]
)
async def get_my_invites(
    username: str,
    db: AsyncSession = Depends(get_db)
):

    query = select(Invitation).where(
        (func.upper(Invitation.to_user) == username.upper())
        &
        (Invitation.status == "pending")
    )

    result = await db.execute(query)

    return result.scalars().all()


# ==========================
# CANCEL / DELETE INVITE
# ==========================

@router.delete("/{invite_id}")
async def delete_invite(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Invitation).where(Invitation.id == invite_id)
    result = await db.execute(query)
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=404,
            detail="Invitation not found."
        )

    await db.delete(invite)
    await db.commit()

    return {"status": "success", "message": "Invitation cancelled"}


# ==========================
# ACCEPT / REJECT
# ==========================

@router.put("/{invite_id}/{action}")
async def respond_invite(
    invite_id: uuid.UUID,
    action: str,
    db: AsyncSession = Depends(get_db)
):

    if action not in ["accept", "reject"]:
        raise HTTPException(
            status_code=400,
            detail="Action harus accept atau reject."
        )

    query = select(Invitation).where(
        Invitation.id == invite_id
    )

    result = await db.execute(query)

    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=404,
            detail="Invitation not found."
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Undangan ini sudah dibatalkan atau sudah direspons."
        )

    invite.status = action

    await db.commit()

    return {
        "status": "success",
        "room_code": invite.room_code,
        "from_user": invite.from_user,
        "to_user": invite.to_user,
        "game_name": invite.game_name
    }