"""
Italian Emission Factor models with auto-update capability and full audit trail.

Supports factors from ISPRA, EMEP/EEA, IPCC, and MIT sources with
hierarchical priority selection and version tracking.
"""

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Float, Integer, DateTime,
    ForeignKey, Enum as SAEnum, JSON, Boolean, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ITFactorSource(str, enum.Enum):
    ISPRA = "ispra"
    EMEP_EEA = "emep_eea"
    IPCC = "ipcc"
    MIT = "mit"
    TERNA = "terna"
    GSE = "gse"
    CUSTOM_AZIENDA = "custom_azienda"
    ZES = "zes"


class ITFactorCategory(str, enum.Enum):
    NAVI = "navi"
    COMBUSTIBILI = "combustibili"
    ELETTRICITA = "elettricita"
    VEICOLI = "veicoli"
    MACCHINARI = "macchinari"
    RIFIUTI = "rifiuti"


class ITFactorPriority(str, enum.Enum):
    """Hierarchical priority for factor selection."""
    SPECIFICO_AZIENDA = "specifico_azienda"
    REGIONALE_ZES = "regionale_zes"
    NAZIONALE_ISPRA = "nazionale_ispra"
    EUROPEO_EMEP = "europeo_emep"
    GLOBALE_IPCC = "globale_ipcc"


class UpdateReason(str, enum.Enum):
    NORMATIVA = "normativa"
    AGGIORNAMENTO_ANNUALE = "aggiornamento_annuale"
    CORREZIONE = "correzione"
    ERRATA_CORRIGE = "errata_corrige"
    NUOVA_DIRETTIVA = "nuova_direttiva"
    MANUALE = "manuale"


class ItalianEmissionFactor(Base):
    """Italian-specific emission factor with priority-based selection."""
    __tablename__ = "deasp_italian_emission_factors"
    __table_args__ = (
        Index("ix_it_factor_lookup", "category", "subcategory", "year_valid_from"),
        Index("ix_it_factor_source", "source", "year_valid_from"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[ITFactorCategory] = mapped_column(SAEnum(ITFactorCategory), nullable=False, index=True)
    subcategory: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Factor value
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # tCO2/tep, tCO2/kWh, tCO2/t, etc.
    input_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # tep, kWh, litro, kg, t

    # Source and provenance
    source: Mapped[ITFactorSource] = mapped_column(SAEnum(ITFactorSource), nullable=False, index=True)
    source_reference: Mapped[str] = mapped_column(String(500), nullable=True)
    source_document: Mapped[str] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Priority
    priority: Mapped[ITFactorPriority] = mapped_column(
        SAEnum(ITFactorPriority), default=ITFactorPriority.NAZIONALE_ISPRA
    )

    # Validity
    year_valid_from: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    year_valid_to: Mapped[int] = mapped_column(Integer, nullable=True)  # NULL = still valid
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Region & applicability
    region: Mapped[str] = mapped_column(String(50), default="Italia")
    applicability: Mapped[dict] = mapped_column(JSON, nullable=True)  # Conditions for application

    # Confidence & uncertainty
    confidence_pct: Mapped[float] = mapped_column(Float, nullable=True)  # 0-100
    uncertainty_lower: Mapped[float] = mapped_column(Float, nullable=True)
    uncertainty_upper: Mapped[float] = mapped_column(Float, nullable=True)

    # Versioning
    superseded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_italian_emission_factors.id"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Metadata
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    updates: Mapped[list["ItalianFactorUpdate"]] = relationship(
        "ItalianFactorUpdate", back_populates="factor",
        foreign_keys="ItalianFactorUpdate.factor_id", cascade="all, delete-orphan",
    )


class ItalianFactorUpdate(Base):
    """Audit trail for Italian emission factor changes."""
    __tablename__ = "deasp_italian_factor_updates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    factor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_italian_emission_factors.id"), nullable=False
    )
    previous_value: Mapped[float] = mapped_column(Float, nullable=True)
    new_value: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, nullable=True)
    reason: Mapped[UpdateReason] = mapped_column(SAEnum(UpdateReason), nullable=False)
    reason_detail: Mapped[str] = mapped_column(Text, nullable=True)
    source_document: Mapped[str] = mapped_column(String(500), nullable=True)

    # Impact analysis
    impact_analysis: Mapped[dict] = mapped_column(JSON, nullable=True)
    affected_ports: Mapped[dict] = mapped_column(JSON, nullable=True)
    affected_concessionaires_count: Mapped[int] = mapped_column(Integer, nullable=True)

    updated_by: Mapped[str] = mapped_column(String(100), default="sistema")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    factor: Mapped["ItalianEmissionFactor"] = relationship(
        "ItalianEmissionFactor", back_populates="updates", foreign_keys=[factor_id]
    )


class FactorUpdateNotification(Base):
    """Notifications sent to users about factor updates."""
    __tablename__ = "deasp_factor_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    update_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deasp_italian_factor_updates.id"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info, warning, critical

    notified_users: Mapped[dict] = mapped_column(JSON, nullable=True)
    acknowledged_by: Mapped[dict] = mapped_column(JSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
