from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.inventory import Inventory
from app.schemas.inventory import InventoryCreate, InventoryUpdate, InventoryResponse

router = APIRouter(prefix="/inventories", tags=["Inventories"])


@router.post("/", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory(
    org_id: UUID,
    inv_data: InventoryCreate,
    db: AsyncSession = Depends(get_db),
):
    inventory = Inventory(organization_id=org_id, **inv_data.model_dump())
    db.add(inventory)
    await db.flush()
    await db.refresh(inventory)
    return inventory


@router.get("/", response_model=list[InventoryResponse])
async def list_inventories(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Inventory)
        .where(Inventory.organization_id == org_id)
        .order_by(Inventory.reporting_year.desc())
    )
    return result.scalars().all()


@router.get("/{inventory_id}", response_model=InventoryResponse)
async def get_inventory(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inventory).where(Inventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return inventory


@router.patch("/{inventory_id}", response_model=InventoryResponse)
async def update_inventory(
    inventory_id: UUID,
    update_data: InventoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Inventory).where(Inventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(inventory, field, value)

    await db.flush()
    await db.refresh(inventory)
    return inventory


@router.delete("/{inventory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory(inventory_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inventory).where(Inventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    await db.delete(inventory)
