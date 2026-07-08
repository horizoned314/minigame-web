import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # relasi ke GameHistory
    games_as_player1 = relationship("GameHistory", foreign_keys="GameHistory.player_1_id", back_populates="player1")
    games_as_player2 = relationship("GameHistory", foreign_keys="GameHistory.player_2_id", back_populates="player2")
    games_won = relationship("GameHistory", foreign_keys="GameHistory.winner_id", back_populates="winner")