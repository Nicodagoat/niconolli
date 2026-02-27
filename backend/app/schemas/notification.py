from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class NotificationCreate(BaseModel):
    user_id: UUID
    notification_type: str
    severity: str = "info"
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    module: Optional[str] = None
    action_url: Optional[str] = None
    extra_data: Optional[dict] = None


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: str
    severity: str
    title: str
    message: str
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    module: Optional[str] = None
    action_url: Optional[str] = None
    extra_data: Optional[dict] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationCount(BaseModel):
    total: int
    unread: int
