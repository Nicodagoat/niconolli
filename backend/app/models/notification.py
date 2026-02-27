"""
Platform-wide notification model.

Supports notification types for both SME and DEASP modules,
including project updates, calculation results, validation errors,
and system events.
"""

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class NotificationType(str, enum.Enum):
    PROJECT_CREATED = "project_created"
    PROJECT_ASSIGNED = "project_assigned"
    PROJECT_STATUS_CHANGED = "project_status_changed"
    CALCULATION_COMPLETED = "calculation_completed"
    CALCULATION_ERROR = "calculation_error"
    DATA_VALIDATION_ERROR = "data_validation_error"
    REVIEW_REQUIRED = "review_required"
    DEADLINE_APPROACHING = "deadline_approaching"
    QUESTIONNAIRE_RECEIVED = "questionnaire_received"
    QUESTIONNAIRE_REMINDER = "questionnaire_reminder"
    FACTOR_UPDATED = "factor_updated"
    USER_INVITED = "user_invited"
    SYSTEM_MAINTENANCE = "system_maintenance"
    COMMENT_MENTION = "comment_mention"


class NotificationSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    notification_type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType), nullable=False, index=True)
    severity: Mapped[NotificationSeverity] = mapped_column(
        SAEnum(NotificationSeverity), default=NotificationSeverity.INFO
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Link to related entity
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)  # project, inventory, questionnaire, etc.
    entity_id: Mapped[str] = mapped_column(String(100), nullable=True)

    # Module context
    module: Mapped[str] = mapped_column(String(20), nullable=True)  # sme, deasp, system

    # Extra metadata
    extra_data: Mapped[dict] = mapped_column("extra_data", JSON, nullable=True)
    action_url: Mapped[str] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
