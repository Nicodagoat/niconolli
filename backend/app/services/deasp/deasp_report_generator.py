"""
DEASP Report Generator.

Generates Excel and structured reports for DEASP compliance,
including factor traceability sheets and update chronology.
"""

import io
import csv
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.deasp.deasp_inventory import DEASPInventory, DEASPCalculationResult
from app.models.deasp.ship import ShipCall
from app.models.deasp.concessionaire import Concessionaire, Questionnaire, QuestionnaireResponse
from app.models.deasp.italian_factor import ItalianEmissionFactor, ItalianFactorUpdate
from app.models.organization import Organization


class DEASPReportGenerator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_deasp_report(self, inventory_id: UUID) -> dict:
        """Generate complete DEASP report structure."""
        inv = (await self.db.execute(
            select(DEASPInventory).where(DEASPInventory.id == inventory_id)
        )).scalar_one()

        org = (await self.db.execute(
            select(Organization).where(Organization.id == inv.organization_id)
        )).scalar_one()

        results = (await self.db.execute(
            select(DEASPCalculationResult).where(DEASPCalculationResult.inventory_id == inventory_id)
        )).scalars().all()

        # Aggregate by source type and port
        by_source = {}
        by_port = {}
        for r in results:
            by_source.setdefault(r.source_type, 0.0)
            by_source[r.source_type] += r.co2_tonnes

            if r.port:
                by_port.setdefault(r.port, {"co2": 0.0, "count": 0})
                by_port[r.port]["co2"] += r.co2_tonnes
                by_port[r.port]["count"] += 1

        total = sum(by_source.values())

        return {
            "titolo": f"Report DEASP - {inv.port_authority_name or org.name}",
            "anno_riferimento": inv.reporting_year,
            "autorita_portuale": inv.port_authority_name or org.name,
            "porti_inclusi": inv.ports_included or [],
            "stato": inv.status.value,
            "riepilogo": {
                "emissioni_totali_tCO2": round(total, 2),
                "emissioni_navi_tCO2": round(by_source.get("navi", 0), 2),
                "emissioni_concessionari_tCO2": round(by_source.get("concessionario", 0), 2),
                "emissioni_autorita_tCO2": round(by_source.get("autorita", 0), 2),
            },
            "dettaglio_porti": {
                port: {"tCO2": round(d["co2"], 2), "attivita": d["count"]}
                for port, d in sorted(by_port.items(), key=lambda x: -x[1]["co2"])
            },
            "metodologia": {
                "standard": "DEASP - Direttiva Europea Ambiente Sistema Portuale",
                "navi": "EMEP/EEA Emission Inventory Guidebook 2023",
                "combustibili": "ISPRA - Fattori emissione fonti fossili 2024",
                "elettricita": "ISPRA - Mix elettrico nazionale 2024",
                "gwp": "IPCC AR6 (100-year horizon)",
            },
            "generato_il": datetime.now().isoformat(),
        }

    async def generate_factors_sheet(self, year: int) -> list[dict]:
        """Generate the 'Fattori_Applicati' sheet data."""
        factors = (await self.db.execute(
            select(ItalianEmissionFactor).where(
                ItalianEmissionFactor.is_active == True,  # noqa: E712
                ItalianEmissionFactor.year_valid_from <= year,
                (ItalianEmissionFactor.year_valid_to == None) |  # noqa: E711
                (ItalianEmissionFactor.year_valid_to >= year),
            ).order_by(ItalianEmissionFactor.category, ItalianEmissionFactor.subcategory)
        )).scalars().all()

        return [
            {
                "Categoria": f.category.value,
                "Sotto-categoria": f.subcategory,
                "Nome": f.name,
                "Valore": f.value,
                "Unità": f.unit,
                "Fonte": f.source.value.upper(),
                "Anno": f.year_valid_from,
                "Confidenza": f"{f.confidence_pct}%" if f.confidence_pct else "-",
                "Priorità": f.priority.value,
                "Note": f.notes or "-",
            }
            for f in factors
        ]

    async def generate_update_history_sheet(self) -> list[dict]:
        """Generate the 'Cronologia_Aggiornamenti' sheet data."""
        updates = (await self.db.execute(
            select(ItalianFactorUpdate)
            .join(ItalianEmissionFactor)
            .order_by(ItalianFactorUpdate.created_at.desc())
            .limit(100)
        )).scalars().all()

        rows = []
        for u in updates:
            rows.append({
                "Data": u.created_at.strftime("%d/%m/%Y"),
                "Fattore": u.factor.name if u.factor else str(u.factor_id),
                "Valore_Precedente": u.previous_value,
                "Valore_Nuovo": u.new_value,
                "Variazione": f"{u.change_pct:+.1f}%" if u.change_pct else "-",
                "Motivazione": u.reason.value if u.reason else "-",
                "Dettaglio": u.reason_detail or "-",
                "Aggiornato_da": u.updated_by,
            })
        return rows

    async def export_deasp_csv(self, inventory_id: UUID) -> str:
        """Export DEASP calculation results as CSV."""
        results = (await self.db.execute(
            select(DEASPCalculationResult)
            .where(DEASPCalculationResult.inventory_id == inventory_id)
            .order_by(DEASPCalculationResult.source_type, DEASPCalculationResult.port)
        )).scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Tipo_Fonte", "Nome_Fonte", "Porto", "Scope", "Categoria",
            "Sotto-categoria", "Valore_Attività", "Unità", "Fattore_Emissione",
            "Fonte_Fattore", "CO2_tonne", "Confidenza", "Note",
        ])

        for r in results:
            writer.writerow([
                r.source_type, r.source_name or "", r.port or "",
                r.scope, r.category, r.subcategory or "",
                r.activity_value or "", r.activity_unit or "",
                r.emission_factor_value or "", r.emission_factor_source or "",
                f"{r.co2_tonnes:.6f}", f"{r.confidence_pct:.0f}%" if r.confidence_pct else "",
                r.methodology_notes or "",
            ])

        return output.getvalue()

    async def generate_ship_summary_csv(self, inventory_id: UUID) -> str:
        """Export ship call data with calculated emissions."""
        ships = (await self.db.execute(
            select(ShipCall)
            .where(ShipCall.deasp_inventory_id == inventory_id)
            .order_by(ShipCall.port, ShipCall.ship_name)
        )).scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "IMO", "Nave", "Porto", "GT", "Classe_GT", "Categoria_MEET",
            "Manovre", "Ore_Porto", "Ore_Hotelling", "Ore_Manovra",
            "Combustibile", "LNG", "Cold_Ironing",
            "CO2_Hotelling_t", "CO2_Manovra_t", "CO2_Totale_t",
        ])

        for s in ships:
            writer.writerow([
                s.imo_number or "", s.ship_name, s.port.value,
                s.gross_tonnage, s.gt_class.value if s.gt_class else "",
                s.meet_category.value, s.maneuver_count,
                s.hours_in_port, s.hours_hotelling or "",
                s.hours_maneuvering or "", s.fuel_type or "",
                "Si" if s.has_lng else "No",
                "Si" if s.shore_power_used else "No",
                f"{s.hotelling_co2_tonnes:.6f}" if s.hotelling_co2_tonnes else "",
                f"{s.maneuvering_co2_tonnes:.6f}" if s.maneuvering_co2_tonnes else "",
                f"{s.total_co2_tonnes:.6f}" if s.total_co2_tonnes else "",
            ])

        return output.getvalue()
