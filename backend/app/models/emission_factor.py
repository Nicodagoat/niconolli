import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, DateTime, Integer, ForeignKey, Enum as SAEnum, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class FactorSource(str, enum.Enum):
    EPA = "epa"
    DEFRA = "defra"
    IEA = "iea"
    IPCC = "ipcc"
    EGRID = "egrid"
    CUSTOM = "custom"


class FactorCategory(str, enum.Enum):
    STATIONARY_COMBUSTION = "stationary_combustion"
    MOBILE_COMBUSTION = "mobile_combustion"
    FUGITIVE = "fugitive"
    ELECTRICITY = "electricity"
    HEAT_STEAM = "heat_steam"
    TRANSPORT_FREIGHT = "transport_freight"
    TRANSPORT_PASSENGER = "transport_passenger"
    WASTE = "waste"
    MATERIALS = "materials"
    HOTEL_STAYS = "hotel_stays"
    SPEND_BASED = "spend_based"
    WELL_TO_TANK = "well_to_tank"


class EmissionFactor(Base):
    __tablename__ = "emission_factors"
    __table_args__ = (
        UniqueConstraint("source", "source_id", "year", name="uq_factor_source_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[FactorSource] = mapped_column(SAEnum(FactorSource), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(100), nullable=True)  # ID in the source system
    category: Mapped[FactorCategory] = mapped_column(SAEnum(FactorCategory), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Factor values
    co2_factor: Mapped[float] = mapped_column(Float, nullable=False)  # kg CO2 per unit
    ch4_factor: Mapped[float] = mapped_column(Float, default=0.0)    # kg CH4 per unit
    n2o_factor: Mapped[float] = mapped_column(Float, default=0.0)    # kg N2O per unit
    co2e_factor: Mapped[float] = mapped_column(Float, nullable=False) # kg CO2e per unit (total)
    hfc_factor: Mapped[float] = mapped_column(Float, default=0.0)
    pfc_factor: Mapped[float] = mapped_column(Float, default=0.0)
    sf6_factor: Mapped[float] = mapped_column(Float, default=0.0)

    # Units
    input_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "liters", "kwh", "km"
    output_unit: Mapped[str] = mapped_column(String(50), default="kg_co2e")

    # Context
    region: Mapped[str] = mapped_column(String(100), nullable=True, index=True)  # Country/region code
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    gwp_version: Mapped[str] = mapped_column(String(10), default="ar6")
    fuel_type: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    vehicle_type: Mapped[str] = mapped_column(String(100), nullable=True)
    waste_type: Mapped[str] = mapped_column(String(100), nullable=True)

    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    versions: Mapped[list["EmissionFactorVersion"]] = relationship(
        "EmissionFactorVersion", back_populates="emission_factor", cascade="all, delete-orphan"
    )


class EmissionFactorVersion(Base):
    """Audit trail for emission factor changes."""
    __tablename__ = "emission_factor_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("emission_factors.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    co2e_factor_old: Mapped[float] = mapped_column(Float, nullable=True)
    co2e_factor_new: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, nullable=True)
    change_reason: Mapped[str] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    changed_by: Mapped[str] = mapped_column(String(100), default="system")

    # Relationships
    emission_factor: Mapped["EmissionFactor"] = relationship("EmissionFactor", back_populates="versions")
