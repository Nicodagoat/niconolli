from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.emission_factor import FactorSource, FactorCategory


class EmissionFactorCreate(BaseModel):
    source: FactorSource = FactorSource.CUSTOM
    category: FactorCategory
    name: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    co2_factor: float = Field(..., ge=0)
    ch4_factor: float = 0.0
    n2o_factor: float = 0.0
    co2e_factor: float = Field(..., ge=0)
    hfc_factor: float = 0.0
    pfc_factor: float = 0.0
    sf6_factor: float = 0.0
    input_unit: str
    output_unit: str = "kg_co2e"
    region: Optional[str] = None
    year: int = Field(..., ge=1990, le=2100)
    gwp_version: str = "ar6"
    fuel_type: Optional[str] = None
    vehicle_type: Optional[str] = None
    waste_type: Optional[str] = None
    is_custom: bool = True


class EmissionFactorUpdate(BaseModel):
    co2_factor: Optional[float] = None
    ch4_factor: Optional[float] = None
    n2o_factor: Optional[float] = None
    co2e_factor: Optional[float] = None
    is_active: Optional[bool] = None


class EmissionFactorResponse(BaseModel):
    id: UUID
    source: FactorSource
    category: FactorCategory
    name: str
    description: Optional[str]
    co2_factor: float
    ch4_factor: float
    n2o_factor: float
    co2e_factor: float
    input_unit: str
    output_unit: str
    region: Optional[str]
    year: int
    gwp_version: str
    fuel_type: Optional[str]
    vehicle_type: Optional[str]
    is_active: bool
    is_custom: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmissionFactorSearch(BaseModel):
    category: Optional[FactorCategory] = None
    source: Optional[FactorSource] = None
    region: Optional[str] = None
    year: Optional[int] = None
    fuel_type: Optional[str] = None
    search_term: Optional[str] = None
