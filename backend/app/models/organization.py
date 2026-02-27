import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class IndustryType(str, enum.Enum):
    MANUFACTURING = "manufacturing"
    TECHNOLOGY = "technology"
    RETAIL = "retail"
    HEALTHCARE = "healthcare"
    FINANCE = "finance"
    CONSTRUCTION = "construction"
    TRANSPORTATION = "transportation"
    AGRICULTURE = "agriculture"
    ENERGY = "energy"
    HOSPITALITY = "hospitality"
    EDUCATION = "education"
    OTHER = "other"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[IndustryType] = mapped_column(SAEnum(IndustryType), nullable=False)
    country: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO 3166-1 alpha-3
    description: Mapped[str] = mapped_column(Text, nullable=True)
    employee_count: Mapped[int] = mapped_column(nullable=True)
    annual_revenue: Mapped[float] = mapped_column(nullable=True)
    revenue_currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    facilities: Mapped[list["Facility"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship("User", back_populates="organization")
    inventories: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="organization")


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    state_province: Mapped[str] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(3), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=True)
    latitude: Mapped[float] = mapped_column(nullable=True)
    longitude: Mapped[float] = mapped_column(nullable=True)
    facility_type: Mapped[str] = mapped_column(String(100), nullable=True)
    egrid_subregion: Mapped[str] = mapped_column(String(20), nullable=True)  # For US electricity factors
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="facilities")
    activities: Mapped[list["Activity"]] = relationship("Activity", back_populates="facility")
