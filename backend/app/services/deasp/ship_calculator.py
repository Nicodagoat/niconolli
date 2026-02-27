"""
Ship Emissions Calculator for DEASP Italia.

Calculates emissions from vessels during hotelling and maneuvering
in Italian ports using EMEP/EEA methodology.
"""

import io
import csv
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.deasp.ship import ShipCall, ShipCallImport, classify_gt, PortName, MeetCategory
from app.models.deasp.deasp_inventory import DEASPCalculationResult
from app.services.deasp.italian_factor_engine import ItalianFactorEngine

logger = logging.getLogger(__name__)

# EMEP/EEA default power values (kW) by vessel category and GT range
# Format: {meet_category: {gt_class: {"hotelling_kw": X, "maneuvering_kw": Y}}}
VESSEL_POWER_DEFAULTS = {
    "liquid_bulk": {
        "0-999":       {"hotelling_kw": 100,  "maneuvering_kw": 500},
        "1000-4999":   {"hotelling_kw": 200,  "maneuvering_kw": 1500},
        "5000-24999":  {"hotelling_kw": 350,  "maneuvering_kw": 4000},
        "25000-49999": {"hotelling_kw": 500,  "maneuvering_kw": 8000},
        "50000+":      {"hotelling_kw": 700,  "maneuvering_kw": 12000},
    },
    "dry_bulk": {
        "0-999":       {"hotelling_kw": 80,   "maneuvering_kw": 400},
        "1000-4999":   {"hotelling_kw": 180,  "maneuvering_kw": 1200},
        "5000-24999":  {"hotelling_kw": 300,  "maneuvering_kw": 3500},
        "25000-49999": {"hotelling_kw": 450,  "maneuvering_kw": 7000},
        "50000+":      {"hotelling_kw": 600,  "maneuvering_kw": 10000},
    },
    "container": {
        "0-999":       {"hotelling_kw": 150,  "maneuvering_kw": 700},
        "1000-4999":   {"hotelling_kw": 300,  "maneuvering_kw": 2000},
        "5000-24999":  {"hotelling_kw": 600,  "maneuvering_kw": 6000},
        "25000-49999": {"hotelling_kw": 900,  "maneuvering_kw": 12000},
        "50000+":      {"hotelling_kw": 1200, "maneuvering_kw": 18000},
    },
    "general_cargo": {
        "0-999":       {"hotelling_kw": 80,   "maneuvering_kw": 400},
        "1000-4999":   {"hotelling_kw": 170,  "maneuvering_kw": 1100},
        "5000-24999":  {"hotelling_kw": 280,  "maneuvering_kw": 3000},
        "25000-49999": {"hotelling_kw": 400,  "maneuvering_kw": 5500},
        "50000+":      {"hotelling_kw": 500,  "maneuvering_kw": 8000},
    },
    "ro_ro": {
        "0-999":       {"hotelling_kw": 200,  "maneuvering_kw": 800},
        "1000-4999":   {"hotelling_kw": 400,  "maneuvering_kw": 2500},
        "5000-24999":  {"hotelling_kw": 700,  "maneuvering_kw": 5000},
        "25000-49999": {"hotelling_kw": 1000, "maneuvering_kw": 9000},
        "50000+":      {"hotelling_kw": 1300, "maneuvering_kw": 13000},
    },
    "passenger": {
        "0-999":       {"hotelling_kw": 300,  "maneuvering_kw": 1000},
        "1000-4999":   {"hotelling_kw": 600,  "maneuvering_kw": 3000},
        "5000-24999":  {"hotelling_kw": 1000, "maneuvering_kw": 6000},
        "25000-49999": {"hotelling_kw": 1500, "maneuvering_kw": 10000},
        "50000+":      {"hotelling_kw": 2500, "maneuvering_kw": 16000},
    },
    "cruise": {
        "0-999":       {"hotelling_kw": 400,  "maneuvering_kw": 1500},
        "1000-4999":   {"hotelling_kw": 800,  "maneuvering_kw": 4000},
        "5000-24999":  {"hotelling_kw": 2000, "maneuvering_kw": 10000},
        "25000-49999": {"hotelling_kw": 4000, "maneuvering_kw": 18000},
        "50000+":      {"hotelling_kw": 7000, "maneuvering_kw": 30000},
    },
    "tanker": {
        "0-999":       {"hotelling_kw": 100,  "maneuvering_kw": 500},
        "1000-4999":   {"hotelling_kw": 200,  "maneuvering_kw": 1500},
        "5000-24999":  {"hotelling_kw": 400,  "maneuvering_kw": 4500},
        "25000-49999": {"hotelling_kw": 600,  "maneuvering_kw": 9000},
        "50000+":      {"hotelling_kw": 800,  "maneuvering_kw": 13000},
    },
}

# Default maneuvering time per maneuver (hours)
DEFAULT_MANEUVER_HOURS = 1.0

# Specific Fuel Oil Consumption (g/kWh) - EMEP/EEA defaults
SFOC_HOTELLING = 227  # g/kWh for auxiliary engines
SFOC_MANEUVERING = 210  # g/kWh for main + auxiliary

# Fuel emission factors (tCO2 per tonne of fuel)
FUEL_CO2_FACTORS = {
    "fuel_oil": 3.114,   # Heavy fuel oil / residual
    "marine_diesel": 3.206,  # Marine diesel oil / marine gas oil
    "diesel": 3.206,
    "lng": 2.750,        # Liquefied natural gas
}


class ShipCalculator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.factor_engine = ItalianFactorEngine(db)

    async def import_ship_data(
        self,
        csv_content: str,
        organization_id: UUID,
        deasp_inventory_id: Optional[UUID] = None,
    ) -> ShipCallImport:
        """Import ship call data from CSV."""
        import_batch = ShipCallImport(
            organization_id=organization_id,
            deasp_inventory_id=deasp_inventory_id,
            filename="upload.csv",
        )
        self.db.add(import_batch)
        await self.db.flush()

        reader = csv.DictReader(io.StringIO(csv_content))
        total = 0
        valid = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            total += 1
            try:
                row = {k.strip().lower(): v.strip() for k, v in row.items() if v}
                ship_call = self._parse_ship_row(row, import_batch.id, deasp_inventory_id)
                self.db.add(ship_call)
                valid += 1
            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})

        import_batch.total_records = total
        import_batch.valid_records = valid
        import_batch.error_records = len(errors)
        import_batch.errors = {"errors": errors[:100]}

        await self.db.flush()
        return import_batch

    def _parse_ship_row(
        self,
        row: dict,
        import_batch_id: UUID,
        deasp_inventory_id: Optional[UUID],
    ) -> ShipCall:
        """Parse a single CSV row into a ShipCall record."""
        gt = float(row.get("gt", row.get("gross_tonnage", 0)))
        gt_class = classify_gt(gt)

        # Normalize port name
        port_raw = row.get("porto", row.get("port", "other"))
        port = self._normalize_port(port_raw)

        # Parse MEET category
        meet_raw = row.get("categoria_meet", row.get("meet_category", row.get("categoria", "other")))
        meet_cat = self._normalize_meet_category(meet_raw)

        hours = float(row.get("ore_in_porto", row.get("hours_in_port", 0)))
        maneuvers = int(row.get("manovre", row.get("maneuver_count", 2)))
        days = float(row.get("giorni_in_porto", row.get("days_in_port", 0)))

        if hours == 0 and days > 0:
            hours = days * 24

        # Calculate hotelling and maneuvering hours
        maneuver_hours = maneuvers * DEFAULT_MANEUVER_HOURS
        hotelling_hours = max(0, hours - maneuver_hours)

        fuel_type = row.get("tipo_combustibile", row.get("fuel_type", "fuel_oil"))
        has_lng = fuel_type.lower() in ("lng", "gnl") or row.get("has_lng", "").lower() in ("true", "si", "1")

        return ShipCall(
            import_batch_id=import_batch_id,
            deasp_inventory_id=deasp_inventory_id,
            imo_number=row.get("imo", row.get("imo_number")),
            ship_name=row.get("nave", row.get("ship_name", "Sconosciuta")),
            port=port,
            port_name_raw=port_raw,
            gross_tonnage=gt,
            gt_class=gt_class,
            meet_category=meet_cat,
            maneuver_count=maneuvers,
            hours_in_port=hours,
            days_in_port=days if days > 0 else hours / 24,
            hours_hotelling=hotelling_hours,
            hours_maneuvering=maneuver_hours,
            fuel_type=fuel_type,
            has_lng=has_lng,
            has_scrubber=row.get("scrubber", "").lower() in ("true", "si", "1"),
            shore_power_used=row.get("cold_ironing", "").lower() in ("true", "si", "1"),
        )

    def _normalize_port(self, raw: str) -> PortName:
        """Normalize raw port name to PortName enum."""
        mapping = {
            "augusta": PortName.AUGUSTA,
            "catania": PortName.CATANIA,
            "siracusa": PortName.SIRACUSA,
            "pozzallo": PortName.POZZALLO,
            "gela": PortName.GELA,
            "licata": PortName.LICATA,
            "porto empedocle": PortName.PORTO_EMPEDOCLE,
            "trapani": PortName.TRAPANI,
            "palermo": PortName.PALERMO,
            "messina": PortName.MESSINA,
            "milazzo": PortName.MILAZZO,
            "genova": PortName.GENOVA,
            "livorno": PortName.LIVORNO,
            "napoli": PortName.NAPOLI,
            "bari": PortName.BARI,
            "taranto": PortName.TARANTO,
            "trieste": PortName.TRIESTE,
            "venezia": PortName.VENEZIA,
            "ravenna": PortName.RAVENNA,
            "ancona": PortName.ANCONA,
            "civitavecchia": PortName.CIVITAVECCHIA,
            "gioia tauro": PortName.GIOIA_TAURO,
            "cagliari": PortName.CAGLIARI,
            "olbia": PortName.OLBIA,
        }
        normalized = raw.lower().strip()
        return mapping.get(normalized, PortName.OTHER)

    def _normalize_meet_category(self, raw: str) -> MeetCategory:
        mapping = {
            "liquid_bulk": MeetCategory.LIQUID_BULK, "rinfusa liquida": MeetCategory.LIQUID_BULK,
            "dry_bulk": MeetCategory.DRY_BULK, "rinfusa secca": MeetCategory.DRY_BULK,
            "container": MeetCategory.CONTAINER, "portacontainer": MeetCategory.CONTAINER,
            "general_cargo": MeetCategory.GENERAL_CARGO, "carico generale": MeetCategory.GENERAL_CARGO,
            "ro_ro": MeetCategory.RO_RO, "ro-ro": MeetCategory.RO_RO, "traghetto": MeetCategory.RO_RO,
            "passenger": MeetCategory.PASSENGER, "passeggeri": MeetCategory.PASSENGER,
            "cruise": MeetCategory.CRUISE, "crociera": MeetCategory.CRUISE,
            "tanker": MeetCategory.TANKER, "petroliera": MeetCategory.TANKER,
            "lng_carrier": MeetCategory.LNG_CARRIER, "gasiera": MeetCategory.LNG_CARRIER,
            "tug": MeetCategory.TUG, "rimorchiatore": MeetCategory.TUG,
            "fishing": MeetCategory.FISHING, "pesca": MeetCategory.FISHING,
        }
        return mapping.get(raw.lower().strip(), MeetCategory.OTHER)

    async def calculate_ship_emissions(
        self,
        ship_call: ShipCall,
        year: Optional[int] = None,
    ) -> dict:
        """Calculate emissions for a single ship call using EMEP/EEA methodology."""
        cat = ship_call.meet_category.value
        gt_cls = ship_call.gt_class.value if ship_call.gt_class else classify_gt(ship_call.gross_tonnage).value

        # Get power defaults for this vessel type
        power_defaults = VESSEL_POWER_DEFAULTS.get(cat, VESSEL_POWER_DEFAULTS["general_cargo"])
        power_data = power_defaults.get(gt_cls, power_defaults["5000-24999"])

        hotelling_kw = power_data["hotelling_kw"]
        maneuvering_kw = power_data["maneuvering_kw"]

        hotelling_hours = ship_call.hours_hotelling or max(0, ship_call.hours_in_port - ship_call.maneuver_count * DEFAULT_MANEUVER_HOURS)
        maneuvering_hours = ship_call.hours_maneuvering or (ship_call.maneuver_count * DEFAULT_MANEUVER_HOURS)

        # Shore power reduces hotelling emissions
        if ship_call.shore_power_used:
            hotelling_kw = 0

        # Fuel consumption (tonnes)
        hotelling_fuel_t = (hotelling_kw * hotelling_hours * SFOC_HOTELLING) / 1_000_000
        maneuvering_fuel_t = (maneuvering_kw * maneuvering_hours * SFOC_MANEUVERING) / 1_000_000

        # Select fuel CO2 factor
        fuel_key = "lng" if ship_call.has_lng else (ship_call.fuel_type or "fuel_oil")
        co2_factor = FUEL_CO2_FACTORS.get(fuel_key, FUEL_CO2_FACTORS["fuel_oil"])

        # Try to get factor from Italian factor database
        factor, _ = await self.factor_engine.get_emission_factor(
            "navi", fuel_key, year or 2024,
            context={"port": ship_call.port.value},
        )
        if factor:
            co2_factor = factor.value

        hotelling_co2 = hotelling_fuel_t * co2_factor
        maneuvering_co2 = maneuvering_fuel_t * co2_factor
        total_co2 = hotelling_co2 + maneuvering_co2

        # Update ship call record
        ship_call.hotelling_co2_tonnes = round(hotelling_co2, 6)
        ship_call.maneuvering_co2_tonnes = round(maneuvering_co2, 6)
        ship_call.total_co2_tonnes = round(total_co2, 6)

        return {
            "ship_name": ship_call.ship_name,
            "port": ship_call.port.value,
            "hotelling_fuel_t": round(hotelling_fuel_t, 6),
            "maneuvering_fuel_t": round(maneuvering_fuel_t, 6),
            "hotelling_co2_t": round(hotelling_co2, 6),
            "maneuvering_co2_t": round(maneuvering_co2, 6),
            "total_co2_t": round(total_co2, 6),
            "co2_factor_used": co2_factor,
            "fuel_type": fuel_key,
        }

    async def calculate_all_ships(self, deasp_inventory_id: UUID, year: int) -> dict:
        """Calculate emissions for all ships in a DEASP inventory."""
        result = await self.db.execute(
            select(ShipCall).where(ShipCall.deasp_inventory_id == deasp_inventory_id)
        )
        ship_calls = result.scalars().all()

        total_co2 = 0.0
        calculated = 0
        port_totals = {}

        for sc in ship_calls:
            calc = await self.calculate_ship_emissions(sc, year)
            total_co2 += calc["total_co2_t"]
            calculated += 1

            port = sc.port.value
            port_totals[port] = port_totals.get(port, 0) + calc["total_co2_t"]

        await self.db.flush()

        return {
            "total_ships": len(ship_calls),
            "calculated": calculated,
            "total_co2_tonnes": round(total_co2, 4),
            "by_port": {k: round(v, 4) for k, v in port_totals.items()},
        }

    def generate_ship_template(self) -> str:
        """Generate CSV template for ship data import."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "IMO", "Nave", "Porto", "GT", "Categoria_MEET",
            "Manovre", "Ore_in_porto", "Giorni_in_porto",
            "Tipo_combustibile", "Scrubber", "Cold_ironing",
        ])
        writer.writerow([
            "9876543", "MSC EXAMPLE", "Augusta", "45000", "container",
            "2", "48", "2", "fuel_oil", "false", "false",
        ])
        writer.writerow([
            "1234567", "FERRY ITALIA", "Catania", "28000", "ro_ro",
            "2", "12", "0.5", "marine_diesel", "false", "false",
        ])
        return output.getvalue()
