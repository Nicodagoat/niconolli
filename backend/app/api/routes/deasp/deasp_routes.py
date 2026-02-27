"""
DEASP Italia API routes.

Provides endpoints for:
- DEASP inventory management
- Ship data import and calculation
- Concessionaire questionnaire management
- Italian emission factor management with audit trail
- DEASP report generation
- Dashboard statistics and notifications
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.deasp.deasp_inventory import DEASPInventory
from app.models.deasp.ship import ShipCall
from app.models.deasp.concessionaire import Concessionaire, Questionnaire, QuestionnaireResponse
from app.models.deasp.italian_factor import (
    ItalianEmissionFactor, ItalianFactorUpdate, FactorUpdateNotification, UpdateReason,
)
from app.schemas.deasp.schemas import (
    DEASPInventoryCreate, DEASPInventoryResponse,
    ConcessionaireCreate, ConcessionaireResponse,
    QuestionnaireCreate, QuestionnaireStatusResponse,
    QuestionnaireSubmission,
    ItalianFactorResponse, ItalianFactorUpdateRequest, FactorUpdateHistoryResponse,
    NotificationResponse, DEASPDashboardStats,
)
from app.services.deasp.ship_calculator import ShipCalculator
from app.services.deasp.italian_factor_engine import ItalianFactorEngine
from app.services.deasp.deasp_report_generator import DEASPReportGenerator
from app.services.deasp.seed_italian_factors import seed_italian_factors

router = APIRouter(prefix="/deasp", tags=["DEASP Italia"])


# ============================================================
# DEASP Inventory
# ============================================================

@router.post("/inventories", response_model=DEASPInventoryResponse, status_code=201)
async def create_deasp_inventory(
    org_id: UUID,
    data: DEASPInventoryCreate,
    db: AsyncSession = Depends(get_db),
):
    inv = DEASPInventory(organization_id=org_id, **data.model_dump())
    db.add(inv)
    await db.flush()
    await db.refresh(inv)
    return inv


@router.get("/inventories", response_model=list[DEASPInventoryResponse])
async def list_deasp_inventories(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DEASPInventory)
        .where(DEASPInventory.organization_id == org_id)
        .order_by(DEASPInventory.reporting_year.desc())
    )
    return result.scalars().all()


@router.get("/inventories/{inv_id}", response_model=DEASPInventoryResponse)
async def get_deasp_inventory(inv_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DEASPInventory).where(DEASPInventory.id == inv_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="DEASP inventory not found")
    return inv


# ============================================================
# Ship Data
# ============================================================

@router.post("/ships/{inv_id}/import", response_model=dict)
async def import_ship_data(
    inv_id: UUID,
    org_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Accettati solo file CSV")
    content = (await file.read()).decode("utf-8")
    calc = ShipCalculator(db)
    batch = await calc.import_ship_data(content, org_id, inv_id)
    return {
        "status": "success",
        "total_records": batch.total_records,
        "valid_records": batch.valid_records,
        "error_records": batch.error_records,
        "errors": batch.errors,
    }


@router.get("/ships/template", response_class=PlainTextResponse)
async def get_ship_template():
    calc = ShipCalculator(None)
    return PlainTextResponse(
        content=calc.generate_ship_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_navi_deasp.csv"},
    )


@router.post("/ships/{inv_id}/calculate", response_model=dict)
async def calculate_ship_emissions(
    inv_id: UUID,
    year: int = Query(2024),
    db: AsyncSession = Depends(get_db),
):
    calc = ShipCalculator(db)
    return await calc.calculate_all_ships(inv_id, year)


@router.get("/ships/{inv_id}", response_model=list[dict])
async def list_ship_calls(
    inv_id: UUID,
    port: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ShipCall).where(ShipCall.deasp_inventory_id == inv_id)
    if port:
        query = query.where(ShipCall.port == port)
    query = query.order_by(ShipCall.port, ShipCall.ship_name)
    result = await db.execute(query)
    ships = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "imo_number": s.imo_number,
            "ship_name": s.ship_name,
            "port": s.port.value,
            "gross_tonnage": s.gross_tonnage,
            "gt_class": s.gt_class.value if s.gt_class else None,
            "meet_category": s.meet_category.value,
            "hours_in_port": s.hours_in_port,
            "maneuver_count": s.maneuver_count,
            "fuel_type": s.fuel_type,
            "has_lng": s.has_lng,
            "shore_power_used": s.shore_power_used,
            "hotelling_co2_tonnes": s.hotelling_co2_tonnes,
            "maneuvering_co2_tonnes": s.maneuvering_co2_tonnes,
            "total_co2_tonnes": s.total_co2_tonnes,
        }
        for s in ships
    ]


# ============================================================
# Concessionaires & Questionnaires
# ============================================================

@router.post("/concessionaires", response_model=ConcessionaireResponse, status_code=201)
async def create_concessionaire(
    org_id: UUID,
    data: ConcessionaireCreate,
    db: AsyncSession = Depends(get_db),
):
    conc = Concessionaire(organization_id=org_id, **data.model_dump())
    db.add(conc)
    await db.flush()
    await db.refresh(conc)
    return conc


@router.get("/concessionaires", response_model=list[ConcessionaireResponse])
async def list_concessionaires(
    org_id: UUID,
    port: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Concessionaire).where(Concessionaire.organization_id == org_id)
    if port:
        query = query.where(Concessionaire.port == port)
    query = query.order_by(Concessionaire.ragione_sociale)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/questionnaires", response_model=dict, status_code=201)
async def create_questionnaire(
    data: QuestionnaireCreate,
    inv_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    import secrets
    q = Questionnaire(
        concessionaire_id=data.concessionaire_id,
        deasp_inventory_id=inv_id,
        reporting_year=data.reporting_year,
        deadline=data.deadline,
        access_token=secrets.token_urlsafe(32),
    )
    db.add(q)
    await db.flush()
    await db.refresh(q)
    return {"id": str(q.id), "access_token": q.access_token, "status": q.status.value}


@router.get("/questionnaires/{inv_id}/status", response_model=list[dict])
async def get_questionnaire_status(
    inv_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Questionnaire, Concessionaire)
        .join(Concessionaire)
        .where(Questionnaire.deasp_inventory_id == inv_id)
        .order_by(Concessionaire.ragione_sociale)
    )
    rows = result.all()
    return [
        {
            "id": str(q.id),
            "concessionaire_name": c.ragione_sociale,
            "port": c.port,
            "status": q.status.value,
            "completion_pct": q.completion_pct,
            "sent_at": q.sent_at.isoformat() if q.sent_at else None,
            "completed_at": q.completed_at.isoformat() if q.completed_at else None,
            "deadline": q.deadline.isoformat() if q.deadline else None,
        }
        for q, c in rows
    ]


@router.post("/questionnaires/{q_id}/submit", response_model=dict)
async def submit_questionnaire(
    q_id: UUID,
    data: QuestionnaireSubmission,
    db: AsyncSession = Depends(get_db),
):
    """Submit a completed questionnaire."""
    from datetime import datetime, timezone
    from app.models.deasp.concessionaire import (
        QuestionnaireStatus, EnergyConsumption,
        VehicleRecord, MachineryRecord, FuelTypeIT,
        VehicleTypeIT, MachineryTypeIT, MachineryPowerSource,
    )

    q = (await db.execute(select(Questionnaire).where(Questionnaire.id == q_id))).scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Questionario non trovato")

    # Create response
    response = QuestionnaireResponse(
        questionnaire_id=q_id,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        kwh_annui_totali=data.kwh_annui_totali,
        percentuale_rinnovabile=data.percentuale_rinnovabile,
        numero_pod=data.numero_pod,
        has_certificati_go=data.has_certificati_go,
        raw_data=data.model_dump(),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(response)
    await db.flush()

    # Add energy consumptions
    for ec in data.energy_consumptions:
        record = EnergyConsumption(
            response_id=response.id,
            equipment_type=ec.equipment_type,
            fuel_type=FuelTypeIT(ec.fuel_type),
            annual_consumption=ec.annual_consumption,
            consumption_unit=ec.consumption_unit,
            hours_operation=ec.hours_operation,
            notes=ec.notes,
        )
        db.add(record)

    # Add vehicles
    for v in data.vehicles:
        record = VehicleRecord(
            response_id=response.id,
            targa=v.targa,
            vehicle_type=VehicleTypeIT(v.vehicle_type),
            fuel_type=FuelTypeIT(v.fuel_type),
            km_annui=v.km_annui,
            consumo_litri=v.consumo_litri,
        )
        db.add(record)

    # Add machinery
    for m in data.machinery:
        record = MachineryRecord(
            response_id=response.id,
            machinery_type=MachineryTypeIT(m.machinery_type),
            description=m.description,
            power_source=MachineryPowerSource(m.power_source),
            power_kw=m.power_kw,
            hours_annual=m.hours_annual,
            fuel_consumption=m.fuel_consumption,
            fuel_unit=m.fuel_unit,
            electric_pct=m.electric_pct,
        )
        db.add(record)

    q.status = QuestionnaireStatus.COMPLETED
    q.completed_at = datetime.now(timezone.utc)
    q.completion_pct = 100.0

    await db.flush()
    return {"status": "completato", "response_id": str(response.id)}


# ============================================================
# Italian Emission Factors
# ============================================================

@router.get("/factors", response_model=list[ItalianFactorResponse])
async def list_italian_factors(
    category: Optional[str] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    engine = ItalianFactorEngine(db)
    query = select(ItalianEmissionFactor).where(ItalianEmissionFactor.is_active == True)  # noqa: E712
    if category:
        query = query.where(ItalianEmissionFactor.category == category)
    if source:
        query = query.where(ItalianEmissionFactor.source == source)
    if year:
        query = query.where(
            ItalianEmissionFactor.year_valid_from <= year,
            (ItalianEmissionFactor.year_valid_to == None) |  # noqa: E711
            (ItalianEmissionFactor.year_valid_to >= year),
        )
    if search:
        query = query.where(ItalianEmissionFactor.name.ilike(f"%{search}%"))
    query = query.order_by(ItalianEmissionFactor.category, ItalianEmissionFactor.subcategory)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/factors/{factor_id}/update", response_model=dict)
async def update_italian_factor(
    factor_id: UUID,
    data: ItalianFactorUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    engine = ItalianFactorEngine(db)
    factor = await engine.update_factor(
        factor_id=factor_id,
        new_value=data.new_value,
        reason=UpdateReason(data.reason),
        reason_detail=data.reason_detail,
        source_document=data.source_document,
        affected_ports=data.affected_ports,
    )
    return {
        "status": "aggiornato",
        "factor_name": factor.name,
        "new_value": factor.value,
        "version": factor.version,
    }


@router.get("/factors/{factor_id}/history", response_model=list[FactorUpdateHistoryResponse])
async def get_italian_factor_history(
    factor_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    engine = ItalianFactorEngine(db)
    return await engine.get_factor_history(factor_id)


@router.post("/factors/seed-defaults", response_model=dict)
async def seed_default_italian_factors(db: AsyncSession = Depends(get_db)):
    count = await seed_italian_factors(db)
    return {"seeded": count, "message": f"Caricati {count} fattori di emissione italiani"}


@router.get("/factors/sources-distribution", response_model=dict)
async def get_factor_sources(db: AsyncSession = Depends(get_db)):
    engine = ItalianFactorEngine(db)
    return await engine.get_factor_source_distribution()


# ============================================================
# Notifications
# ============================================================

@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    org_id: UUID,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    engine = ItalianFactorEngine(db)
    return await engine.get_notifications(org_id, unread_only)


@router.post("/notifications/{notif_id}/acknowledge", response_model=dict)
async def acknowledge_notification(
    notif_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    result = await db.execute(
        select(FactorUpdateNotification).where(FactorUpdateNotification.id == notif_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    notif.is_read = True
    notif.acknowledged_at = datetime.now(timezone.utc)
    return {"status": "letta"}


# ============================================================
# Reports
# ============================================================

@router.get("/reports/{inv_id}/deasp")
async def get_deasp_report(inv_id: UUID, db: AsyncSession = Depends(get_db)):
    gen = DEASPReportGenerator(db)
    return await gen.generate_deasp_report(inv_id)


@router.get("/reports/{inv_id}/factors-sheet")
async def get_factors_sheet(
    inv_id: UUID,
    year: int = Query(2024),
    db: AsyncSession = Depends(get_db),
):
    gen = DEASPReportGenerator(db)
    return await gen.generate_factors_sheet(year)


@router.get("/reports/{inv_id}/update-history")
async def get_update_history(inv_id: UUID, db: AsyncSession = Depends(get_db)):
    gen = DEASPReportGenerator(db)
    return await gen.generate_update_history_sheet()


@router.get("/reports/{inv_id}/export-csv")
async def export_deasp_csv(inv_id: UUID, db: AsyncSession = Depends(get_db)):
    gen = DEASPReportGenerator(db)
    csv_content = await gen.export_deasp_csv(inv_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=deasp_{inv_id}.csv"},
    )


@router.get("/reports/{inv_id}/ships-csv")
async def export_ships_csv(inv_id: UUID, db: AsyncSession = Depends(get_db)):
    gen = DEASPReportGenerator(db)
    csv_content = await gen.generate_ship_summary_csv(inv_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=navi_deasp_{inv_id}.csv"},
    )


# ============================================================
# Dashboard
# ============================================================

@router.get("/dashboard/{org_id}", response_model=DEASPDashboardStats)
async def get_deasp_dashboard(org_id: UUID, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone

    # Active factors count
    factors_count = (await db.execute(
        select(func.count(ItalianEmissionFactor.id)).where(ItalianEmissionFactor.is_active == True)  # noqa: E712
    )).scalar() or 0

    # Factors updated this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    updates_count = (await db.execute(
        select(func.count(ItalianFactorUpdate.id)).where(
            ItalianFactorUpdate.created_at >= month_start
        )
    )).scalar() or 0

    # Unread notifications
    unread = (await db.execute(
        select(func.count(FactorUpdateNotification.id)).where(
            FactorUpdateNotification.organization_id == org_id,
            FactorUpdateNotification.is_read == False,  # noqa: E712
        )
    )).scalar() or 0

    # Questionnaire response rate
    total_q = (await db.execute(
        select(func.count(Questionnaire.id))
        .join(Concessionaire)
        .where(Concessionaire.organization_id == org_id)
    )).scalar() or 0
    completed_q = (await db.execute(
        select(func.count(Questionnaire.id))
        .join(Concessionaire)
        .where(Concessionaire.organization_id == org_id, Questionnaire.status == "completed")
    )).scalar() or 0
    response_rate = (completed_q / total_q * 100) if total_q > 0 else 0

    # Latest inventory total
    latest_inv = (await db.execute(
        select(DEASPInventory)
        .where(DEASPInventory.organization_id == org_id)
        .order_by(DEASPInventory.reporting_year.desc())
        .limit(1)
    )).scalar_one_or_none()

    total_co2 = latest_inv.grand_total_co2_tonnes if latest_inv and latest_inv.grand_total_co2_tonnes else 0.0

    # ISPRA publishes in June each year
    next_june = now.replace(month=6, day=15) if now.month < 6 else now.replace(year=now.year + 1, month=6, day=15)
    days_to_ispra = (next_june - now).days

    return DEASPDashboardStats(
        emissioni_totali_tCO2=round(total_co2, 2),
        fattori_attivi=factors_count,
        fattori_aggiornati_mese=updates_count,
        concessionari_rispondenti_pct=round(response_rate, 1),
        notifiche_non_lette=unread,
        prossimo_aggiornamento_ispra=f"tra {days_to_ispra} giorni",
    )
