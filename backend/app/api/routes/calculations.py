from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.calculation import CalculationResult
from app.models.activity import Activity
from app.schemas.calculation import CalculationResultResponse, InventorySummary, EmissionsTrend, ScopeBreakdown
from app.services.calculation_engine import CalculationEngine

router = APIRouter(prefix="/calculations", tags=["Calculations"])


@router.post("/{inventory_id}/calculate", response_model=dict)
async def calculate_inventory(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    engine = CalculationEngine(db)
    try:
        results = await engine.calculate_inventory(inventory_id)
        return {
            "status": "success",
            "calculated": len(results),
            "total_co2e_tonnes": sum(r.total_co2e_tonnes for r in results),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{inventory_id}/results", response_model=list[CalculationResultResponse])
async def get_calculation_results(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CalculationResult)
        .where(CalculationResult.inventory_id == inventory_id)
        .order_by(CalculationResult.scope, CalculationResult.category)
    )
    return result.scalars().all()


@router.get("/{inventory_id}/summary")
async def get_inventory_summary(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    engine = CalculationEngine(db)
    return await engine.get_inventory_summary(inventory_id)


@router.get("/{inventory_id}/breakdown")
async def get_scope_breakdown(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            CalculationResult.scope,
            CalculationResult.category,
            func.sum(CalculationResult.total_co2e_tonnes).label("total"),
            func.count(CalculationResult.id).label("count"),
        )
        .where(CalculationResult.inventory_id == inventory_id)
        .group_by(CalculationResult.scope, CalculationResult.category)
        .order_by(CalculationResult.scope)
    )
    rows = result.all()
    grand_total = sum(r.total for r in rows) if rows else 1

    return [
        {
            "scope": r.scope,
            "category": r.category,
            "total_co2e_tonnes": round(r.total, 4),
            "percentage": round(r.total / grand_total * 100, 1) if grand_total > 0 else 0,
            "activity_count": r.count,
        }
        for r in rows
    ]


@router.get("/{inventory_id}/trends")
async def get_emission_trends(
    inventory_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get monthly emission trends for an inventory."""
    result = await db.execute(
        select(Activity, CalculationResult)
        .join(CalculationResult, CalculationResult.activity_id == Activity.id)
        .where(CalculationResult.inventory_id == inventory_id)
        .order_by(Activity.activity_date)
    )
    rows = result.all()

    monthly_data = {}
    for activity, calc in rows:
        month_key = activity.activity_date.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {"scope_1": 0.0, "scope_2": 0.0, "scope_3": 0.0}
        monthly_data[month_key][calc.scope] += calc.total_co2e_tonnes

    return [
        {
            "period": period,
            "scope_1": round(data["scope_1"], 4),
            "scope_2": round(data["scope_2"], 4),
            "scope_3": round(data["scope_3"], 4),
            "total": round(sum(data.values()), 4),
        }
        for period, data in sorted(monthly_data.items())
    ]
