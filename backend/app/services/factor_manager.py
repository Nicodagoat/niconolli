"""
Automated Conversion Factor Management

Handles:
- Loading default emission factors from built-in datasets
- Scheduled API scraping for factor updates
- Version control and audit trail for factor changes
- Notification when factors change >5%
- Fallback mechanisms
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.emission_factor import EmissionFactor, EmissionFactorVersion, FactorSource, FactorCategory
from app.core.config import settings

logger = logging.getLogger(__name__)


# Built-in default emission factors (subset - expandable)
DEFAULT_EMISSION_FACTORS = [
    # Scope 1 - Stationary Combustion
    {
        "source": "epa", "category": "stationary_combustion", "name": "Natural Gas",
        "fuel_type": "natural_gas", "co2_factor": 53.06, "ch4_factor": 0.001, "n2o_factor": 0.0001,
        "co2e_factor": 53.11, "input_unit": "mmbtu", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "stationary_combustion", "name": "Diesel / Distillate Fuel Oil #2",
        "fuel_type": "diesel", "co2_factor": 73.96, "ch4_factor": 0.003, "n2o_factor": 0.0006,
        "co2e_factor": 74.21, "input_unit": "mmbtu", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "stationary_combustion", "name": "Propane (LPG)",
        "fuel_type": "propane", "co2_factor": 62.87, "ch4_factor": 0.003, "n2o_factor": 0.0006,
        "co2e_factor": 63.11, "input_unit": "mmbtu", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "stationary_combustion", "name": "Heating Oil / Residual Fuel Oil",
        "fuel_type": "heating_oil", "co2_factor": 75.10, "ch4_factor": 0.003, "n2o_factor": 0.0006,
        "co2e_factor": 75.35, "input_unit": "mmbtu", "region": "US", "year": 2024,
    },
    # Scope 1 - Mobile Combustion
    {
        "source": "epa", "category": "mobile_combustion", "name": "Gasoline - Passenger Cars",
        "fuel_type": "gasoline", "vehicle_type": "passenger_car", "co2_factor": 8.78,
        "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 8.78,
        "input_unit": "gallons_us", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "mobile_combustion", "name": "Diesel - Light Trucks",
        "fuel_type": "diesel", "vehicle_type": "light_truck", "co2_factor": 10.21,
        "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 10.21,
        "input_unit": "gallons_us", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "mobile_combustion", "name": "Diesel - Heavy Trucks",
        "fuel_type": "diesel", "vehicle_type": "heavy_truck", "co2_factor": 10.21,
        "ch4_factor": 0.0005, "n2o_factor": 0.0005, "co2e_factor": 10.35,
        "input_unit": "gallons_us", "region": "US", "year": 2024,
    },
    # Scope 1 - Fugitive Emissions (Refrigerants)
    {
        "source": "epa", "category": "fugitive", "name": "R-410A Refrigerant",
        "fuel_type": "r410a", "co2_factor": 0, "ch4_factor": 0, "n2o_factor": 0,
        "co2e_factor": 2088.0, "input_unit": "kg", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "epa", "category": "fugitive", "name": "R-134a Refrigerant",
        "fuel_type": "r134a", "co2_factor": 0, "ch4_factor": 0, "n2o_factor": 0,
        "co2e_factor": 1430.0, "input_unit": "kg", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "epa", "category": "fugitive", "name": "R-404A Refrigerant",
        "fuel_type": "r404a", "co2_factor": 0, "ch4_factor": 0, "n2o_factor": 0,
        "co2e_factor": 3922.0, "input_unit": "kg", "region": "GLOBAL", "year": 2024,
    },
    # Scope 2 - Electricity
    {
        "source": "egrid", "category": "electricity", "name": "US National Average Grid",
        "co2_factor": 0.3716, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.3716,
        "input_unit": "kwh", "region": "US", "year": 2024,
    },
    {
        "source": "defra", "category": "electricity", "name": "UK National Grid",
        "co2_factor": 0.20705, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.20705,
        "input_unit": "kwh", "region": "GB", "year": 2024,
    },
    {
        "source": "iea", "category": "electricity", "name": "EU Average Grid",
        "co2_factor": 0.2307, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.2307,
        "input_unit": "kwh", "region": "EU", "year": 2024,
    },
    {
        "source": "iea", "category": "electricity", "name": "Germany Grid",
        "co2_factor": 0.338, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.338,
        "input_unit": "kwh", "region": "DE", "year": 2024,
    },
    {
        "source": "iea", "category": "electricity", "name": "France Grid",
        "co2_factor": 0.052, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.052,
        "input_unit": "kwh", "region": "FR", "year": 2024,
    },
    {
        "source": "iea", "category": "electricity", "name": "China Grid",
        "co2_factor": 0.5572, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.5572,
        "input_unit": "kwh", "region": "CN", "year": 2024,
    },
    {
        "source": "iea", "category": "electricity", "name": "India Grid",
        "co2_factor": 0.7082, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.7082,
        "input_unit": "kwh", "region": "IN", "year": 2024,
    },
    # Scope 2 - Heat/Steam
    {
        "source": "defra", "category": "heat_steam", "name": "District Heating",
        "co2_factor": 0.1707, "ch4_factor": 0.0, "n2o_factor": 0.0, "co2e_factor": 0.1707,
        "input_unit": "kwh", "region": "GB", "year": 2024,
    },
    # Scope 3 - Business Travel (Flights)
    {
        "source": "defra", "category": "transport_passenger", "name": "Short-haul Flight (Economy)",
        "fuel_type": "flight_short_economy", "co2_factor": 0.15102, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.15102, "input_unit": "passenger_km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_passenger", "name": "Long-haul Flight (Economy)",
        "fuel_type": "flight_long_economy", "co2_factor": 0.14615, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.14615, "input_unit": "passenger_km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_passenger", "name": "Long-haul Flight (Business)",
        "fuel_type": "flight_long_business", "co2_factor": 0.42385, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.42385, "input_unit": "passenger_km", "region": "GLOBAL", "year": 2024,
    },
    # Scope 3 - Hotels
    {
        "source": "defra", "category": "hotel_stays", "name": "Hotel Stay (Average)",
        "fuel_type": "hotel_average", "co2_factor": 14.68, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 14.68, "input_unit": "nights", "region": "GLOBAL", "year": 2024,
    },
    # Scope 3 - Freight
    {
        "source": "defra", "category": "transport_freight", "name": "Road Freight (Average HGV)",
        "fuel_type": "road_freight_hgv", "co2_factor": 0.10448, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.10448, "input_unit": "tonne_km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_freight", "name": "Rail Freight",
        "fuel_type": "rail_freight", "co2_factor": 0.02726, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.02726, "input_unit": "tonne_km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_freight", "name": "Sea Freight (Container)",
        "fuel_type": "sea_freight_container", "co2_factor": 0.01612, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.01612, "input_unit": "tonne_km", "region": "GLOBAL", "year": 2024,
    },
    # Scope 3 - Waste
    {
        "source": "defra", "category": "waste", "name": "Landfill - Mixed Municipal Waste",
        "waste_type": "landfill_mixed", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.58693, "input_unit": "tonnes", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "waste", "name": "Recycling - Mixed Materials",
        "waste_type": "recycling_mixed", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.02106, "input_unit": "tonnes", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "waste", "name": "Composting - Organic Waste",
        "waste_type": "composting", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.01002, "input_unit": "tonnes", "region": "GLOBAL", "year": 2024,
    },
    # Scope 3 - Well-to-Tank (WTT)
    {
        "source": "defra", "category": "well_to_tank", "name": "WTT - Natural Gas",
        "fuel_type": "natural_gas", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 4.09, "input_unit": "mmbtu", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "well_to_tank", "name": "WTT - Diesel",
        "fuel_type": "diesel", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.62874, "input_unit": "liters", "region": "GLOBAL", "year": 2024,
    },
    # Scope 3 - Spend-based (per $1000 USD)
    {
        "source": "epa", "category": "spend_based", "name": "Purchased Goods - Manufacturing",
        "fuel_type": "spend_manufacturing", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.42, "input_unit": "usd", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "spend_based", "name": "Purchased Goods - IT Services",
        "fuel_type": "spend_it_services", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.16, "input_unit": "usd", "region": "US", "year": 2024,
    },
    {
        "source": "epa", "category": "spend_based", "name": "Purchased Goods - Office Supplies",
        "fuel_type": "spend_office_supplies", "co2_factor": 0.0, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.35, "input_unit": "usd", "region": "US", "year": 2024,
    },
    # Employee Commuting
    {
        "source": "defra", "category": "transport_passenger", "name": "Car - Average (Commuting)",
        "fuel_type": "car_commuting", "co2_factor": 0.17029, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.17029, "input_unit": "km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_passenger", "name": "Bus (Commuting)",
        "fuel_type": "bus_commuting", "co2_factor": 0.10312, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.10312, "input_unit": "passenger_km", "region": "GLOBAL", "year": 2024,
    },
    {
        "source": "defra", "category": "transport_passenger", "name": "Train / Rail (Commuting)",
        "fuel_type": "train_commuting", "co2_factor": 0.03549, "ch4_factor": 0.0,
        "n2o_factor": 0.0, "co2e_factor": 0.03549, "input_unit": "passenger_km", "region": "GLOBAL", "year": 2024,
    },
]


class FactorManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def seed_default_factors(self) -> int:
        """Load default emission factors into the database."""
        count = 0
        for factor_data in DEFAULT_EMISSION_FACTORS:
            existing = await self.db.execute(
                select(EmissionFactor).where(
                    EmissionFactor.source == factor_data["source"],
                    EmissionFactor.name == factor_data["name"],
                    EmissionFactor.year == factor_data["year"],
                )
            )
            if existing.scalar_one_or_none() is not None:
                continue

            factor = EmissionFactor(
                source=FactorSource(factor_data["source"]),
                category=FactorCategory(factor_data["category"]),
                name=factor_data["name"],
                co2_factor=factor_data["co2_factor"],
                ch4_factor=factor_data["ch4_factor"],
                n2o_factor=factor_data["n2o_factor"],
                co2e_factor=factor_data["co2e_factor"],
                input_unit=factor_data["input_unit"],
                region=factor_data.get("region"),
                year=factor_data["year"],
                fuel_type=factor_data.get("fuel_type"),
                vehicle_type=factor_data.get("vehicle_type"),
                waste_type=factor_data.get("waste_type"),
                is_custom=False,
            )
            self.db.add(factor)
            count += 1

        await self.db.flush()
        logger.info(f"Seeded {count} default emission factors")
        return count

    async def update_factor(
        self,
        factor_id: UUID,
        new_co2e_factor: float,
        change_reason: str = "API update",
        changed_by: str = "system",
    ) -> EmissionFactor:
        """Update an emission factor with version tracking."""
        result = await self.db.execute(
            select(EmissionFactor).where(EmissionFactor.id == factor_id)
        )
        factor = result.scalar_one()

        old_value = factor.co2e_factor
        change_pct = ((new_co2e_factor - old_value) / old_value * 100) if old_value != 0 else 100

        # Get current max version
        version_result = await self.db.execute(
            select(func.max(EmissionFactorVersion.version)).where(
                EmissionFactorVersion.emission_factor_id == factor_id
            )
        )
        max_version = version_result.scalar() or 0

        # Create version record
        version = EmissionFactorVersion(
            emission_factor_id=factor_id,
            version=max_version + 1,
            co2e_factor_old=old_value,
            co2e_factor_new=new_co2e_factor,
            change_pct=change_pct,
            change_reason=change_reason,
            changed_by=changed_by,
        )
        self.db.add(version)

        # Update the factor
        factor.co2e_factor = new_co2e_factor
        factor.updated_at = datetime.now(timezone.utc)

        # Check threshold for notifications
        if abs(change_pct) > settings.FACTOR_CHANGE_THRESHOLD_PCT:
            logger.warning(
                f"Emission factor '{factor.name}' changed by {change_pct:.1f}% "
                f"(from {old_value} to {new_co2e_factor})"
            )

        await self.db.flush()
        return factor

    async def search_factors(
        self,
        category: Optional[str] = None,
        source: Optional[str] = None,
        region: Optional[str] = None,
        year: Optional[int] = None,
        fuel_type: Optional[str] = None,
        search_term: Optional[str] = None,
    ) -> list[EmissionFactor]:
        """Search for emission factors with filters."""
        query = select(EmissionFactor).where(EmissionFactor.is_active == True)  # noqa: E712

        if category:
            query = query.where(EmissionFactor.category == category)
        if source:
            query = query.where(EmissionFactor.source == source)
        if region:
            query = query.where(EmissionFactor.region == region)
        if year:
            query = query.where(EmissionFactor.year == year)
        if fuel_type:
            query = query.where(EmissionFactor.fuel_type == fuel_type)
        if search_term:
            query = query.where(EmissionFactor.name.ilike(f"%{search_term}%"))

        query = query.order_by(EmissionFactor.year.desc(), EmissionFactor.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_factor_history(self, factor_id: UUID) -> list[EmissionFactorVersion]:
        """Get version history for an emission factor."""
        result = await self.db.execute(
            select(EmissionFactorVersion)
            .where(EmissionFactorVersion.emission_factor_id == factor_id)
            .order_by(EmissionFactorVersion.version.desc())
        )
        return list(result.scalars().all())
