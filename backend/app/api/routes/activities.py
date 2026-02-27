from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.activity import Activity, Scope
from app.schemas.activity import ActivityCreate, ActivityUpdate, ActivityResponse, BulkActivityUpload
from app.services.csv_importer import CSVImporter

router = APIRouter(prefix="/activities", tags=["Activities"])


@router.post("/{inventory_id}", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    inventory_id: UUID,
    activity_data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
):
    activity = Activity(inventory_id=inventory_id, **activity_data.model_dump())
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.post("/{inventory_id}/bulk", response_model=dict)
async def bulk_create_activities(
    inventory_id: UUID,
    bulk_data: BulkActivityUpload,
    db: AsyncSession = Depends(get_db),
):
    created = []
    for act_data in bulk_data.activities:
        activity = Activity(inventory_id=inventory_id, **act_data.model_dump())
        db.add(activity)
        created.append(activity)
    await db.flush()
    return {"created": len(created), "message": f"Successfully created {len(created)} activities"}


@router.post("/{inventory_id}/upload-csv", response_model=dict)
async def upload_csv(
    inventory_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = (await file.read()).decode("utf-8")
    importer = CSVImporter()
    activities, errors = importer.parse_csv(content)

    if errors:
        return {
            "status": "partial" if activities else "error",
            "valid_count": len(activities),
            "error_count": len(errors),
            "errors": [e.to_dict() for e in errors[:50]],
        }

    created = []
    for act_data in activities:
        activity = Activity(inventory_id=inventory_id, **act_data.model_dump())
        db.add(activity)
        created.append(activity)
    await db.flush()

    return {
        "status": "success",
        "created": len(created),
        "message": f"Successfully imported {len(created)} activities",
    }


@router.get("/template", response_class=PlainTextResponse)
async def get_csv_template():
    importer = CSVImporter()
    return PlainTextResponse(
        content=importer.generate_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_template.csv"},
    )


@router.get("/{inventory_id}", response_model=list[ActivityResponse])
async def list_activities(
    inventory_id: UUID,
    scope: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Activity).where(Activity.inventory_id == inventory_id)
    if scope:
        query = query.where(Activity.scope == scope)
    if category:
        query = query.where(Activity.category == category)
    query = query.order_by(Activity.scope, Activity.category, Activity.activity_date)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/detail/{activity_id}", response_model=ActivityResponse)
async def get_activity(activity_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.patch("/detail/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    update_data: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)

    await db.flush()
    await db.refresh(activity)
    return activity


@router.delete("/detail/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(activity_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
