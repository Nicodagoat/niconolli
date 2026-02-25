from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization, Facility
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    FacilityCreate, FacilityResponse,
)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate, db: AsyncSession = Depends(get_db)
):
    org = Organization(**org_data.model_dump())
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


@router.get("/", response_model=list[OrganizationResponse])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).order_by(Organization.name))
    return result.scalars().all()


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID, update_data: OrganizationUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return org


# Facilities
@router.post("/{org_id}/facilities", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
async def create_facility(
    org_id: UUID, facility_data: FacilityCreate, db: AsyncSession = Depends(get_db)
):
    facility = Facility(organization_id=org_id, **facility_data.model_dump())
    db.add(facility)
    await db.flush()
    await db.refresh(facility)
    return facility


@router.get("/{org_id}/facilities", response_model=list[FacilityResponse])
async def list_facilities(org_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Facility).where(Facility.organization_id == org_id).order_by(Facility.name)
    )
    return result.scalars().all()
