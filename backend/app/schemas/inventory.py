from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date
from app.models.inventory import InventoryStatus, BoundaryApproach, GWPVersion


class InventoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    reporting_year: int = Field(..., ge=2000, le=2100)
    start_date: date
    end_date: date
    boundary_approach: BoundaryApproach = BoundaryApproach.OPERATIONAL_CONTROL
    gwp_version: GWPVersion = GWPVersion.AR6
    notes: Optional[str] = None
    base_year: Optional[int] = None


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[InventoryStatus] = None
    boundary_approach: Optional[BoundaryApproach] = None
    gwp_version: Optional[GWPVersion] = None
    notes: Optional[str] = None


class InventoryResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    reporting_year: int
    start_date: date
    end_date: date
    boundary_approach: BoundaryApproach
    gwp_version: GWPVersion
    status: InventoryStatus
    notes: Optional[str]
    base_year: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
