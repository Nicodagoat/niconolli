from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        organization_id=user_data.organization_id,
        role=UserRole.SME_USER,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login")
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    user.last_login = datetime.now(timezone.utc)
    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    refresh_token = create_access_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=7),
    )

    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "must_change_password": user.must_change_password,
            "organization_id": str(user.organization_id) if user.organization_id else None,
        },
    }


@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    from app.core.security import decode_access_token
    payload = decode_access_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    new_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    return {"access_token": new_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/setup-admin", response_model=dict)
async def setup_initial_admin(db: AsyncSession = Depends(get_db)):
    """Create the initial admin user if no users exist. Only works once."""
    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Admin user already exists")

    admin = User(
        email="admin@ghgplatform.local",
        hashed_password=get_password_hash("admin123!"),
        full_name="Platform Administrator",
        role=UserRole.ADMIN,
    )
    db.add(admin)
    await db.flush()
    return {
        "status": "created",
        "email": "admin@ghgplatform.local",
        "message": "Initial admin created. Use the default credentials to log in and change your password immediately.",
    }
