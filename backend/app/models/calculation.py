import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class CalculationResult(Base):
    __tablename__ = "calculation_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventories.id"), nullable=False)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=False)

    # Scope and category
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)

    # Emissions breakdown (kg)
    co2_kg: Mapped[float] = mapped_column(Float, default=0.0)
    ch4_kg: Mapped[float] = mapped_column(Float, default=0.0)
    n2o_kg: Mapped[float] = mapped_column(Float, default=0.0)
    hfc_kg: Mapped[float] = mapped_column(Float, default=0.0)
    pfc_kg: Mapped[float] = mapped_column(Float, default=0.0)
    sf6_kg: Mapped[float] = mapped_column(Float, default=0.0)
    total_co2e_kg: Mapped[float] = mapped_column(Float, nullable=False)

    # Converted totals
    total_co2e_tonnes: Mapped[float] = mapped_column(Float, nullable=False)

    # Biogenic
    biogenic_co2_kg: Mapped[float] = mapped_column(Float, default=0.0)

    # Uncertainty
    uncertainty_pct: Mapped[float] = mapped_column(Float, nullable=True)
    data_quality: Mapped[str] = mapped_column(String(20), nullable=True)

    # Calculation metadata
    emission_factor_used: Mapped[str] = mapped_column(String(500), nullable=True)
    emission_factor_value: Mapped[float] = mapped_column(Float, nullable=True)
    gwp_version: Mapped[str] = mapped_column(String(10), nullable=True)
    methodology_notes: Mapped[str] = mapped_column(String(500), nullable=True)
    calculation_details: Mapped[dict] = mapped_column(JSON, nullable=True)

    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    inventory: Mapped["Inventory"] = relationship("Inventory", back_populates="calculation_results")
    activity: Mapped["Activity"] = relationship("Activity", back_populates="calculation_results")
