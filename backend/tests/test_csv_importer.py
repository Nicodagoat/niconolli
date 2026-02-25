import pytest
from app.services.csv_importer import CSVImporter


@pytest.fixture
def importer():
    return CSVImporter()


class TestCSVImporter:
    def test_valid_csv_parsing(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date,data_quality
scope_1,stationary_combustion,5000,therms,2024-01-15,high
scope_2,electricity,120000,kwh,2024-06-15,high
scope_3,cat_6_business_travel,50000,passenger_km,2024-12-31,medium"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 3
        assert len(errors) == 0
        assert activities[0].scope.value == "scope_1"
        assert activities[0].activity_value == 5000.0
        assert activities[1].activity_unit.value == "kwh"

    def test_missing_required_columns(self, importer):
        csv_content = """scope,category,activity_value
scope_1,combustion,5000"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 0
        assert len(errors) == 1
        assert "Missing required columns" in errors[0].message

    def test_invalid_scope(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date
invalid_scope,combustion,5000,therms,2024-01-15"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(errors) > 0
        assert any("scope" in e.column.lower() for e in errors)

    def test_negative_value(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date
scope_1,stationary_combustion,-100,therms,2024-01-15"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(errors) > 0

    def test_invalid_date(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date
scope_1,stationary_combustion,5000,therms,not-a-date"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(errors) > 0
        assert any("date" in e.column.lower() for e in errors)

    def test_invalid_unit(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date
scope_1,stationary_combustion,5000,invalid_unit,2024-01-15"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(errors) > 0

    def test_optional_fields(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date,fuel_type,description,data_quality
scope_1,stationary_combustion,5000,therms,2024-01-15,natural_gas,Office heating,high"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 1
        assert len(errors) == 0
        assert activities[0].fuel_type == "natural_gas"
        assert activities[0].description == "Office heating"
        assert activities[0].data_quality.value == "high"

    def test_template_generation(self, importer):
        template = importer.generate_template()
        assert "scope" in template
        assert "category" in template
        assert "activity_value" in template
        assert "scope_1" in template  # Example row

    def test_empty_csv(self, importer):
        csv_content = ""
        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 0
        assert len(errors) >= 1

    def test_biogenic_flag(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date,is_biogenic
scope_1,stationary_combustion,5000,therms,2024-01-15,true"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 1
        assert activities[0].is_biogenic is True

    def test_multiple_errors_reported(self, importer):
        csv_content = """scope,category,activity_value,activity_unit,activity_date
invalid,x,-1,bad,not-date
bad,y,0,worse,still-bad"""

        activities, errors = importer.parse_csv(csv_content)
        assert len(activities) == 0
        assert len(errors) >= 4  # Multiple errors across rows
