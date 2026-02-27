"""
Concessionaire and Questionnaire models for DEASP Italia module.

Manages digital questionnaires sent to port concessionaires to collect
Scope 1, 2, and machinery emission data.
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


class QuestionnaireStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"
    NOT_RESPONDED = "not_responded"


class FuelTypeIT(str, enum.Enum):
    """Italian fuel types for concessionaire reporting."""
    GASOLIO = "gasolio"
    BENZINA = "benzina"
    GPL = "gpl"
    METANO = "metano"
    OLIO_COMBUSTIBILE = "olio_combustibile"
    BIOMASSA = "biomassa"
    PELLET = "pellet"
    GNL = "gnl"


class VehicleTypeIT(str, enum.Enum):
    AUTO_AZIENDALE = "auto_aziendale"
    FURGONE = "furgone"
    CAMION = "camion"
    MOTOCARRO = "motocarro"
    AUTOBUS = "autobus"
    MEZZO_SPECIALE = "mezzo_speciale"


class MachineryTypeIT(str, enum.Enum):
    GRU_PORTUALE = "gru_portuale"
    GRU_MOBILE = "gru_mobile"
    CARRELLO_ELEVATORE = "carrello_elevatore"
    REACH_STACKER = "reach_stacker"
    NASTRO_TRASPORTATORE = "nastro_trasportatore"
    POMPA = "pompa"
    COMPRESSORE = "compressore"
    MOTOPOMPA = "motopompa"
    ESCAVATORE = "escavatore"
    PALA_MECCANICA = "pala_meccanica"
    OTHER = "other"


class MachineryPowerSource(str, enum.Enum):
    ELETTRICO = "elettrico"
    DIESEL = "diesel"
    GPL = "gpl"
    IBRIDO = "ibrido"
    METANO = "metano"


class Concessionaire(Base):
    """Port concessionaire (concessionario portuale)."""
    __tablename__ = "deasp_concessionaires"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    ragione_sociale: Mapped[str] = mapped_column(String(500), nullable=False)
    port: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sede_legale: Mapped[str] = mapped_column(Text, nullable=True)
    persona_riferimento: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    telefono: Mapped[str] = mapped_column(String(50), nullable=True)
    pec: Mapped[str] = mapped_column(String(255), nullable=True)
    partita_iva: Mapped[str] = mapped_column(String(20), nullable=True)
    codice_fiscale: Mapped[str] = mapped_column(String(20), nullable=True)
    tipo_concessione: Mapped[str] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    questionnaires: Mapped[list["Questionnaire"]] = relationship(
        "Questionnaire", back_populates="concessionaire", cascade="all, delete-orphan"
    )


class Questionnaire(Base):
    """Questionnaire instance sent to a concessionaire for a specific year."""
    __tablename__ = "deasp_questionnaires"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concessionaire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_concessionaires.id"), nullable=False
    )
    deasp_inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_inventories.id"), nullable=True
    )
    reporting_year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[QuestionnaireStatus] = mapped_column(
        SAEnum(QuestionnaireStatus), default=QuestionnaireStatus.DRAFT
    )
    access_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline: Mapped[date] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_pct: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    concessionaire: Mapped["Concessionaire"] = relationship("Concessionaire", back_populates="questionnaires")
    response: Mapped["QuestionnaireResponse"] = relationship(
        "QuestionnaireResponse", back_populates="questionnaire", uselist=False, cascade="all, delete-orphan"
    )


class QuestionnaireResponse(Base):
    """Aggregated response data from a completed questionnaire."""
    __tablename__ = "deasp_questionnaire_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    questionnaire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_questionnaires.id"), nullable=False, unique=True
    )

    # Page 1 - Dati anagrafici (stored on concessionaire, reference only)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=True)

    # Page 3 - Elettricità (Scope 2) summary
    kwh_annui_totali: Mapped[float] = mapped_column(Float, nullable=True)
    percentuale_rinnovabile: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100
    numero_pod: Mapped[int] = mapped_column(Integer, nullable=True)
    has_certificati_go: Mapped[bool] = mapped_column(Boolean, default=False)
    certificati_go_path: Mapped[str] = mapped_column(String(500), nullable=True)

    # Calculated totals
    scope1_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    scope2_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    machinery_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    total_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)

    # Raw form data
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="response")
    energy_consumptions: Mapped[list["EnergyConsumption"]] = relationship(
        "EnergyConsumption", back_populates="response", cascade="all, delete-orphan"
    )
    vehicle_records: Mapped[list["VehicleRecord"]] = relationship(
        "VehicleRecord", back_populates="response", cascade="all, delete-orphan"
    )
    machinery_records: Mapped[list["MachineryRecord"]] = relationship(
        "MachineryRecord", back_populates="response", cascade="all, delete-orphan"
    )


class EnergyConsumption(Base):
    """Scope 1 energy consumption records (boilers, generators)."""
    __tablename__ = "deasp_energy_consumptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_questionnaire_responses.id"), nullable=False
    )
    equipment_type: Mapped[str] = mapped_column(String(100), nullable=False)  # caldaia, generatore
    fuel_type: Mapped[FuelTypeIT] = mapped_column(SAEnum(FuelTypeIT), nullable=False)
    annual_consumption: Mapped[float] = mapped_column(Float, nullable=False)
    consumption_unit: Mapped[str] = mapped_column(String(20), nullable=False)  # tep, litri, mc, kg
    hours_operation: Mapped[float] = mapped_column(Float, nullable=True)
    calculated_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    response: Mapped["QuestionnaireResponse"] = relationship("QuestionnaireResponse", back_populates="energy_consumptions")


class VehicleRecord(Base):
    """Scope 1 vehicle records for concessionaire fleet."""
    __tablename__ = "deasp_vehicle_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_questionnaire_responses.id"), nullable=False
    )
    targa: Mapped[str] = mapped_column(String(20), nullable=True)
    vehicle_type: Mapped[VehicleTypeIT] = mapped_column(SAEnum(VehicleTypeIT), nullable=False)
    fuel_type: Mapped[FuelTypeIT] = mapped_column(SAEnum(FuelTypeIT), nullable=False)
    km_annui: Mapped[float] = mapped_column(Float, nullable=False)
    consumo_litri: Mapped[float] = mapped_column(Float, nullable=True)
    calculated_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)

    response: Mapped["QuestionnaireResponse"] = relationship("QuestionnaireResponse", back_populates="vehicle_records")


class ElectricityConsumption(Base):
    """Scope 2 electricity consumption (stored separately for detail)."""
    __tablename__ = "deasp_electricity_consumptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_questionnaire_responses.id"), nullable=False
    )
    pod_number: Mapped[str] = mapped_column(String(50), nullable=True)
    kwh_annual: Mapped[float] = mapped_column(Float, nullable=False)
    provider: Mapped[str] = mapped_column(String(200), nullable=True)
    is_renewable: Mapped[bool] = mapped_column(Boolean, default=False)
    has_go_certificate: Mapped[bool] = mapped_column(Boolean, default=False)
    calculated_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)


class MachineryRecord(Base):
    """Machinery records (cranes, forklifts, conveyors)."""
    __tablename__ = "deasp_machinery_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_questionnaire_responses.id"), nullable=False
    )
    machinery_type: Mapped[MachineryTypeIT] = mapped_column(SAEnum(MachineryTypeIT), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    power_source: Mapped[MachineryPowerSource] = mapped_column(SAEnum(MachineryPowerSource), nullable=False)
    power_kw: Mapped[float] = mapped_column(Float, nullable=True)
    hours_annual: Mapped[float] = mapped_column(Float, nullable=False)
    fuel_consumption: Mapped[float] = mapped_column(Float, nullable=True)
    fuel_unit: Mapped[str] = mapped_column(String(20), nullable=True)  # litri, kwh, kg
    electric_pct: Mapped[float] = mapped_column(Float, default=0.0)  # For hybrids
    calculated_co2_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)

    response: Mapped["QuestionnaireResponse"] = relationship("QuestionnaireResponse", back_populates="machinery_records")
