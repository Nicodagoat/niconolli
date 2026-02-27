"""Pydantic schemas for Client and DEASP Project."""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


# --- Client ---

class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    country: str = "ITA"
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    contact_name: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]
    country: str
    status: str
    total_scope1_tonnes: float
    total_scope2_tonnes: float
    total_scope3_tonnes: float
    total_co2e_tonnes: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientEmissions(BaseModel):
    client_id: UUID
    client_name: str
    total_co2e_tonnes: float
    scope_1_tonnes: float
    scope_2_tonnes: float
    scope_3_tonnes: float


# --- DEASP Project ---

class DEASPProjectCreate(BaseModel):
    client_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_reduction_tonnes: Optional[float] = None
    target_reduction_pct: Optional[float] = None
    baseline_emissions_tonnes: float = 0.0
    current_emissions_tonnes: float = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_members: Optional[list[dict]] = None
    ports_involved: Optional[list[str]] = None
    reporting_year: Optional[int] = None


class DEASPProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_reduction_tonnes: Optional[float] = None
    target_reduction_pct: Optional[float] = None
    baseline_emissions_tonnes: Optional[float] = None
    current_emissions_tonnes: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    team_members: Optional[list[dict]] = None
    ports_involved: Optional[list[str]] = None


class DEASPProjectResponse(BaseModel):
    id: UUID
    client_id: UUID
    name: str
    description: Optional[str]
    target_reduction_tonnes: Optional[float]
    target_reduction_pct: Optional[float]
    baseline_emissions_tonnes: float
    current_emissions_tonnes: float
    start_date: Optional[date]
    end_date: Optional[date]
    status: str
    team_members: Optional[list[dict]]
    activity_log: Optional[list[dict]]
    ports_involved: Optional[list[str]]
    reporting_year: Optional[int]
    progress_pct: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DEASPProjectProgress(BaseModel):
    project_id: UUID
    project_name: str
    baseline_emissions: float
    current_emissions: float
    target_reduction: float
    progress_pct: float
    status: str


# --- Dashboard ---

class DashboardSummary(BaseModel):
    total_clients: int
    active_clients: int
    total_emissions_tonnes: float
    total_projects: int
    active_projects: int
    clients: list[ClientResponse]
    projects: list[DEASPProjectResponse]
