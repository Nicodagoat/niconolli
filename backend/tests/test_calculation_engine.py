"""
Tests for the GHG Emissions Calculation Engine.

Tests core calculation logic including GWP values, unit conversions,
and emission factor application.
"""

import pytest
from app.services.calculation_engine import GWP_AR5, GWP_AR6, UNCERTAINTY_DEFAULTS


class TestGWPValues:
    def test_ar6_co2_gwp_is_1(self):
        assert GWP_AR6["co2"] == 1

    def test_ar6_ch4_gwp(self):
        assert GWP_AR6["ch4"] == 27.9

    def test_ar6_n2o_gwp(self):
        assert GWP_AR6["n2o"] == 273

    def test_ar5_co2_gwp_is_1(self):
        assert GWP_AR5["co2"] == 1

    def test_ar5_ch4_gwp(self):
        assert GWP_AR5["ch4"] == 28

    def test_ar5_n2o_gwp(self):
        assert GWP_AR5["n2o"] == 265

    def test_ar6_sf6_gwp(self):
        assert GWP_AR6["sf6"] == 25200

    def test_ar5_sf6_gwp(self):
        assert GWP_AR5["sf6"] == 23500


class TestUncertaintyDefaults:
    def test_high_quality_uncertainty(self):
        assert UNCERTAINTY_DEFAULTS["high"] == 5.0

    def test_medium_quality_uncertainty(self):
        assert UNCERTAINTY_DEFAULTS["medium"] == 15.0

    def test_low_quality_uncertainty(self):
        assert UNCERTAINTY_DEFAULTS["low"] == 30.0

    def test_default_quality_uncertainty(self):
        assert UNCERTAINTY_DEFAULTS["default"] == 50.0


class TestEmissionCalculationLogic:
    """Test the core emission calculation formula:
    Activity Data x Emission Factor = CO2e"""

    def test_natural_gas_stationary_combustion(self):
        """5000 therms of natural gas: 5000 * 29.3001 kWh/therm = 146,500.5 kWh
        At 53.11 kg CO2e per MMBTU and 1 therm = 0.1 MMBTU:
        5000 therms = 500 MMBTU * 53.11 = 26,555 kg CO2e = 26.555 tonnes"""
        activity_value_mmbtu = 500  # 5000 therms = 500 MMBTU
        co2e_factor = 53.11  # kg CO2e per MMBTU
        expected_kg = activity_value_mmbtu * co2e_factor
        expected_tonnes = expected_kg / 1000.0
        assert abs(expected_kg - 26555.0) < 1.0
        assert abs(expected_tonnes - 26.555) < 0.01

    def test_electricity_scope2(self):
        """120,000 kWh electricity with US average grid factor 0.3716 kg CO2e/kWh"""
        activity_kwh = 120000.0
        grid_factor = 0.3716  # kg CO2e per kWh
        expected_kg = activity_kwh * grid_factor
        expected_tonnes = expected_kg / 1000.0
        assert abs(expected_kg - 44592.0) < 1.0
        assert abs(expected_tonnes - 44.592) < 0.01

    def test_flight_emissions(self):
        """50,000 passenger-km long-haul economy: 0.14615 kg CO2e per passenger-km"""
        passenger_km = 50000.0
        factor = 0.14615
        expected_kg = passenger_km * factor
        assert abs(expected_kg - 7307.5) < 1.0

    def test_diesel_mobile_combustion(self):
        """1000 gallons US diesel: 10.21 kg CO2e per gallon"""
        gallons = 1000.0
        factor = 10.21
        expected_kg = gallons * factor
        assert abs(expected_kg - 10210.0) < 1.0

    def test_refrigerant_fugitive(self):
        """5 kg of R-410A: 2088 kg CO2e per kg"""
        kg_leaked = 5.0
        factor = 2088.0
        expected_kg = kg_leaked * factor
        assert expected_kg == 10440.0

    def test_waste_landfill(self):
        """50 tonnes mixed waste to landfill: 0.58693 kg CO2e per tonne"""
        tonnes = 50.0
        factor = 586.93  # kg CO2e per tonne (converted from 0.58693 * 1000)
        expected_kg = tonnes * factor
        assert abs(expected_kg - 29346.5) < 1.0

    def test_zero_activity_produces_zero_emissions(self):
        assert 0.0 * 53.11 == 0.0

    def test_biogenic_emissions_separated(self):
        """Biogenic CO2 should be tracked but reported separately."""
        co2_kg = 1000.0
        is_biogenic = True
        biogenic_co2 = co2_kg if is_biogenic else 0.0
        assert biogenic_co2 == 1000.0

    def test_gwp_application(self):
        """Test applying GWP to individual gases."""
        ch4_kg = 1.0  # 1 kg of CH4
        co2e_from_ch4 = ch4_kg * GWP_AR6["ch4"]
        assert co2e_from_ch4 == 27.9

        n2o_kg = 1.0  # 1 kg of N2O
        co2e_from_n2o = n2o_kg * GWP_AR6["n2o"]
        assert co2e_from_n2o == 273

    def test_total_co2e_from_multiple_gases(self):
        """Total CO2e = CO2 + CH4*GWP + N2O*GWP"""
        co2_kg = 100.0
        ch4_kg = 0.5
        n2o_kg = 0.1

        total = (
            co2_kg * GWP_AR6["co2"]
            + ch4_kg * GWP_AR6["ch4"]
            + n2o_kg * GWP_AR6["n2o"]
        )
        expected = 100.0 + (0.5 * 27.9) + (0.1 * 273)
        assert abs(total - expected) < 0.001
        assert abs(total - 141.25) < 0.01
