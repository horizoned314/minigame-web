from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
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

    query = select(Invitation).where(
        (Invitation.from_user == data.from_user)
        &
        (Invitation.to_user == data.to_user)
        &
        (Invitation.status == "pending")
    )

    result = await db.execute(query)

    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Undangan sudah terkirim dan masih pending."
        )

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
        (Invitation.to_user == username)
        &
        (Invitation.status == "pending")
    )

    result = await db.execute(query)

    return result.scalars().all()


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

    invite.status = action

    await db.commit()

    return {
        "status": "success",
        "room_code": invite.room_code,
        "from_user": invite.from_user,
        "to_user": invite.to_user,
        "game_name": invite.game_name
    }