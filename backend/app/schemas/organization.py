from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.organization import IndustryType


class FacilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    country: str = Field(..., min_length=2, max_length=3)
    postal_code: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    facility_type: Optional[str] = None
    egrid_subregion: Optional[str] = None


class FacilityResponse(FacilityCreate):
    id: UUID
    organization_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: IndustryType
    country: str = Field(..., min_length=2, max_length=3)
    description: Optional[str] = None
    employee_count: Optional[int] = Field(None, gt=0)
    annual_revenue: Optional[float] = Field(None, ge=0)
    revenue_currency: str = "USD"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[IndustryType] = None
    description: Optional[str] = None
    employee_count: Optional[int] = None
    annual_revenue: Optional[float] = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    industry: IndustryType
    country: str
    description: Optional[str]
    employee_count: Optional[int]
    annual_revenue: Optional[float]
    revenue_currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
