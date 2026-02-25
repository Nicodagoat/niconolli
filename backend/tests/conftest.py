import pytest


@pytest.fixture
def sample_organization():
    return {
        "name": "Test Corp",
        "industry": "technology",
        "country": "USA",
        "employee_count": 500,
        "annual_revenue": 2000000.0,
        "revenue_currency": "USD",
    }


@pytest.fixture
def sample_inventory():
    return {
        "name": "2024 GHG Inventory",
        "reporting_year": 2024,
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "boundary_approach": "operational_control",
        "gwp_version": "ar6",
    }


@pytest.fixture
def sample_activity_scope1():
    return {
        "scope": "scope_1",
        "category": "stationary_combustion",
        "activity_value": 5000.0,
        "activity_unit": "therms",
        "fuel_type": "natural_gas",
        "activity_date": "2024-06-15",
        "data_quality": "high",
        "data_source": "Utility bill",
        "is_biogenic": False,
    }


@pytest.fixture
def sample_activity_scope2():
    return {
        "scope": "scope_2",
        "category": "electricity",
        "activity_value": 120000.0,
        "activity_unit": "kwh",
        "scope2_method": "location_based",
        "activity_date": "2024-06-15",
        "data_quality": "high",
        "data_source": "Smart meter",
        "is_biogenic": False,
    }


@pytest.fixture
def sample_activity_scope3():
    return {
        "scope": "scope_3",
        "category": "cat_6_business_travel",
        "activity_value": 50000.0,
        "activity_unit": "passenger_km",
        "fuel_type": "flight_long_economy",
        "activity_date": "2024-12-31",
        "data_quality": "medium",
        "is_biogenic": False,
    }


@pytest.fixture
def sample_emission_factor():
    return {
        "source": "epa",
        "category": "stationary_combustion",
        "name": "Natural Gas - Test",
        "co2_factor": 53.06,
        "ch4_factor": 0.001,
        "n2o_factor": 0.0001,
        "co2e_factor": 53.11,
        "input_unit": "mmbtu",
        "region": "US",
        "year": 2024,
        "gwp_version": "ar6",
        "fuel_type": "natural_gas",
    }
