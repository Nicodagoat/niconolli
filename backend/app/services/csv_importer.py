"""
CSV/Excel Import Service

Handles bulk upload of activity data with template validation.
"""

import csv
import io
from typing import Optional
from datetime import date

from app.models.activity import Scope, ActivityUnit, DataQuality
from app.schemas.activity import ActivityCreate


REQUIRED_COLUMNS = {"scope", "category", "activity_value", "activity_unit", "activity_date"}
OPTIONAL_COLUMNS = {
    "subcategory", "description", "fuel_type", "source_detail", "scope2_method",
    "period_start", "period_end", "data_quality", "data_source", "uncertainty_pct",
    "is_biogenic", "facility_id",
}

VALID_SCOPES = {s.value for s in Scope}
VALID_UNITS = {u.value for u in ActivityUnit}
VALID_QUALITY = {q.value for q in DataQuality}


class CSVImportError:
    def __init__(self, row: int, column: str, message: str):
        self.row = row
        self.column = column
        self.message = message

    def to_dict(self):
        return {"row": self.row, "column": self.column, "message": self.message}


class CSVImporter:
    def parse_csv(self, csv_content: str) -> tuple[list[ActivityCreate], list[CSVImportError]]:
        """Parse CSV content and return validated activities and errors."""
        activities = []
        errors = []

        reader = csv.DictReader(io.StringIO(csv_content))
        if reader.fieldnames is None:
            return [], [CSVImportError(0, "", "No columns found in CSV")]

        # Validate required columns
        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = REQUIRED_COLUMNS - headers
        if missing:
            return [], [CSVImportError(0, "", f"Missing required columns: {', '.join(missing)}")]

        for row_num, row in enumerate(reader, start=2):
            row = {k.strip().lower(): v.strip() for k, v in row.items() if v}
            row_errors = self._validate_row(row_num, row)
            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                activity = ActivityCreate(
                    scope=Scope(row["scope"]),
                    category=row["category"],
                    subcategory=row.get("subcategory"),
                    description=row.get("description"),
                    activity_value=float(row["activity_value"]),
                    activity_unit=ActivityUnit(row["activity_unit"]),
                    fuel_type=row.get("fuel_type"),
                    source_detail=row.get("source_detail"),
                    scope2_method=row.get("scope2_method"),
                    activity_date=date.fromisoformat(row["activity_date"]),
                    period_start=date.fromisoformat(row["period_start"]) if row.get("period_start") else None,
                    period_end=date.fromisoformat(row["period_end"]) if row.get("period_end") else None,
                    data_quality=DataQuality(row.get("data_quality", "medium")),
                    data_source=row.get("data_source"),
                    uncertainty_pct=float(row["uncertainty_pct"]) if row.get("uncertainty_pct") else None,
                    is_biogenic=row.get("is_biogenic", "").lower() in ("true", "1", "yes"),
                )
                activities.append(activity)
            except Exception as e:
                errors.append(CSVImportError(row_num, "", f"Parse error: {str(e)}"))

        return activities, errors

    def _validate_row(self, row_num: int, row: dict) -> list[CSVImportError]:
        errors = []

        # Scope
        if row.get("scope") not in VALID_SCOPES:
            errors.append(CSVImportError(row_num, "scope", f"Invalid scope: {row.get('scope')}. Must be one of: {', '.join(VALID_SCOPES)}"))

        # Activity value
        try:
            val = float(row.get("activity_value", ""))
            if val <= 0:
                errors.append(CSVImportError(row_num, "activity_value", "Activity value must be positive"))
        except ValueError:
            errors.append(CSVImportError(row_num, "activity_value", "Activity value must be a number"))

        # Activity unit
        if row.get("activity_unit") not in VALID_UNITS:
            errors.append(CSVImportError(row_num, "activity_unit", f"Invalid unit: {row.get('activity_unit')}"))

        # Date
        try:
            date.fromisoformat(row.get("activity_date", ""))
        except ValueError:
            errors.append(CSVImportError(row_num, "activity_date", "Invalid date format. Use YYYY-MM-DD"))

        # Data quality
        dq = row.get("data_quality", "medium")
        if dq not in VALID_QUALITY:
            errors.append(CSVImportError(row_num, "data_quality", f"Invalid data quality: {dq}"))

        return errors

    def generate_template(self) -> str:
        """Generate a CSV template for activity data upload."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "scope", "category", "subcategory", "description", "activity_value",
            "activity_unit", "fuel_type", "source_detail", "scope2_method",
            "activity_date", "period_start", "period_end", "data_quality",
            "data_source", "uncertainty_pct", "is_biogenic",
        ])
        # Example rows
        writer.writerow([
            "scope_1", "stationary_combustion", "", "Office heating",
            "5000", "therms", "natural_gas", "", "",
            "2024-01-15", "2024-01-01", "2024-03-31", "high",
            "Utility bill", "", "false",
        ])
        writer.writerow([
            "scope_2", "electricity", "", "Main office electricity",
            "120000", "kwh", "", "", "location_based",
            "2024-01-15", "2024-01-01", "2024-12-31", "high",
            "Smart meter", "", "false",
        ])
        writer.writerow([
            "scope_3", "cat_6_business_travel", "flights", "Employee flights Q1",
            "50000", "passenger_km", "flight_long_economy", "", "",
            "2024-03-31", "2024-01-01", "2024-03-31", "medium",
            "Travel booking system", "15", "false",
        ])
        return output.getvalue()
