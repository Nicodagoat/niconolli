from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class CalculationResultResponse(BaseModel):
    id: UUID
    inventory_id: UUID
    activity_id: UUID
    scope: str
    category: str
    subcategory: Optional[str]
    co2_kg: float
    ch4_kg: float
    n2o_kg: float
    total_co2e_kg: float
    total_co2e_tonnes: float
    biogenic_co2_kg: float
    uncertainty_pct: Optional[float]
    data_quality: Optional[str]
    emission_factor_used: Optional[str]
    emission_factor_value: Optional[float]
    gwp_version: Optional[str]
    calculated_at: datetime

    model_config = {"from_attributes": True}


class InventorySummary(BaseModel):
    inventory_id: UUID
    reporting_year: int
    total_co2e_tonnes: float
    scope_1_tonnes: float
    scope_2_tonnes: float
    scope_3_tonnes: float
    scope_1_categories: dict[str, float]
    scope_2_categories: dict[str, float]
    scope_3_categories: dict[str, float]
    intensity_per_employee: Optional[float] = None
    intensity_per_revenue: Optional[float] = None
    data_quality_breakdown: dict[str, int]
    activity_count: int


class EmissionsTrend(BaseModel):
    period: str
    scope_1: float
    scope_2: float
    scope_3: float
    total: float


class ScopeBreakdown(BaseModel):
    scope: str
    category: str
    total_co2e_tonnes: float
    percentage: float
    activity_count: int
