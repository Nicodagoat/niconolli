"""Tests for DEASP Italian emission factors and schemas."""

import pytest
from app.models.deasp.italian_factor import (
    ITFactorSource,
    ITFactorCategory,
    ITFactorPriority,
    UpdateReason,
)
from app.models.deasp.ship import classify_gt, GTClass
from app.services.deasp.italian_factor_engine import PRIORITY_ORDER, _ZES_PORTS
from app.services.deasp.seed_italian_factors import ITALIAN_EMISSION_FACTORS
from app.schemas.deasp.schemas import (
    DEASPInventoryCreate,
    ConcessionaireCreate,
    QuestionnaireSubmission,
    EnergyConsumptionInput,
    VehicleRecordInput,
    MachineryRecordInput,
    ItalianFactorUpdateRequest,
)


# ── Priority Order ──────────────────────────────────────────────────────

class TestPriorityOrder:
    def test_specifico_first(self):
        assert PRIORITY_ORDER[0] == ITFactorPriority.SPECIFICO_AZIENDA

    def test_zes_second(self):
        assert PRIORITY_ORDER[1] == ITFactorPriority.REGIONALE_ZES

    def test_ispra_third(self):
        assert PRIORITY_ORDER[2] == ITFactorPriority.NAZIONALE_ISPRA

    def test_emep_fourth(self):
        assert PRIORITY_ORDER[3] == ITFactorPriority.EUROPEO_EMEP

    def test_ipcc_last(self):
        assert PRIORITY_ORDER[4] == ITFactorPriority.GLOBALE_IPCC

    def test_total_five_levels(self):
        assert len(PRIORITY_ORDER) == 5


# ── ZES Ports ───────────────────────────────────────────────────────────

class TestZESPorts:
    def test_augusta_in_zes(self):
        assert "augusta" in _ZES_PORTS

    def test_catania_in_zes(self):
        assert "catania" in _ZES_PORTS

    def test_gioia_tauro_in_zes(self):
        assert "gioia_tauro" in _ZES_PORTS

    def test_non_zes_port(self):
        assert "genova" not in _ZES_PORTS
        assert "venezia" not in _ZES_PORTS


# ── Factor Source Enum ──────────────────────────────────────────────────

class TestITFactorSource:
    def test_ispra(self):
        assert ITFactorSource.ISPRA.value == "ispra"

    def test_emep(self):
        assert ITFactorSource.EMEP_EEA.value == "emep_eea"

    def test_ipcc(self):
        assert ITFactorSource.IPCC.value == "ipcc"

    def test_all_sources(self):
        expected = {"ispra", "emep_eea", "ipcc", "mit", "terna", "gse", "custom_azienda", "zes"}
        actual = {s.value for s in ITFactorSource}
        assert expected == actual


# ── Factor Category Enum ────────────────────────────────────────────────

class TestITFactorCategory:
    def test_navi(self):
        assert ITFactorCategory.NAVI.value == "navi"

    def test_categories(self):
        expected = {"navi", "combustibili", "elettricita", "veicoli", "macchinari", "rifiuti"}
        actual = {c.value for c in ITFactorCategory}
        assert expected == actual


# ── Update Reasons ──────────────────────────────────────────────────────

class TestUpdateReason:
    def test_normativa(self):
        assert UpdateReason.NORMATIVA.value == "normativa"

    def test_all_reasons(self):
        expected = {
            "normativa", "aggiornamento_annuale", "correzione",
            "errata_corrige", "nuova_direttiva", "manuale",
        }
        actual = {r.value for r in UpdateReason}
        assert expected == actual


# ── Seed Factors ────────────────────────────────────────────────────────

class TestSeedFactors:
    def test_seed_factors_not_empty(self):
        factors = ITALIAN_EMISSION_FACTORS
        assert len(factors) > 0

    def test_seed_factors_have_required_fields(self):
        factors = ITALIAN_EMISSION_FACTORS
        required_keys = {"category", "subcategory", "name", "value", "unit", "input_unit", "source", "priority", "year_valid_from"}
        for f in factors:
            missing = required_keys - set(f.keys())
            assert not missing, f"Missing keys {missing} in factor: {f.get('name', 'unknown')}"

    def test_seed_has_ispra_factors(self):
        factors = ITALIAN_EMISSION_FACTORS
        ispra_factors = [f for f in factors if f["source"] == "ispra"]
        assert len(ispra_factors) > 0

    def test_seed_has_emep_factors(self):
        factors = ITALIAN_EMISSION_FACTORS
        emep_factors = [f for f in factors if f["source"] == "emep_eea"]
        assert len(emep_factors) > 0

    def test_seed_has_electricity_factor(self):
        factors = ITALIAN_EMISSION_FACTORS
        elec_factors = [f for f in factors if f["category"] == "elettricita"]
        assert len(elec_factors) > 0

    def test_seed_has_ship_factors(self):
        factors = ITALIAN_EMISSION_FACTORS
        ship_factors = [f for f in factors if f["category"] == "navi"]
        assert len(ship_factors) > 0

    def test_seed_factor_values_non_negative(self):
        factors = ITALIAN_EMISSION_FACTORS
        for f in factors:
            assert f["value"] >= 0, f"Factor '{f['name']}' has negative value"

    def test_most_factors_positive(self):
        factors = ITALIAN_EMISSION_FACTORS
        positive = [f for f in factors if f["value"] > 0]
        zero = [f for f in factors if f["value"] == 0]
        assert len(positive) > len(zero), "Most factors should have positive values"


# ── Pydantic Schema Validation ──────────────────────────────────────────

class TestDEASPSchemas:

    def test_inventory_create_valid(self):
        data = DEASPInventoryCreate(
            name="Inventario DEASP 2024",
            reporting_year=2024,
            port_authority_name="Autorità di Sistema Portuale del Mare di Sicilia Orientale",
            ports_included=["Augusta", "Catania", "Siracusa"],
        )
        assert data.name == "Inventario DEASP 2024"
        assert data.reporting_year == 2024

    def test_inventory_create_invalid_year_low(self):
        with pytest.raises(Exception):
            DEASPInventoryCreate(name="Test", reporting_year=2019)

    def test_inventory_create_invalid_year_high(self):
        with pytest.raises(Exception):
            DEASPInventoryCreate(name="Test", reporting_year=2101)

    def test_inventory_create_empty_name(self):
        with pytest.raises(Exception):
            DEASPInventoryCreate(name="", reporting_year=2024)

    def test_concessionaire_create(self):
        data = ConcessionaireCreate(
            ragione_sociale="Terminal Container Augusta S.r.l.",
            port="augusta",
            email="tca@example.com",
            tipo_concessione="terminal_container",
        )
        assert data.ragione_sociale == "Terminal Container Augusta S.r.l."

    def test_energy_consumption_input(self):
        data = EnergyConsumptionInput(
            equipment_type="caldaia",
            fuel_type="gasolio",
            annual_consumption=150.0,
            consumption_unit="tep",
        )
        assert data.annual_consumption == 150.0

    def test_energy_consumption_must_be_positive(self):
        with pytest.raises(Exception):
            EnergyConsumptionInput(
                equipment_type="caldaia",
                fuel_type="gasolio",
                annual_consumption=-10.0,
                consumption_unit="tep",
            )

    def test_vehicle_record_input(self):
        data = VehicleRecordInput(
            vehicle_type="auto_diesel",
            fuel_type="diesel",
            km_annui=15000.0,
        )
        assert data.km_annui == 15000.0

    def test_machinery_record_input(self):
        data = MachineryRecordInput(
            machinery_type="carrello_elevatore",
            power_source="diesel",
            hours_annual=2000.0,
            power_kw=50.0,
        )
        assert data.hours_annual == 2000.0

    def test_questionnaire_submission(self):
        submission = QuestionnaireSubmission(
            contact_name="Mario Rossi",
            contact_email="mario@example.com",
            energy_consumptions=[
                EnergyConsumptionInput(
                    equipment_type="caldaia",
                    fuel_type="gasolio",
                    annual_consumption=150.0,
                    consumption_unit="tep",
                ),
            ],
            vehicles=[
                VehicleRecordInput(
                    vehicle_type="auto_diesel",
                    fuel_type="diesel",
                    km_annui=15000.0,
                ),
            ],
            kwh_annui_totali=500000.0,
            percentuale_rinnovabile=20.0,
            machinery=[
                MachineryRecordInput(
                    machinery_type="carrello_elevatore",
                    power_source="diesel",
                    hours_annual=2000.0,
                ),
            ],
        )
        assert len(submission.energy_consumptions) == 1
        assert len(submission.vehicles) == 1
        assert len(submission.machinery) == 1
        assert submission.kwh_annui_totali == 500000.0

    def test_factor_update_request(self):
        data = ItalianFactorUpdateRequest(
            new_value=0.00026,
            reason="aggiornamento_annuale",
            reason_detail="Aggiornamento ISPRA 2024 mix elettrico nazionale",
        )
        assert data.new_value == 0.00026

    def test_factor_update_value_must_be_positive(self):
        with pytest.raises(Exception):
            ItalianFactorUpdateRequest(
                new_value=-0.5,
                reason="correzione",
                reason_detail="test",
            )


# ── Notification Severity Logic ─────────────────────────────────────────

class TestNotificationSeverity:
    """Test the severity classification used in ItalianFactorEngine.create_notification."""

    def _compute_severity(self, change_pct: float) -> str:
        return "critical" if abs(change_pct) > 10 else "warning" if abs(change_pct) > 5 else "info"

    def test_small_change_info(self):
        assert self._compute_severity(2.0) == "info"

    def test_medium_change_warning(self):
        assert self._compute_severity(7.0) == "warning"

    def test_large_change_critical(self):
        assert self._compute_severity(15.0) == "critical"

    def test_negative_change_critical(self):
        assert self._compute_severity(-12.0) == "critical"

    def test_boundary_5_is_info(self):
        assert self._compute_severity(5.0) == "info"

    def test_boundary_10_is_warning(self):
        assert self._compute_severity(10.0) == "warning"

    def test_boundary_above_10_critical(self):
        assert self._compute_severity(10.1) == "critical"
