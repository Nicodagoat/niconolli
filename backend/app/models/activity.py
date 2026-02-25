import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Text, Float, DateTime, Date, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class Scope(str, enum.Enum):
    SCOPE_1 = "scope_1"
    SCOPE_2 = "scope_2"
    SCOPE_3 = "scope_3"


class Scope1Category(str, enum.Enum):
    STATIONARY_COMBUSTION = "stationary_combustion"
    MOBILE_COMBUSTION = "mobile_combustion"
    FUGITIVE_EMISSIONS = "fugitive_emissions"
    PROCESS_EMISSIONS = "process_emissions"


class Scope2Method(str, enum.Enum):
    LOCATION_BASED = "location_based"
    MARKET_BASED = "market_based"


class Scope3Category(str, enum.Enum):
    CAT_1_PURCHASED_GOODS = "cat_1_purchased_goods_services"
    CAT_2_CAPITAL_GOODS = "cat_2_capital_goods"
    CAT_3_FUEL_ENERGY = "cat_3_fuel_energy_related"
    CAT_4_UPSTREAM_TRANSPORT = "cat_4_upstream_transportation"
    CAT_5_WASTE = "cat_5_waste_operations"
    CAT_6_BUSINESS_TRAVEL = "cat_6_business_travel"
    CAT_7_COMMUTING = "cat_7_employee_commuting"
    CAT_8_UPSTREAM_LEASED = "cat_8_upstream_leased_assets"
    CAT_9_DOWNSTREAM_TRANSPORT = "cat_9_downstream_transportation"
    CAT_11_USE_SOLD_PRODUCTS = "cat_11_use_sold_products"
    CAT_12_END_OF_LIFE = "cat_12_end_of_life"


class DataQuality(str, enum.Enum):
    HIGH = "high"       # Measured / metered data
    MEDIUM = "medium"   # Calculated from reliable proxies
    LOW = "low"         # Estimated / spend-based
    DEFAULT = "default" # Industry default values


class ActivityUnit(str, enum.Enum):
    # Volume
    LITERS = "liters"
    GALLONS_US = "gallons_us"
    CUBIC_METERS = "cubic_meters"
    THERMS = "therms"
    MMBTU = "mmbtu"
    # Energy
    KWH = "kwh"
    MWH = "mwh"
    GJ = "gj"
    # Distance
    KM = "km"
    MILES = "miles"
    # Mass
    KG = "kg"
    TONNES = "tonnes"
    LBS = "lbs"
    SHORT_TONS = "short_tons"
    # Currency (spend-based)
    USD = "usd"
    EUR = "eur"
    GBP = "gbp"
    # Count
    PASSENGER_KM = "passenger_km"
    TONNE_KM = "tonne_km"
    NIGHTS = "nights"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventories.id"), nullable=False)
    facility_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=True)
    scope: Mapped[Scope] = mapped_column(SAEnum(Scope), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # Scope1Category, Scope3Category value
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Activity data
    activity_value: Mapped[float] = mapped_column(Float, nullable=False)
    activity_unit: Mapped[ActivityUnit] = mapped_column(SAEnum(ActivityUnit), nullable=False)
    fuel_type: Mapped[str] = mapped_column(String(100), nullable=True)  # e.g., natural_gas, diesel, gasoline
    source_detail: Mapped[str] = mapped_column(String(255), nullable=True)  # e.g., vehicle type, appliance

    # For Scope 2
    scope2_method: Mapped[str] = mapped_column(String(50), nullable=True)

    # Date range
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=True)

    # Data quality
    data_quality: Mapped[DataQuality] = mapped_column(SAEnum(DataQuality), default=DataQuality.MEDIUM)
    data_source: Mapped[str] = mapped_column(String(255), nullable=True)
    uncertainty_pct: Mapped[float] = mapped_column(Float, nullable=True)

    # Emission factor reference
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("emission_factors.id"), nullable=True)

    # Metadata
    custom_metadata: Mapped[dict] = mapped_column(JSON, nullable=True)
    is_biogenic: Mapped[bool] = mapped_column(default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    inventory: Mapped["Inventory"] = relationship("Inventory", back_populates="activities")
    facility: Mapped["Facility"] = relationship("Facility", back_populates="activities")
    emission_factor: Mapped["EmissionFactor"] = relationship("EmissionFactor")
    calculation_results: Mapped[list["CalculationResult"]] = relationship(
        "CalculationResult", back_populates="activity", cascade="all, delete-orphan"
    )
