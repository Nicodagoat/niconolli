"""
Report Generation Service

Generates GHG Protocol-compliant reports in multiple formats:
- PDF executive summary with charts
- Excel/CSV raw data export
- CDP response format
- GRI Standards alignment
"""

import io
import csv
from typing import Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.calculation import CalculationResult
from app.models.inventory import Inventory
from app.models.organization import Organization
from app.models.activity import Activity


class ReportGenerator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_csv_export(self, inventory_id: UUID) -> str:
        """Export all calculation results as CSV."""
        result = await self.db.execute(
            select(CalculationResult).where(CalculationResult.inventory_id == inventory_id)
            .order_by(CalculationResult.scope, CalculationResult.category)
        )
        calculations = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Scope", "Category", "Subcategory", "CO2 (kg)", "CH4 (kg)", "N2O (kg)",
            "Total CO2e (kg)", "Total CO2e (tonnes)", "Biogenic CO2 (kg)",
            "Data Quality", "Uncertainty %", "Emission Factor", "GWP Version",
            "Calculated At"
        ])

        for calc in calculations:
            writer.writerow([
                calc.scope, calc.category, calc.subcategory or "",
                f"{calc.co2_kg:.4f}", f"{calc.ch4_kg:.6f}", f"{calc.n2o_kg:.6f}",
                f"{calc.total_co2e_kg:.4f}", f"{calc.total_co2e_tonnes:.6f}",
                f"{calc.biogenic_co2_kg:.4f}",
                calc.data_quality or "", f"{calc.uncertainty_pct:.1f}" if calc.uncertainty_pct else "",
                calc.emission_factor_used or "", calc.gwp_version or "",
                calc.calculated_at.isoformat() if calc.calculated_at else "",
            ])

        return output.getvalue()

    async def generate_ghg_protocol_report(self, inventory_id: UUID) -> dict:
        """Generate a GHG Protocol-compliant inventory report structure."""
        inv_result = await self.db.execute(
            select(Inventory).where(Inventory.id == inventory_id)
        )
        inventory = inv_result.scalar_one()

        org_result = await self.db.execute(
            select(Organization).where(Organization.id == inventory.organization_id)
        )
        org = org_result.scalar_one()

        calc_result = await self.db.execute(
            select(CalculationResult).where(CalculationResult.inventory_id == inventory_id)
        )
        calculations = calc_result.scalars().all()

        # Aggregate by scope
        scope_totals = {"scope_1": 0.0, "scope_2": 0.0, "scope_3": 0.0}
        category_details = {}

        for calc in calculations:
            scope_totals[calc.scope] = scope_totals.get(calc.scope, 0) + calc.total_co2e_tonnes
            key = f"{calc.scope}|{calc.category}"
            if key not in category_details:
                category_details[key] = {
                    "scope": calc.scope,
                    "category": calc.category,
                    "total_co2e_tonnes": 0.0,
                    "activity_count": 0,
                }
            category_details[key]["total_co2e_tonnes"] += calc.total_co2e_tonnes
            category_details[key]["activity_count"] += 1

        total = sum(scope_totals.values())

        return {
            "report_title": f"GHG Emissions Inventory Report - {inventory.reporting_year}",
            "organization": {
                "name": org.name,
                "industry": org.industry.value,
                "country": org.country,
                "reporting_year": inventory.reporting_year,
                "boundary_approach": inventory.boundary_approach.value,
                "gwp_version": inventory.gwp_version.value,
                "base_year": inventory.base_year,
            },
            "summary": {
                "total_co2e_tonnes": round(total, 2),
                "scope_1_tonnes": round(scope_totals["scope_1"], 2),
                "scope_2_tonnes": round(scope_totals["scope_2"], 2),
                "scope_3_tonnes": round(scope_totals["scope_3"], 2),
                "scope_1_pct": round(scope_totals["scope_1"] / total * 100, 1) if total > 0 else 0,
                "scope_2_pct": round(scope_totals["scope_2"] / total * 100, 1) if total > 0 else 0,
                "scope_3_pct": round(scope_totals["scope_3"] / total * 100, 1) if total > 0 else 0,
            },
            "category_breakdown": list(category_details.values()),
            "methodology": {
                "standard": "GHG Protocol Corporate Standard",
                "gwp_source": f"IPCC {inventory.gwp_version.value.upper()}",
                "boundary": inventory.boundary_approach.value,
            },
            "generated_at": datetime.now().isoformat(),
        }

    async def generate_cdp_format(self, inventory_id: UUID) -> dict:
        """Generate data structured for CDP Climate Change response."""
        report = await self.generate_ghg_protocol_report(inventory_id)

        return {
            "C6_1_gross_global_scope_1": report["summary"]["scope_1_tonnes"],
            "C6_3_scope_2_location_based": report["summary"]["scope_2_tonnes"],
            "C6_5_scope_3_categories": {
                item["category"]: item["total_co2e_tonnes"]
                for item in report["category_breakdown"]
                if item["scope"] == "scope_3"
            },
            "C6_10_total_gross_emissions": report["summary"]["total_co2e_tonnes"],
            "methodology": "GHG Protocol Corporate Standard",
            "gwp_source": report["methodology"]["gwp_source"],
        }

    async def generate_activity_export(self, inventory_id: UUID) -> str:
        """Export all activity data as CSV."""
        result = await self.db.execute(
            select(Activity).where(Activity.inventory_id == inventory_id)
            .order_by(Activity.scope, Activity.category)
        )
        activities = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Scope", "Category", "Subcategory", "Description", "Activity Value",
            "Activity Unit", "Fuel Type", "Activity Date", "Data Quality",
            "Data Source", "Is Biogenic",
        ])

        for act in activities:
            writer.writerow([
                act.scope.value, act.category, act.subcategory or "",
                act.description or "", act.activity_value, act.activity_unit.value,
                act.fuel_type or "", act.activity_date.isoformat(),
                act.data_quality.value if act.data_quality else "",
                act.data_source or "", act.is_biogenic,
            ])

        return output.getvalue()
