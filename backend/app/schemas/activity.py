from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date
from app.models.activity import Scope, ActivityUnit, DataQuality


class ActivityCreate(BaseModel):
    facility_id: Optional[UUID] = None
    scope: Scope
    category: str = Field(..., min_length=1, max_length=100)
    subcategory: Optional[str] = None
    description: Optional[str] = None
    activity_value: float = Field(..., gt=0)
    activity_unit: ActivityUnit
    fuel_type: Optional[str] = None
    source_detail: Optional[str] = None
    scope2_method: Optional[str] = None
    activity_date: date
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    data_quality: DataQuality = DataQuality.MEDIUM
    data_source: Optional[str] = None
    uncertainty_pct: Optional[float] = Field(None, ge=0, le=100)
    emission_factor_id: Optional[UUID] = None
    custom_metadata: Optional[dict] = None
    is_biogenic: bool = False


class ActivityUpdate(BaseModel):
    activity_value: Optional[float] = Field(None, gt=0)
    activity_unit: Optional[ActivityUnit] = None
    fuel_type: Optional[str] = None
    data_quality: Optional[DataQuality] = None
    data_source: Optional[str] = None
    emission_factor_id: Optional[UUID] = None
    description: Optional[str] = None


class ActivityResponse(BaseModel):
    id: UUID
    inventory_id: UUID
    facility_id: Optional[UUID]
    scope: Scope
    category: str
    subcategory: Optional[str]
    description: Optional[str]
    activity_value: float
    activity_unit: ActivityUnit
    fuel_type: Optional[str]
    source_detail: Optional[str]
    scope2_method: Optional[str]
    activity_date: date
    data_quality: DataQuality
    data_source: Optional[str]
    uncertainty_pct: Optional[float]
    emission_factor_id: Optional[UUID]
    is_biogenic: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkActivityUpload(BaseModel):
    activities: list[ActivityCreate]
