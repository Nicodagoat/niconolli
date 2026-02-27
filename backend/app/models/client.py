"""Client model for managing SME clients within the platform."""

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, DateTime, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ClientStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[str] = mapped_column(String(100), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    country: Mapped[str] = mapped_column(String(3), default="ITA")
    status: Mapped[ClientStatus] = mapped_column(SAEnum(ClientStatus), default=ClientStatus.ACTIVE)

    # Aggregated emission totals (updated after calculations)
    total_scope1_tonnes: Mapped[float] = mapped_column(Float, default=0.0)
    total_scope2_tonnes: Mapped[float] = mapped_column(Float, default=0.0)
    total_scope3_tonnes: Mapped[float] = mapped_column(Float, default=0.0)
    total_co2e_tonnes: Mapped[float] = mapped_column(Float, default=0.0)

    notes: Mapped[str] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    deasp_projects: Mapped[list["DEASPProject"]] = relationship("DEASPProject", back_populates="client")
