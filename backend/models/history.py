import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base

class GameHistory(Base):
    __tablename__ = "game_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_1_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    player_2_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    game_type = Column(String, nullable=False)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    played_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relasi balik ke User
    player1 = relationship("User", foreign_keys=[player_1_id], back_populates="games_as_player1")
    player2 = relationship("User", foreign_keys=[player_2_id], back_populates="games_as_player2")
    winner = relationship("User", foreign_keys=[winner_id], back_populates="games_won")

class PhotoboothGallery(Base):
    __tablename__ = "photobooth_gallery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_code = Column(String, nullable=False, index=True)
    image_url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))