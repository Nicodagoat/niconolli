import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Enum as SAEnum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class InventoryStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"


class BoundaryApproach(str, enum.Enum):
    OPERATIONAL_CONTROL = "operational_control"
    FINANCIAL_CONTROL = "financial_control"
    EQUITY_SHARE = "equity_share"


class GWPVersion(str, enum.Enum):
    AR5 = "ar5"
    AR6 = "ar6"


class Inventory(Base):
    __tablename__ = "inventories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reporting_year: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    boundary_approach: Mapped[BoundaryApproach] = mapped_column(
        SAEnum(BoundaryApproach), default=BoundaryApproach.OPERATIONAL_CONTROL
    )
    gwp_version: Mapped[GWPVersion] = mapped_column(SAEnum(GWPVersion), default=GWPVersion.AR6)
    status: Mapped[InventoryStatus] = mapped_column(SAEnum(InventoryStatus), default=InventoryStatus.DRAFT)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    base_year: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="inventories")
    activities: Mapped[list["Activity"]] = relationship("Activity", back_populates="inventory", cascade="all, delete-orphan")
    calculation_results: Mapped[list["CalculationResult"]] = relationship(
        "CalculationResult", back_populates="inventory", cascade="all, delete-orphan"
    )
