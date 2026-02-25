"""
GHG Emissions Calculation Engine

Implements the GHG Protocol Corporate Standard:
  Activity Data x Emission Factor = CO2e (kg or tonnes)

Supports Scope 1 (direct), Scope 2 (indirect energy), and Scope 3 (value chain).
"""

from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.activity import Activity, Scope
from app.models.emission_factor import EmissionFactor
from app.models.calculation import CalculationResult
from app.models.inventory import Inventory
from app.services.unit_converter import UnitConverter


# Global Warming Potentials (100-year horizon)
GWP_AR5 = {"co2": 1, "ch4": 28, "n2o": 265, "hfc134a": 1300, "sf6": 23500}
GWP_AR6 = {"co2": 1, "ch4": 27.9, "n2o": 273, "hfc134a": 1526, "sf6": 25200}

GWP_VERSIONS = {"ar5": GWP_AR5, "ar6": GWP_AR6}

# Default uncertainty percentages by data quality
UNCERTAINTY_DEFAULTS = {
    "high": 5.0,
    "medium": 15.0,
    "low": 30.0,
    "default": 50.0,
}


class CalculationEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.unit_converter = UnitConverter()

    async def calculate_activity(
        self, activity: Activity, emission_factor: Optional[EmissionFactor] = None
    ) -> CalculationResult:
        """Calculate emissions for a single activity record."""
        if emission_factor is None and activity.emission_factor_id:
            result = await self.db.execute(
                select(EmissionFactor).where(EmissionFactor.id == activity.emission_factor_id)
            )
            emission_factor = result.scalar_one_or_none()

        if emission_factor is None:
            emission_factor = await self._auto_select_factor(activity)

        if emission_factor is None:
            raise ValueError(
                f"No emission factor found for activity {activity.id} "
                f"(scope={activity.scope}, category={activity.category}, fuel={activity.fuel_type})"
            )

        # Convert activity value to match emission factor input unit
        converted_value = self.unit_converter.convert(
            activity.activity_value, activity.activity_unit.value, emission_factor.input_unit
        )

        # Core calculation: Activity Data x Emission Factor = Emissions
        co2_kg = converted_value * emission_factor.co2_factor
        ch4_kg = converted_value * emission_factor.ch4_factor
        n2o_kg = converted_value * emission_factor.n2o_factor
        hfc_kg = converted_value * emission_factor.hfc_factor
        pfc_kg = converted_value * emission_factor.pfc_factor
        sf6_kg = converted_value * emission_factor.sf6_factor

        # Apply GWP to get CO2e
        gwp = GWP_VERSIONS.get(emission_factor.gwp_version, GWP_AR6)
        total_co2e_kg = (
            co2_kg * gwp["co2"]
            + ch4_kg * gwp["ch4"]
            + n2o_kg * gwp["n2o"]
            + hfc_kg * gwp.get("hfc134a", 1300)
            + sf6_kg * gwp.get("sf6", 23500)
            + pfc_kg  # PFC already in CO2e
        )

        # If factor provides a pre-computed CO2e factor, use it for the total
        if emission_factor.co2e_factor > 0:
            total_co2e_kg = converted_value * emission_factor.co2e_factor

        uncertainty = activity.uncertainty_pct or UNCERTAINTY_DEFAULTS.get(
            activity.data_quality.value if activity.data_quality else "default", 50.0
        )

        biogenic_co2 = co2_kg if activity.is_biogenic else 0.0

        calc_result = CalculationResult(
            inventory_id=activity.inventory_id,
            activity_id=activity.id,
            scope=activity.scope.value,
            category=activity.category,
            subcategory=activity.subcategory,
            co2_kg=co2_kg,
            ch4_kg=ch4_kg,
            n2o_kg=n2o_kg,
            hfc_kg=hfc_kg,
            pfc_kg=pfc_kg,
            sf6_kg=sf6_kg,
            total_co2e_kg=total_co2e_kg,
            total_co2e_tonnes=total_co2e_kg / 1000.0,
            biogenic_co2_kg=biogenic_co2,
            uncertainty_pct=uncertainty,
            data_quality=activity.data_quality.value if activity.data_quality else None,
            emission_factor_used=emission_factor.name,
            emission_factor_value=emission_factor.co2e_factor,
            gwp_version=emission_factor.gwp_version,
            methodology_notes=f"Source: {emission_factor.source.value}, Year: {emission_factor.year}",
            calculation_details={
                "activity_value": activity.activity_value,
                "activity_unit": activity.activity_unit.value,
                "converted_value": converted_value,
                "factor_input_unit": emission_factor.input_unit,
                "factor_id": str(emission_factor.id),
            },
        )

        return calc_result

    async def calculate_inventory(self, inventory_id: UUID) -> list[CalculationResult]:
        """Calculate emissions for all activities in an inventory."""
        # Delete existing calculations for this inventory
        await self.db.execute(
            delete(CalculationResult).where(CalculationResult.inventory_id == inventory_id)
        )

        # Fetch all activities
        result = await self.db.execute(
            select(Activity).where(Activity.inventory_id == inventory_id)
        )
        activities = result.scalars().all()

        results = []
        errors = []
        for activity in activities:
            try:
                calc = await self.calculate_activity(activity)
                self.db.add(calc)
                results.append(calc)
            except ValueError as e:
                errors.append({"activity_id": str(activity.id), "error": str(e)})

        await self.db.flush()
        return results

    async def get_inventory_summary(self, inventory_id: UUID) -> dict:
        """Generate a summary of emissions for an inventory."""
        result = await self.db.execute(
            select(CalculationResult).where(CalculationResult.inventory_id == inventory_id)
        )
        calculations = result.scalars().all()

        inventory_result = await self.db.execute(
            select(Inventory).where(Inventory.id == inventory_id)
        )
        inventory = inventory_result.scalar_one()

        summary = {
            "inventory_id": str(inventory_id),
            "reporting_year": inventory.reporting_year,
            "total_co2e_tonnes": 0.0,
            "scope_1_tonnes": 0.0,
            "scope_2_tonnes": 0.0,
            "scope_3_tonnes": 0.0,
            "scope_1_categories": {},
            "scope_2_categories": {},
            "scope_3_categories": {},
            "data_quality_breakdown": {},
            "activity_count": len(calculations),
        }

        for calc in calculations:
            summary["total_co2e_tonnes"] += calc.total_co2e_tonnes

            if calc.scope == "scope_1":
                summary["scope_1_tonnes"] += calc.total_co2e_tonnes
                summary["scope_1_categories"][calc.category] = (
                    summary["scope_1_categories"].get(calc.category, 0) + calc.total_co2e_tonnes
                )
            elif calc.scope == "scope_2":
                summary["scope_2_tonnes"] += calc.total_co2e_tonnes
                summary["scope_2_categories"][calc.category] = (
                    summary["scope_2_categories"].get(calc.category, 0) + calc.total_co2e_tonnes
                )
            elif calc.scope == "scope_3":
                summary["scope_3_tonnes"] += calc.total_co2e_tonnes
                summary["scope_3_categories"][calc.category] = (
                    summary["scope_3_categories"].get(calc.category, 0) + calc.total_co2e_tonnes
                )

            if calc.data_quality:
                summary["data_quality_breakdown"][calc.data_quality] = (
                    summary["data_quality_breakdown"].get(calc.data_quality, 0) + 1
                )

        # Intensity metrics
        org_result = await self.db.execute(
            select(Inventory).where(Inventory.id == inventory_id)
        )
        inv = org_result.scalar_one()
        from app.models.organization import Organization

        org_result = await self.db.execute(
            select(Organization).where(Organization.id == inv.organization_id)
        )
        org = org_result.scalar_one_or_none()
        if org:
            if org.employee_count:
                summary["intensity_per_employee"] = summary["total_co2e_tonnes"] / org.employee_count
            if org.annual_revenue and org.annual_revenue > 0:
                summary["intensity_per_revenue"] = summary["total_co2e_tonnes"] / (org.annual_revenue / 1_000_000)

        return summary

    async def _auto_select_factor(self, activity: Activity) -> Optional[EmissionFactor]:
        """Automatically find the best matching emission factor for an activity."""
        query = select(EmissionFactor).where(
            EmissionFactor.is_active == True,  # noqa: E712
        )

        # Match by fuel type if available
        if activity.fuel_type:
            query = query.where(EmissionFactor.fuel_type == activity.fuel_type)

        # Match by scope/category
        category_map = {
            "stationary_combustion": "stationary_combustion",
            "mobile_combustion": "mobile_combustion",
            "fugitive_emissions": "fugitive",
            "process_emissions": "stationary_combustion",
        }

        if activity.scope == Scope.SCOPE_2:
            query = query.where(EmissionFactor.category == "electricity")
        elif activity.category in category_map:
            query = query.where(EmissionFactor.category == category_map[activity.category])

        # Order by year (most recent first) and prefer non-custom factors
        query = query.order_by(EmissionFactor.year.desc(), EmissionFactor.is_custom.asc())
        query = query.limit(1)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()
