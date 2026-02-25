"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError
from app.schemas.organization import OrganizationCreate
from app.schemas.inventory import InventoryCreate
from app.schemas.activity import ActivityCreate
from app.schemas.emission_factor import EmissionFactorCreate


class TestOrganizationSchema:
    def test_valid_organization(self, sample_organization):
        org = OrganizationCreate(**sample_organization)
        assert org.name == "Test Corp"
        assert org.industry.value == "technology"

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            OrganizationCreate(name="Test", country="USA")  # Missing industry

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            OrganizationCreate(name="", industry="technology", country="USA")

    def test_negative_employees_rejected(self):
        with pytest.raises(ValidationError):
            OrganizationCreate(
                name="Test", industry="technology", country="USA",
                employee_count=-1,
            )


class TestInventorySchema:
    def test_valid_inventory(self, sample_inventory):
        inv = InventoryCreate(**sample_inventory)
        assert inv.reporting_year == 2024
        assert inv.gwp_version.value == "ar6"

    def test_invalid_year_too_low(self):
        with pytest.raises(ValidationError):
            InventoryCreate(
                name="Test", reporting_year=1900,
                start_date="2024-01-01", end_date="2024-12-31",
            )


class TestActivitySchema:
    def test_valid_scope1_activity(self, sample_activity_scope1):
        act = ActivityCreate(**sample_activity_scope1)
        assert act.scope.value == "scope_1"
        assert act.activity_value == 5000.0

    def test_valid_scope2_activity(self, sample_activity_scope2):
        act = ActivityCreate(**sample_activity_scope2)
        assert act.scope.value == "scope_2"
        assert act.scope2_method == "location_based"

    def test_valid_scope3_activity(self, sample_activity_scope3):
        act = ActivityCreate(**sample_activity_scope3)
        assert act.scope.value == "scope_3"

    def test_zero_activity_value_rejected(self):
        with pytest.raises(ValidationError):
            ActivityCreate(
                scope="scope_1", category="stationary_combustion",
                activity_value=0, activity_unit="kwh",
                activity_date="2024-01-01", is_biogenic=False,
            )

    def test_negative_activity_value_rejected(self):
        with pytest.raises(ValidationError):
            ActivityCreate(
                scope="scope_1", category="stationary_combustion",
                activity_value=-100, activity_unit="kwh",
                activity_date="2024-01-01", is_biogenic=False,
            )


class TestEmissionFactorSchema:
    def test_valid_emission_factor(self, sample_emission_factor):
        ef = EmissionFactorCreate(**sample_emission_factor)
        assert ef.co2e_factor == 53.11
        assert ef.input_unit == "mmbtu"

    def test_negative_factor_rejected(self):
        with pytest.raises(ValidationError):
            EmissionFactorCreate(
                category="stationary_combustion",
                name="Bad Factor",
                co2_factor=-1, co2e_factor=-1,
                input_unit="kwh", year=2024,
            )
