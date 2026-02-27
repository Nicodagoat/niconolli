"""
Notification API routes.

Provides endpoints for the internal notification system:
- List notifications for current user
- Get unread count
- Mark as read / mark all as read
"""

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification, NotificationType, NotificationSeverity
from app.schemas.notification import NotificationResponse, NotificationCount

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    module: str = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    if module:
        query = query.where(Notification.module == module)
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count", response_model=NotificationCount)
async def get_notification_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count(Notification.id)).where(Notification.user_id == user.id)
    )).scalar() or 0
    unread = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )).scalar() or 0
    return NotificationCount(total=total, unread=unread)


@router.post("/{notif_id}/read", response_model=dict)
async def mark_notification_read(
    notif_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    return {"status": "read"}


@router.post("/read-all", response_model=dict)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification).where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        ).values(is_read=True, read_at=now)
    )
    return {"status": "all_read"}


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: str,
    severity: str = "info",
    entity_type: str = None,
    entity_id: str = None,
    module: str = None,
    action_url: str = None,
    extra_data: dict = None,
) -> Notification:
    """Utility function to create a notification from anywhere in the app."""
    notif = Notification(
        user_id=user_id,
        notification_type=NotificationType(notification_type),
        severity=NotificationSeverity(severity),
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        module=module,
        action_url=action_url,
        extra_data=extra_data,
    )
    db.add(notif)
    await db.flush()
    return notif
