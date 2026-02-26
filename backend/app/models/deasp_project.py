"""DEASP Project model for tracking emission reduction projects."""

import uuid
import enum
from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Text, Float, Integer, DateTime, Date,
    ForeignKey, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DEASPProject(Base):
    __tablename__ = "deasp_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Targets
    target_reduction_tonnes: Mapped[float] = mapped_column(Float, nullable=True)
    target_reduction_pct: Mapped[float] = mapped_column(Float, nullable=True)
    baseline_emissions_tonnes: Mapped[float] = mapped_column(Float, default=0.0)
    current_emissions_tonnes: Mapped[float] = mapped_column(Float, default=0.0)

    # Timeline
    start_date: Mapped[date] = mapped_column(Date, nullable=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus), default=ProjectStatus.PLANNING)

    # Team
    team_members: Mapped[dict] = mapped_column(JSON, nullable=True)  # [{"name": ..., "role": ...}]

    # Activity log
    activity_log: Mapped[dict] = mapped_column(JSON, nullable=True)  # [{"date": ..., "action": ..., "user": ...}]

    # Metadata
    ports_involved: Mapped[dict] = mapped_column(JSON, nullable=True)
    reporting_year: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="deasp_projects")

    @property
    def progress_pct(self) -> float:
        if not self.target_reduction_tonnes or self.target_reduction_tonnes == 0:
            return 0.0
        reduction = self.baseline_emissions_tonnes - self.current_emissions_tonnes
        return min(100.0, max(0.0, (reduction / self.target_reduction_tonnes) * 100))
