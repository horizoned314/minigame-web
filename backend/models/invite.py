import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from database import Base

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_user = Column(String, nullable=False)           # Siapa yang ngirim
    to_user = Column(String, nullable=False, index=True) # Siapa yang diundang (index agar query cepat)
    game_name = Column(String, nullable=False)           # 'tictactoe' atau 'photobooth'
    status = Column(String, default="pending")           # 'pending', 'accepted', 'rejected'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))