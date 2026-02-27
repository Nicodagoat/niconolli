from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.report_generator import ReportGenerator

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{inventory_id}/ghg-protocol")
async def ghg_protocol_report(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    generator = ReportGenerator(db)
    return await generator.generate_ghg_protocol_report(inventory_id)


@router.get("/{inventory_id}/cdp")
async def cdp_report(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    generator = ReportGenerator(db)
    return await generator.generate_cdp_format(inventory_id)


@router.get("/{inventory_id}/export/calculations-csv")
async def export_calculations_csv(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    generator = ReportGenerator(db)
    csv_content = await generator.generate_csv_export(inventory_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=emissions_{inventory_id}.csv"},
    )


@router.get("/{inventory_id}/export/activities-csv")
async def export_activities_csv(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    generator = ReportGenerator(db)
    csv_content = await generator.generate_activity_export(inventory_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=activities_{inventory_id}.csv"},
    )
