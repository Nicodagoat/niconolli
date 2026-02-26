"""
Seed data for Italian emission factors.

Contains default factors from ISPRA, EMEP/EEA, IPCC, and MIT sources
used for DEASP reporting in Italian ports.
"""

ITALIAN_EMISSION_FACTORS = [
    # ============================================================
    # COMBUSTIBILI - ISPRA / IPCC
    # ============================================================
    {
        "category": "combustibili", "subcategory": "gasolio_autotrazione",
        "name": "Gasolio per autotrazione", "value": 3.155,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA - Fattori di emissione per fonti fossili 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 97.0,
    },
    {
        "category": "combustibili", "subcategory": "gasolio_riscaldamento",
        "name": "Gasolio per riscaldamento", "value": 3.151,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA - Fattori di emissione per fonti fossili 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 97.0,
    },
    {
        "category": "combustibili", "subcategory": "gasolio_litri",
        "name": "Gasolio (per litro)", "value": 0.002650,
        "unit": "tCO2/litro", "input_unit": "litri",
        "source": "ispra", "source_reference": "ISPRA 2024 - Conversione volumetrica",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "combustibili", "subcategory": "benzina",
        "name": "Benzina per autotrazione", "value": 3.140,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA - Fattori di emissione per fonti fossili 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 97.0,
    },
    {
        "category": "combustibili", "subcategory": "benzina_litri",
        "name": "Benzina (per litro)", "value": 0.002310,
        "unit": "tCO2/litro", "input_unit": "litri",
        "source": "ispra", "source_reference": "ISPRA 2024 - Conversione volumetrica",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "combustibili", "subcategory": "gpl",
        "name": "GPL", "value": 2.637,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "combustibili", "subcategory": "metano",
        "name": "Gas naturale (metano)", "value": 2.352,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 97.0,
    },
    {
        "category": "combustibili", "subcategory": "metano_mc",
        "name": "Gas naturale (per metro cubo)", "value": 0.001983,
        "unit": "tCO2/mc", "input_unit": "mc",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "combustibili", "subcategory": "olio_combustibile",
        "name": "Olio combustibile denso (BTZ)", "value": 3.238,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    # IPCC defaults (lower priority)
    {
        "category": "combustibili", "subcategory": "gasolio_autotrazione",
        "name": "Gasolio (IPCC default)", "value": 3.206,
        "unit": "tCO2/tep", "input_unit": "tep",
        "source": "ipcc", "source_reference": "IPCC 2006 Guidelines Vol 2 Ch 2",
        "priority": "globale_ipcc", "year_valid_from": 2006,
        "region": "Globale", "confidence_pct": 90.0,
    },

    # ============================================================
    # ELETTRICITA - ISPRA / TERNA
    # ============================================================
    {
        "category": "elettricita", "subcategory": "mix_nazionale",
        "name": "Mix elettrico nazionale italiano", "value": 0.000260,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA - Fattori emissione produzione elettrica 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "elettricita", "subcategory": "mix_nazionale",
        "name": "Mix elettrico nazionale italiano 2023", "value": 0.000280,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA - Fattori emissione produzione elettrica 2023",
        "priority": "nazionale_ispra", "year_valid_from": 2023, "year_valid_to": 2023,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "elettricita", "subcategory": "mix_nazionale",
        "name": "Mix elettrico nazionale italiano 2022", "value": 0.000310,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA - Fattori emissione produzione elettrica 2022",
        "priority": "nazionale_ispra", "year_valid_from": 2022, "year_valid_to": 2022,
        "region": "Italia", "confidence_pct": 95.0,
    },
    {
        "category": "elettricita", "subcategory": "rinnovabile_go",
        "name": "Energia rinnovabile con Garanzia di Origine", "value": 0.0,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "gse", "source_reference": "GSE - Garanzie di Origine",
        "priority": "nazionale_ispra", "year_valid_from": 2020,
        "region": "Italia", "confidence_pct": 99.0,
    },

    # ============================================================
    # NAVI - EMEP/EEA
    # ============================================================
    {
        "category": "navi", "subcategory": "fuel_oil",
        "name": "Olio combustibile navale (HFO)", "value": 3.114,
        "unit": "tCO2/t_combustibile", "input_unit": "t",
        "source": "emep_eea", "source_reference": "EMEP/EEA Emission Inventory Guidebook 2023 - Navigation",
        "priority": "europeo_emep", "year_valid_from": 2023,
        "region": "EU", "confidence_pct": 90.0,
    },
    {
        "category": "navi", "subcategory": "marine_diesel",
        "name": "Gasolio navale (MDO/MGO)", "value": 3.206,
        "unit": "tCO2/t_combustibile", "input_unit": "t",
        "source": "emep_eea", "source_reference": "EMEP/EEA Emission Inventory Guidebook 2023 - Navigation",
        "priority": "europeo_emep", "year_valid_from": 2023,
        "region": "EU", "confidence_pct": 90.0,
    },
    {
        "category": "navi", "subcategory": "lng",
        "name": "GNL navale (LNG)", "value": 2.750,
        "unit": "tCO2/t_combustibile", "input_unit": "t",
        "source": "emep_eea", "source_reference": "EMEP/EEA 2023 - LNG vessels",
        "priority": "europeo_emep", "year_valid_from": 2023,
        "region": "EU", "confidence_pct": 88.0,
    },
    {
        "category": "navi", "subcategory": "diesel",
        "name": "Diesel navale (default)", "value": 3.206,
        "unit": "tCO2/t_combustibile", "input_unit": "t",
        "source": "emep_eea", "source_reference": "EMEP/EEA 2023",
        "priority": "europeo_emep", "year_valid_from": 2023,
        "region": "EU", "confidence_pct": 90.0,
    },

    # ============================================================
    # VEICOLI - ISPRA
    # ============================================================
    {
        "category": "veicoli", "subcategory": "auto_gasolio",
        "name": "Autovettura diesel - media", "value": 0.000171,
        "unit": "tCO2/km", "input_unit": "km",
        "source": "ispra", "source_reference": "ISPRA - Fattori emissioni trasporto stradale 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 85.0,
    },
    {
        "category": "veicoli", "subcategory": "auto_benzina",
        "name": "Autovettura benzina - media", "value": 0.000192,
        "unit": "tCO2/km", "input_unit": "km",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 85.0,
    },
    {
        "category": "veicoli", "subcategory": "furgone_gasolio",
        "name": "Furgone diesel", "value": 0.000249,
        "unit": "tCO2/km", "input_unit": "km",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 80.0,
    },
    {
        "category": "veicoli", "subcategory": "camion_gasolio",
        "name": "Camion diesel (medio)", "value": 0.000650,
        "unit": "tCO2/km", "input_unit": "km",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 80.0,
    },

    # ============================================================
    # MACCHINARI - ISPRA
    # ============================================================
    {
        "category": "macchinari", "subcategory": "carrello_diesel",
        "name": "Carrello elevatore diesel", "value": 0.002650,
        "unit": "tCO2/litro", "input_unit": "litri",
        "source": "ispra", "source_reference": "ISPRA - Macchine movimento terra 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 80.0,
    },
    {
        "category": "macchinari", "subcategory": "carrello_elettrico",
        "name": "Carrello elevatore elettrico", "value": 0.000260,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA 2024 - usa fattore elettricità",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 90.0,
        "notes": "Usa fattore mix elettrico nazionale",
    },
    {
        "category": "macchinari", "subcategory": "gru_diesel",
        "name": "Gru portuale diesel", "value": 0.002650,
        "unit": "tCO2/litro", "input_unit": "litri",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 80.0,
    },
    {
        "category": "macchinari", "subcategory": "gru_elettrica",
        "name": "Gru portuale elettrica", "value": 0.000260,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA 2024 - usa fattore elettricità",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 90.0,
    },
    {
        "category": "macchinari", "subcategory": "reach_stacker_diesel",
        "name": "Reach stacker diesel", "value": 0.002650,
        "unit": "tCO2/litro", "input_unit": "litri",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 80.0,
    },
    {
        "category": "macchinari", "subcategory": "nastro_trasportatore",
        "name": "Nastro trasportatore (elettrico)", "value": 0.000260,
        "unit": "tCO2/kWh", "input_unit": "kWh",
        "source": "ispra", "source_reference": "ISPRA 2024",
        "priority": "nazionale_ispra", "year_valid_from": 2024,
        "region": "Italia", "confidence_pct": 90.0,
    },
]


async def seed_italian_factors(db):
    """Seed the Italian emission factors database."""
    from app.models.deasp.italian_factor import (
        ItalianEmissionFactor, ITFactorCategory, ITFactorSource, ITFactorPriority,
    )
    from sqlalchemy import select

    count = 0
    for fd in ITALIAN_EMISSION_FACTORS:
        existing = await db.execute(
            select(ItalianEmissionFactor).where(
                ItalianEmissionFactor.name == fd["name"],
                ItalianEmissionFactor.year_valid_from == fd["year_valid_from"],
            )
        )
        if existing.scalar_one_or_none():
            continue

        factor = ItalianEmissionFactor(
            category=ITFactorCategory(fd["category"]),
            subcategory=fd["subcategory"],
            name=fd["name"],
            value=fd["value"],
            unit=fd["unit"],
            input_unit=fd["input_unit"],
            source=ITFactorSource(fd["source"]),
            source_reference=fd.get("source_reference"),
            priority=ITFactorPriority(fd["priority"]),
            year_valid_from=fd["year_valid_from"],
            year_valid_to=fd.get("year_valid_to"),
            region=fd.get("region", "Italia"),
            confidence_pct=fd.get("confidence_pct"),
            notes=fd.get("notes"),
        )
        db.add(factor)
        count += 1

    await db.flush()
    return count
