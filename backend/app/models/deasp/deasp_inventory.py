"""
DEASP Inventory and Calculation Result models.

Represents a complete DEASP reporting period for a port authority,
aggregating ship calls, concessionaire questionnaires, and calculations.
"""

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Float, Integer, DateTime,
    ForeignKey, Enum as SAEnum, JSON, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class DEASPStatus(str, enum.Enum):
    BOZZA = "bozza"
    RACCOLTA_DATI = "raccolta_dati"
    CALCOLO = "calcolo"
    REVISIONE = "revisione"
    APPROVATO = "approvato"
    PUBBLICATO = "pubblicato"


class DEASPInventory(Base):
    """A DEASP reporting inventory for a specific year."""
    __tablename__ = "deasp_inventories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reporting_year: Mapped[int] = mapped_column(Integer, nullable=False)
    port_authority_name: Mapped[str] = mapped_column(String(500), nullable=True)
    ports_included: Mapped[dict] = mapped_column(JSON, nullable=True)  # List of ports covered
    status: Mapped[DEASPStatus] = mapped_column(SAEnum(DEASPStatus), default=DEASPStatus.BOZZA)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Summary totals (filled after calculation)
    total_ship_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    total_concessionaire_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    total_authority_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    grand_total_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)

    # Factor snapshot: which factors were used for this inventory
    factor_snapshot: Mapped[dict] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    calculation_results: Mapped[list["DEASPCalculationResult"]] = relationship(
        "DEASPCalculationResult", back_populates="inventory", cascade="all, delete-orphan"
    )


class DEASPCalculationResult(Base):
    """Individual DEASP calculation result line items."""
    __tablename__ = "deasp_calculation_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_inventories.id"), nullable=False
    )

    # Source identification
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # navi, concessionario, autorita
    source_entity_id: Mapped[str] = mapped_column(String(100), nullable=True)  # Ship call or concessionaire ID
    source_name: Mapped[str] = mapped_column(String(500), nullable=True)
    port: Mapped[str] = mapped_column(String(100), nullable=True)

    # Emission category
    scope: Mapped[str] = mapped_column(String(20), nullable=False)  # scope_1, scope_2
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)

    # Calculation
    activity_value: Mapped[float] = mapped_column(Float, nullable=True)
    activity_unit: Mapped[str] = mapped_column(String(50), nullable=True)
    emission_factor_value: Mapped[float] = mapped_column(Float, nullable=True)
    emission_factor_source: Mapped[str] = mapped_column(String(100), nullable=True)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Results
    co2_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    nox_kg: Mapped[float] = mapped_column(Float, nullable=True)
    sox_kg: Mapped[float] = mapped_column(Float, nullable=True)
    pm_kg: Mapped[float] = mapped_column(Float, nullable=True)

    # Confidence
    confidence_pct: Mapped[float] = mapped_column(Float, nullable=True)
    methodology_notes: Mapped[str] = mapped_column(Text, nullable=True)

    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inventory: Mapped["DEASPInventory"] = relationship("DEASPInventory", back_populates="calculation_results")
