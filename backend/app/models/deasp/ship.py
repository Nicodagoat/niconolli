"""
Ship Call models for DEASP Italia module.

Tracks vessel visits to Italian ports with IMO numbers, GT classification,
hotelling/maneuvering hours, and fuel consumption data conforming to
EMEP/EEA emission inventory methodology.
"""

import uuid
import enum
from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Text, Float, Integer, DateTime, Date,
    ForeignKey, Enum as SAEnum, JSON, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class PortName(str, enum.Enum):
    AUGUSTA = "augusta"
    CATANIA = "catania"
    SIRACUSA = "siracusa"
    POZZALLO = "pozzallo"
    GELA = "gela"
    LICATA = "licata"
    PORTO_EMPEDOCLE = "porto_empedocle"
    TRAPANI = "trapani"
    PALERMO = "palermo"
    MESSINA = "messina"
    MILAZZO = "milazzo"
    GENOVA = "genova"
    LIVORNO = "livorno"
    NAPOLI = "napoli"
    BARI = "bari"
    TARANTO = "taranto"
    TRIESTE = "trieste"
    VENEZIA = "venezia"
    RAVENNA = "ravenna"
    ANCONA = "ancona"
    CIVITAVECCHIA = "civitavecchia"
    GIOIA_TAURO = "gioia_tauro"
    CAGLIARI = "cagliari"
    OLBIA = "olbia"
    OTHER = "other"


class MeetCategory(str, enum.Enum):
    """MEET vessel categories for emission calculations."""
    LIQUID_BULK = "liquid_bulk"
    DRY_BULK = "dry_bulk"
    CONTAINER = "container"
    GENERAL_CARGO = "general_cargo"
    RO_RO = "ro_ro"
    PASSENGER = "passenger"
    CRUISE = "cruise"
    TANKER = "tanker"
    LNG_CARRIER = "lng_carrier"
    TUG = "tug"
    FISHING = "fishing"
    OTHER = "other"


class GTClass(str, enum.Enum):
    """GT classification for DEASP reporting."""
    GT_0_999 = "0-999"
    GT_1000_4999 = "1000-4999"
    GT_5000_24999 = "5000-24999"
    GT_25000_49999 = "25000-49999"
    GT_50000_PLUS = "50000+"


class ShipCallImport(Base):
    """Tracks bulk import batches of ship call data."""
    __tablename__ = "deasp_ship_call_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    deasp_inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_inventories.id"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    total_records: Mapped[int] = mapped_column(Integer, default=0)
    valid_records: Mapped[int] = mapped_column(Integer, default=0)
    error_records: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[dict] = mapped_column(JSON, nullable=True)
    imported_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ship_calls: Mapped[list["ShipCall"]] = relationship("ShipCall", back_populates="import_batch")


class ShipCall(Base):
    """Individual ship visit to an Italian port."""
    __tablename__ = "deasp_ship_calls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_ship_call_imports.id"), nullable=True
    )
    deasp_inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_inventories.id"), nullable=True
    )

    # Ship identification
    imo_number: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    ship_name: Mapped[str] = mapped_column(String(255), nullable=False)
    flag_state: Mapped[str] = mapped_column(String(5), nullable=True)

    # Port & timing
    port: Mapped[PortName] = mapped_column(SAEnum(PortName), nullable=False, index=True)
    port_name_raw: Mapped[str] = mapped_column(String(100), nullable=True)  # Original name before normalization
    arrival_date: Mapped[date] = mapped_column(Date, nullable=True)
    departure_date: Mapped[date] = mapped_column(Date, nullable=True)

    # Vessel characteristics
    gross_tonnage: Mapped[float] = mapped_column(Float, nullable=False)
    gt_class: Mapped[GTClass] = mapped_column(SAEnum(GTClass), nullable=True)
    meet_category: Mapped[MeetCategory] = mapped_column(SAEnum(MeetCategory), nullable=False)

    # Operational data
    maneuver_count: Mapped[int] = mapped_column(Integer, default=2)  # Typically 2 (arrival + departure)
    hours_in_port: Mapped[float] = mapped_column(Float, nullable=False)
    days_in_port: Mapped[float] = mapped_column(Float, nullable=True)
    hours_hotelling: Mapped[float] = mapped_column(Float, nullable=True)
    hours_maneuvering: Mapped[float] = mapped_column(Float, nullable=True)

    # Fuel data
    fuel_type: Mapped[str] = mapped_column(String(50), nullable=True)  # fuel_oil, diesel, lng
    has_lng: Mapped[bool] = mapped_column(Boolean, default=False)
    has_scrubber: Mapped[bool] = mapped_column(Boolean, default=False)
    shore_power_used: Mapped[bool] = mapped_column(Boolean, default=False)

    # Calculated emissions (filled after calculation)
    hotelling_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    maneuvering_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    total_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    nox_kg: Mapped[float] = mapped_column(Float, nullable=True)
    sox_kg: Mapped[float] = mapped_column(Float, nullable=True)
    pm_kg: Mapped[float] = mapped_column(Float, nullable=True)

    # Metadata
    custom_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    import_batch: Mapped["ShipCallImport"] = relationship("ShipCallImport", back_populates="ship_calls")


def classify_gt(gt: float) -> GTClass:
    """Classify gross tonnage into DEASP reporting classes."""
    if gt < 1000:
        return GTClass.GT_0_999
    elif gt < 5000:
        return GTClass.GT_1000_4999
    elif gt < 25000:
        return GTClass.GT_5000_24999
    elif gt < 50000:
        return GTClass.GT_25000_49999
    else:
        return GTClass.GT_50000_PLUS
