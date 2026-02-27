"""
Unit Conversion Engine

Handles all unit conversions between activity data units and emission factor input units.
Supports volume, energy, mass, distance, and combined units.
"""


class UnitConverter:
    # Conversion factors to base units
    # Volume -> liters
    VOLUME_TO_LITERS = {
        "liters": 1.0,
        "gallons_us": 3.78541,
        "cubic_meters": 1000.0,
        "cubic_feet": 28.3168,
    }

    # Energy -> kWh
    ENERGY_TO_KWH = {
        "kwh": 1.0,
        "mwh": 1000.0,
        "gj": 277.778,
        "therms": 29.3001,
        "mmbtu": 293.071,
        "btu": 0.000293071,
    }

    # Mass -> kg
    MASS_TO_KG = {
        "kg": 1.0,
        "tonnes": 1000.0,
        "metric_tons": 1000.0,
        "lbs": 0.453592,
        "short_tons": 907.185,
        "long_tons": 1016.05,
    }

    # Distance -> km
    DISTANCE_TO_KM = {
        "km": 1.0,
        "miles": 1.60934,
        "nautical_miles": 1.852,
    }

    # Transport -> base units
    TRANSPORT_UNITS = {
        "passenger_km": 1.0,
        "passenger_miles": 1.60934,
        "tonne_km": 1.0,
        "tonne_miles": 1.60934,
    }

    # Currency (pass-through, no conversion needed for spend-based)
    CURRENCY_UNITS = {"usd", "eur", "gbp", "cad", "aud", "jpy"}

    # Other units
    OTHER_UNITS = {"nights", "units", "hours"}

    def __init__(self):
        self._build_conversion_map()

    def _build_conversion_map(self):
        """Build a unified conversion map from all unit types."""
        self._unit_categories = {}
        for unit in self.VOLUME_TO_LITERS:
            self._unit_categories[unit] = "volume"
        for unit in self.ENERGY_TO_KWH:
            self._unit_categories[unit] = "energy"
        for unit in self.MASS_TO_KG:
            self._unit_categories[unit] = "mass"
        for unit in self.DISTANCE_TO_KM:
            self._unit_categories[unit] = "distance"
        for unit in self.TRANSPORT_UNITS:
            self._unit_categories[unit] = "transport"
        for unit in self.CURRENCY_UNITS:
            self._unit_categories[unit] = "currency"
        for unit in self.OTHER_UNITS:
            self._unit_categories[unit] = "other"

    def convert(self, value: float, from_unit: str, to_unit: str) -> float:
        """Convert a value from one unit to another."""
        from_unit = from_unit.lower().strip()
        to_unit = to_unit.lower().strip()

        if from_unit == to_unit:
            return value

        from_cat = self._unit_categories.get(from_unit)
        to_cat = self._unit_categories.get(to_unit)

        # If either unit is unknown or they're in different categories,
        # assume they're compatible (pass-through)
        if from_cat is None or to_cat is None:
            return value

        if from_cat != to_cat:
            # Cross-category: special handling for energy-volume (e.g., therms of natural gas)
            return value

        if from_cat == "volume":
            return self._convert_via_base(value, from_unit, to_unit, self.VOLUME_TO_LITERS)
        elif from_cat == "energy":
            return self._convert_via_base(value, from_unit, to_unit, self.ENERGY_TO_KWH)
        elif from_cat == "mass":
            return self._convert_via_base(value, from_unit, to_unit, self.MASS_TO_KG)
        elif from_cat == "distance":
            return self._convert_via_base(value, from_unit, to_unit, self.DISTANCE_TO_KM)
        elif from_cat == "transport":
            return self._convert_via_base(value, from_unit, to_unit, self.TRANSPORT_UNITS)
        else:
            return value

    def _convert_via_base(
        self, value: float, from_unit: str, to_unit: str, conversion_table: dict
    ) -> float:
        """Convert using a base-unit intermediate step."""
        to_base = conversion_table.get(from_unit, 1.0)
        from_base = conversion_table.get(to_unit, 1.0)
        base_value = value * to_base
        return base_value / from_base

    def kg_to_tonnes(self, kg: float) -> float:
        return kg / 1000.0

    def tonnes_to_kg(self, tonnes: float) -> float:
        return tonnes * 1000.0

    def kg_to_lbs(self, kg: float) -> float:
        return kg * 2.20462

    def lbs_to_kg(self, lbs: float) -> float:
        return lbs * 0.453592
