import pytest
from app.services.unit_converter import UnitConverter


@pytest.fixture
def converter():
    return UnitConverter()


class TestUnitConverter:
    def test_same_unit_returns_unchanged(self, converter):
        assert converter.convert(100.0, "kwh", "kwh") == 100.0

    def test_volume_gallons_to_liters(self, converter):
        result = converter.convert(1.0, "gallons_us", "liters")
        assert abs(result - 3.78541) < 0.001

    def test_volume_liters_to_gallons(self, converter):
        result = converter.convert(3.78541, "liters", "gallons_us")
        assert abs(result - 1.0) < 0.001

    def test_energy_mwh_to_kwh(self, converter):
        result = converter.convert(1.0, "mwh", "kwh")
        assert result == 1000.0

    def test_energy_therms_to_kwh(self, converter):
        result = converter.convert(1.0, "therms", "kwh")
        assert abs(result - 29.3001) < 0.01

    def test_energy_gj_to_kwh(self, converter):
        result = converter.convert(1.0, "gj", "kwh")
        assert abs(result - 277.778) < 0.01

    def test_mass_tonnes_to_kg(self, converter):
        result = converter.convert(1.0, "tonnes", "kg")
        assert result == 1000.0

    def test_mass_lbs_to_kg(self, converter):
        result = converter.convert(1.0, "lbs", "kg")
        assert abs(result - 0.453592) < 0.001

    def test_distance_miles_to_km(self, converter):
        result = converter.convert(1.0, "miles", "km")
        assert abs(result - 1.60934) < 0.001

    def test_kg_to_tonnes(self, converter):
        assert converter.kg_to_tonnes(1000.0) == 1.0
        assert converter.kg_to_tonnes(500.0) == 0.5

    def test_tonnes_to_kg(self, converter):
        assert converter.tonnes_to_kg(1.0) == 1000.0

    def test_kg_to_lbs(self, converter):
        result = converter.kg_to_lbs(1.0)
        assert abs(result - 2.20462) < 0.001

    def test_unknown_units_pass_through(self, converter):
        result = converter.convert(100.0, "unknown_unit", "kwh")
        assert result == 100.0

    def test_currency_pass_through(self, converter):
        result = converter.convert(100.0, "usd", "usd")
        assert result == 100.0

    def test_mmbtu_to_kwh(self, converter):
        result = converter.convert(1.0, "mmbtu", "kwh")
        assert abs(result - 293.071) < 0.1

    def test_roundtrip_conversion(self, converter):
        original = 100.0
        to_km = converter.convert(original, "miles", "km")
        back = converter.convert(to_km, "km", "miles")
        assert abs(back - original) < 0.001
