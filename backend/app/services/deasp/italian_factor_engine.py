"""
Intelligent Italian Emission Factor Engine

Implements hierarchical priority-based factor selection:
1. specifico_azienda  - Certified company-specific factors
2. regionale_zes      - ZES (Special Economic Zone) factors
3. nazionale_ispra    - ISPRA national factors
4. europeo_emep       - EMEP/EEA European factors
5. globale_ipcc       - IPCC global defaults

Every selection is logged for complete audit trail.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.deasp.italian_factor import (
    ItalianEmissionFactor, ItalianFactorUpdate, FactorUpdateNotification,
    ITFactorCategory, ITFactorSource, ITFactorPriority, UpdateReason,
)
from app.models.audit import AuditLog

logger = logging.getLogger(__name__)

# Priority order for factor selection (highest to lowest)
PRIORITY_ORDER = [
    ITFactorPriority.SPECIFICO_AZIENDA,
    ITFactorPriority.REGIONALE_ZES,
    ITFactorPriority.NAZIONALE_ISPRA,
    ITFactorPriority.EUROPEO_EMEP,
    ITFactorPriority.GLOBALE_IPCC,
]


class ItalianFactorEngine:
    """Intelligent emission factor selection and management for Italian ports."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_emission_factor(
        self,
        category: str,
        subcategory: str,
        year: int,
        region: str = "Italia",
        context: Optional[dict] = None,
    ) -> tuple[Optional[ItalianEmissionFactor], str]:
        """
        Select the most appropriate emission factor using hierarchical priority.

        Returns: (factor, selection_reason)
        """
        context = context or {}

        # Build base query for matching factors
        base_conditions = [
            ItalianEmissionFactor.category == category,
            ItalianEmissionFactor.subcategory == subcategory,
            ItalianEmissionFactor.is_active == True,  # noqa: E712
            ItalianEmissionFactor.year_valid_from <= year,
        ]

        # Year validity: either no end year (still valid) or ends after requested year
        year_condition = (
            (ItalianEmissionFactor.year_valid_to == None) |  # noqa: E711
            (ItalianEmissionFactor.year_valid_to >= year)
        )

        # Try each priority level in order
        for priority in PRIORITY_ORDER:
            query = (
                select(ItalianEmissionFactor)
                .where(
                    and_(*base_conditions, year_condition),
                    ItalianEmissionFactor.priority == priority,
                )
                .order_by(ItalianEmissionFactor.year_valid_from.desc())
                .limit(1)
            )

            # For company-specific factors, check context
            if priority == ITFactorPriority.SPECIFICO_AZIENDA:
                concessionaire_id = context.get("concessionaire_id")
                if not concessionaire_id:
                    continue

            # For ZES factors, check if port is in ZES
            if priority == ITFactorPriority.REGIONALE_ZES:
                port = context.get("port")
                if not port or port not in _ZES_PORTS:
                    continue

            result = await self.db.execute(query)
            factor = result.scalar_one_or_none()

            if factor:
                reason = f"Selezionato fattore {priority.value}: {factor.source.value} {factor.year_valid_from}"
                await self._log_selection(factor, category, subcategory, year, reason, context)
                return factor, reason

        return None, f"Nessun fattore trovato per {category}/{subcategory} anno {year}"

    async def update_factor(
        self,
        factor_id: UUID,
        new_value: float,
        reason: UpdateReason,
        reason_detail: str,
        source_document: Optional[str] = None,
        updated_by: str = "sistema",
        affected_ports: Optional[list] = None,
    ) -> ItalianEmissionFactor:
        """Update an Italian emission factor with full audit trail."""
        result = await self.db.execute(
            select(ItalianEmissionFactor).where(ItalianEmissionFactor.id == factor_id)
        )
        factor = result.scalar_one()

        old_value = factor.value
        change_pct = ((new_value - old_value) / old_value * 100) if old_value != 0 else 100.0

        # Create update record
        update = ItalianFactorUpdate(
            factor_id=factor_id,
            previous_value=old_value,
            new_value=new_value,
            change_pct=change_pct,
            reason=reason,
            reason_detail=reason_detail,
            source_document=source_document,
            updated_by=updated_by,
            affected_ports={"ports": affected_ports or []},
            impact_analysis={
                "change_pct": round(change_pct, 2),
                "direction": "aumento" if change_pct > 0 else "diminuzione",
                "category": factor.category.value,
                "subcategory": factor.subcategory,
            },
        )
        self.db.add(update)

        # Update the factor
        factor.value = new_value
        factor.version += 1
        factor.updated_at = datetime.now(timezone.utc)

        # Log to audit trail
        audit = AuditLog(
            entity_type="deasp_italian_emission_factor",
            entity_id=str(factor_id),
            action="update",
            user_email=updated_by,
            changes={"value": {"old": old_value, "new": new_value}},
            previous_values={"value": old_value, "version": factor.version - 1},
            notes=f"Aggiornamento {reason.value}: {reason_detail}",
        )
        self.db.add(audit)

        await self.db.flush()

        logger.info(
            f"Fattore '{factor.name}' aggiornato: {old_value} → {new_value} "
            f"({change_pct:+.1f}%) - {reason.value}"
        )

        return factor

    async def create_notification(
        self,
        update_id: UUID,
        organization_id: UUID,
        factor: ItalianEmissionFactor,
        old_value: float,
        new_value: float,
        change_pct: float,
        affected_ports: Optional[list] = None,
    ) -> FactorUpdateNotification:
        """Create a notification for a factor update."""
        direction = "diminuito" if change_pct < 0 else "aumentato"
        severity = "critical" if abs(change_pct) > 10 else "warning" if abs(change_pct) > 5 else "info"

        title = f"Aggiornamento fattore {factor.category.value}: {factor.name}"
        message = (
            f"Il fattore di emissione per [{factor.category.value.upper()}] "
            f"'{factor.name}' è stato aggiornato:\n\n"
            f"- Valore precedente: {old_value} {factor.unit} ({factor.source.value} {factor.year_valid_from})\n"
            f"- Nuovo valore: {new_value} {factor.unit}\n"
            f"- Variazione: {change_pct:+.1f}% ({direction})\n"
            f"- Fonte: {factor.source_reference or factor.source.value}\n"
        )

        if affected_ports:
            message += f"\nPorti interessati: {', '.join(affected_ports)}\n"

        message += (
            "\nAzioni consigliate:\n"
            "- Ricalcola inventario con nuovi fattori\n"
            "- Rivedi report già generati\n"
            "- Confronta impatto sulle emissioni totali"
        )

        notification = FactorUpdateNotification(
            update_id=update_id,
            organization_id=organization_id,
            title=title,
            message=message,
            severity=severity,
        )
        self.db.add(notification)
        await self.db.flush()
        return notification

    async def get_active_factors(self, year: Optional[int] = None) -> list[ItalianEmissionFactor]:
        """Get all currently active Italian emission factors."""
        query = select(ItalianEmissionFactor).where(
            ItalianEmissionFactor.is_active == True  # noqa: E712
        )
        if year:
            query = query.where(
                ItalianEmissionFactor.year_valid_from <= year,
                (ItalianEmissionFactor.year_valid_to == None) |  # noqa: E711
                (ItalianEmissionFactor.year_valid_to >= year),
            )
        query = query.order_by(
            ItalianEmissionFactor.category,
            ItalianEmissionFactor.subcategory,
            ItalianEmissionFactor.year_valid_from.desc(),
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_factor_history(self, factor_id: UUID) -> list[ItalianFactorUpdate]:
        """Get complete change history for a factor."""
        result = await self.db.execute(
            select(ItalianFactorUpdate)
            .where(ItalianFactorUpdate.factor_id == factor_id)
            .order_by(ItalianFactorUpdate.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_notifications(
        self,
        organization_id: UUID,
        unread_only: bool = False,
    ) -> list[FactorUpdateNotification]:
        """Get factor update notifications for an organization."""
        query = select(FactorUpdateNotification).where(
            FactorUpdateNotification.organization_id == organization_id
        )
        if unread_only:
            query = query.where(FactorUpdateNotification.is_read == False)  # noqa: E712
        query = query.order_by(FactorUpdateNotification.sent_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_factor_source_distribution(self) -> dict:
        """Get distribution of factor sources (for dashboard visualization)."""
        result = await self.db.execute(
            select(
                ItalianEmissionFactor.source,
                func.count(ItalianEmissionFactor.id).label("count"),
            )
            .where(ItalianEmissionFactor.is_active == True)  # noqa: E712
            .group_by(ItalianEmissionFactor.source)
        )
        rows = result.all()
        total = sum(r.count for r in rows)
        return {
            r.source.value: {"count": r.count, "pct": round(r.count / total * 100, 1) if total > 0 else 0}
            for r in rows
        }

    async def _log_selection(
        self,
        factor: ItalianEmissionFactor,
        category: str,
        subcategory: str,
        year: int,
        reason: str,
        context: dict,
    ):
        """Log factor selection for audit trail."""
        audit = AuditLog(
            entity_type="deasp_factor_selection",
            entity_id=str(factor.id),
            action="select",
            changes={
                "category": category,
                "subcategory": subcategory,
                "year": year,
                "factor_value": factor.value,
                "factor_source": factor.source.value,
                "priority": factor.priority.value,
            },
            notes=reason,
        )
        self.db.add(audit)


# Ports in Italian Special Economic Zones (ZES)
_ZES_PORTS = {
    "augusta", "catania", "siracusa", "pozzallo", "gela",
    "gioia_tauro", "taranto", "bari", "napoli", "cagliari",
}
