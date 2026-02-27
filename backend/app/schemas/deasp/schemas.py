"""Pydantic schemas for DEASP Italia module."""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


# --- DEASP Inventory ---

class DEASPInventoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    reporting_year: int = Field(..., ge=2020, le=2100)
    port_authority_name: Optional[str] = None
    ports_included: Optional[list[str]] = None
    notes: Optional[str] = None


class DEASPInventoryResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    reporting_year: int
    port_authority_name: Optional[str]
    ports_included: Optional[list[str]]
    status: str
    total_ship_co2_tonnes: Optional[float]
    total_concessionaire_co2_tonnes: Optional[float]
    grand_total_co2_tonnes: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Concessionaire ---

class ConcessionaireCreate(BaseModel):
    ragione_sociale: str = Field(..., min_length=1)
    port: str
    sede_legale: Optional[str] = None
    persona_riferimento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    pec: Optional[str] = None
    partita_iva: Optional[str] = None
    tipo_concessione: Optional[str] = None


class ConcessionaireResponse(BaseModel):
    id: UUID
    ragione_sociale: str
    port: str
    persona_riferimento: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Questionnaire ---

class QuestionnaireCreate(BaseModel):
    concessionaire_id: UUID
    reporting_year: int
    deadline: Optional[date] = None


class QuestionnaireSendRequest(BaseModel):
    questionnaire_ids: list[UUID]


class QuestionnaireStatusResponse(BaseModel):
    id: UUID
    concessionaire_name: str
    port: str
    status: str
    completion_pct: float
    sent_at: Optional[datetime]
    completed_at: Optional[datetime]
    deadline: Optional[date]

    model_config = {"from_attributes": True}


# --- Questionnaire Response Data ---

class EnergyConsumptionInput(BaseModel):
    equipment_type: str  # caldaia, generatore
    fuel_type: str  # gasolio, metano, gpl, etc.
    annual_consumption: float = Field(..., gt=0)
    consumption_unit: str  # tep, litri, mc, kg
    hours_operation: Optional[float] = None
    notes: Optional[str] = None


class VehicleRecordInput(BaseModel):
    targa: Optional[str] = None
    vehicle_type: str
    fuel_type: str
    km_annui: float = Field(..., gt=0)
    consumo_litri: Optional[float] = None


class MachineryRecordInput(BaseModel):
    machinery_type: str
    description: Optional[str] = None
    power_source: str  # elettrico, diesel, gpl, ibrido
    power_kw: Optional[float] = None
    hours_annual: float = Field(..., gt=0)
    fuel_consumption: Optional[float] = None
    fuel_unit: Optional[str] = None
    electric_pct: float = 0.0  # For hybrids


class QuestionnaireSubmission(BaseModel):
    """Full questionnaire submission from a concessionaire."""
    # Page 1 - Contact
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None

    # Page 2 - Scope 1 Energy
    energy_consumptions: list[EnergyConsumptionInput] = []
    vehicles: list[VehicleRecordInput] = []

    # Page 3 - Scope 2 Electricity
    kwh_annui_totali: Optional[float] = None
    percentuale_rinnovabile: float = 0.0
    numero_pod: Optional[int] = None
    has_certificati_go: bool = False

    # Page 4 - Machinery
    machinery: list[MachineryRecordInput] = []


# --- Italian Factors ---

class ItalianFactorResponse(BaseModel):
    id: UUID
    category: str
    subcategory: str
    name: str
    value: float
    unit: str
    input_unit: str
    source: str
    source_reference: Optional[str]
    priority: str
    year_valid_from: int
    year_valid_to: Optional[int]
    region: str
    confidence_pct: Optional[float]
    is_active: bool
    version: int
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ItalianFactorUpdateRequest(BaseModel):
    new_value: float = Field(..., gt=0)
    reason: str  # normativa, aggiornamento_annuale, correzione, etc.
    reason_detail: str
    source_document: Optional[str] = None
    affected_ports: Optional[list[str]] = None


class FactorUpdateHistoryResponse(BaseModel):
    id: UUID
    previous_value: Optional[float]
    new_value: float
    change_pct: Optional[float]
    reason: str
    reason_detail: Optional[str]
    updated_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    severity: str
    is_read: bool
    sent_at: datetime

    model_config = {"from_attributes": True}


# --- Dashboard ---

class DEASPDashboardStats(BaseModel):
    emissioni_totali_tCO2: float
    fattori_attivi: int
    fattori_aggiornati_mese: int
    concessionari_rispondenti_pct: float
    notifiche_non_lette: int
    prossimo_aggiornamento_ispra: Optional[str] = None
