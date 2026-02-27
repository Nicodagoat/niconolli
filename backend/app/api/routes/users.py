"""
User management API routes.

Admin-only endpoints for:
- Inviting users by email with role assignment
- Listing/updating/deactivating users
- Password reset
"""

import secrets
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.deps import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType, NotificationSeverity
from app.schemas.user import UserInvite, UserUpdate, UserListResponse, PasswordChange
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("/", response_model=list[UserListResponse])
async def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        query = query.where(
            (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/invite", response_model=dict, status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: UserInvite,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Invite a new user by email. Generates a temporary password."""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate temporary password
    temp_password = secrets.token_urlsafe(12)

    user = User(
        email=data.email,
        hashed_password=get_password_hash(temp_password),
        full_name=data.full_name,
        role=data.role,
        organization_id=data.organization_id,
        must_change_password=True,
        invited_by=admin.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Create notification for the new user
    notif = Notification(
        user_id=user.id,
        notification_type=NotificationType.USER_INVITED,
        severity=NotificationSeverity.INFO,
        title="Welcome to GHG Emissions Platform",
        message=f"You have been invited by {admin.full_name}. Please change your password on first login.",
        module="system",
    )
    db.add(notif)

    return {
        "status": "invited",
        "user_id": str(user.id),
        "email": user.email,
        "temporary_password": temp_password,
        "role": user.role.value,
        "message": f"User created. Temporary password: {temp_password}",
    }


@router.get("/me", response_model=UserListResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user),
):
    return user


@router.patch("/me/password", response_model=dict)
async def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.core.security import verify_password
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = get_password_hash(data.new_password)
    user.must_change_password = False
    return {"status": "password_changed"}


@router.get("/{user_id}", response_model=UserListResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.organization_id is not None:
        user.organization_id = data.organization_id

    await db.flush()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=dict)
async def admin_reset_password(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin resets a user's password to a new temporary one."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = secrets.token_urlsafe(12)
    user.hashed_password = get_password_hash(temp_password)
    user.must_change_password = True

    return {
        "status": "password_reset",
        "temporary_password": temp_password,
        "message": f"Password reset for {user.email}. New temporary password: {temp_password}",
    }
