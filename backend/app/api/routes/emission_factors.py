from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.emission_factor import EmissionFactor, FactorSource, FactorCategory
from app.schemas.emission_factor import (
    EmissionFactorCreate, EmissionFactorUpdate, EmissionFactorResponse,
)
from app.services.factor_manager import FactorManager

router = APIRouter(prefix="/emission-factors", tags=["Emission Factors"])


@router.get("/", response_model=list[EmissionFactorResponse])
async def list_emission_factors(
    category: Optional[str] = None,
    source: Optional[str] = None,
    region: Optional[str] = None,
    year: Optional[int] = None,
    fuel_type: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    manager = FactorManager(db)
    factors = await manager.search_factors(
        category=category, source=source, region=region,
        year=year, fuel_type=fuel_type, search_term=search,
    )
    return factors


@router.get("/{factor_id}", response_model=EmissionFactorResponse)
async def get_emission_factor(factor_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmissionFactor).where(EmissionFactor.id == factor_id))
    factor = result.scalar_one_or_none()
    if not factor:
        raise HTTPException(status_code=404, detail="Emission factor not found")
    return factor


@router.post("/", response_model=EmissionFactorResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_factor(
    factor_data: EmissionFactorCreate,
    db: AsyncSession = Depends(get_db),
):
    factor = EmissionFactor(**factor_data.model_dump())
    db.add(factor)
    await db.flush()
    await db.refresh(factor)
    return factor


@router.patch("/{factor_id}", response_model=EmissionFactorResponse)
async def update_emission_factor(
    factor_id: UUID,
    update_data: EmissionFactorUpdate,
    db: AsyncSession = Depends(get_db),
):
    manager = FactorManager(db)

    if update_data.co2e_factor is not None:
        factor = await manager.update_factor(factor_id, update_data.co2e_factor, "Manual update")
    else:
        result = await db.execute(select(EmissionFactor).where(EmissionFactor.id == factor_id))
        factor = result.scalar_one_or_none()
        if not factor:
            raise HTTPException(status_code=404, detail="Emission factor not found")
        for field, value in update_data.model_dump(exclude_unset=True).items():
            setattr(factor, field, value)
        await db.flush()

    await db.refresh(factor)
    return factor


@router.get("/{factor_id}/history")
async def get_factor_history(factor_id: UUID, db: AsyncSession = Depends(get_db)):
    manager = FactorManager(db)
    versions = await manager.get_factor_history(factor_id)
    return [
        {
            "version": v.version,
            "old_value": v.co2e_factor_old,
            "new_value": v.co2e_factor_new,
            "change_pct": v.change_pct,
            "reason": v.change_reason,
            "changed_by": v.changed_by,
            "changed_at": v.changed_at.isoformat(),
        }
        for v in versions
    ]


@router.post("/seed-defaults", response_model=dict)
async def seed_default_factors(db: AsyncSession = Depends(get_db)):
    manager = FactorManager(db)
    count = await manager.seed_default_factors()
    return {"seeded": count, "message": f"Loaded {count} default emission factors"}
