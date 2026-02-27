"""API routes for Client management and Dashboard."""

from fastapi import APIRouter, HTTPException
from uuid import UUID, uuid4
from datetime import datetime, timezone

from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientEmissions,
    DEASPProjectCreate, DEASPProjectUpdate, DEASPProjectResponse,
    DEASPProjectProgress, DashboardSummary,
)

router = APIRouter(tags=["clients"])

# In-memory stores (will be replaced with DB when PostgreSQL is connected)
_clients: dict[str, dict] = {}
_projects: dict[str, dict] = {}

# Seed demo data
def _seed_demo():
    if _clients:
        return
    demos = [
        {"name": "Porto di Augusta S.r.l.", "industry": "transportation", "status": "active",
         "contact_name": "Marco Ferretti", "contact_email": "m.ferretti@portoaugusta.it",
         "country": "ITA", "total_scope1_tonnes": 1250.3, "total_scope2_tonnes": 890.4,
         "total_scope3_tonnes": 2685.0, "total_co2e_tonnes": 4825.7},
        {"name": "Terminal Catania S.p.A.", "industry": "transportation", "status": "active",
         "contact_name": "Lucia Moretti", "contact_email": "l.moretti@terminalct.it",
         "country": "ITA", "total_scope1_tonnes": 820.1, "total_scope2_tonnes": 540.2,
         "total_scope3_tonnes": 1340.8, "total_co2e_tonnes": 2701.1},
        {"name": "Siracusa Port Services", "industry": "transportation", "status": "active",
         "contact_name": "Giuseppe Rizzo", "contact_email": "g.rizzo@srportservices.it",
         "country": "ITA", "total_scope1_tonnes": 450.5, "total_scope2_tonnes": 310.7,
         "total_scope3_tonnes": 980.3, "total_co2e_tonnes": 1741.5},
        {"name": "Navigazione Messina", "industry": "transportation", "status": "inactive",
         "contact_name": "Anna Bianchi", "contact_email": "a.bianchi@navme.it",
         "country": "ITA", "total_scope1_tonnes": 620.0, "total_scope2_tonnes": 410.0,
         "total_scope3_tonnes": 1100.0, "total_co2e_tonnes": 2130.0},
    ]
    for d in demos:
        cid = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        _clients[cid] = {"id": cid, **d, "notes": None, "address": None,
                         "contact_phone": None, "is_archived": False,
                         "created_at": now, "updated_at": now}

    # Demo projects
    client_ids = list(_clients.keys())
    proj_demos = [
        {"client_id": client_ids[0], "name": "Riduzione Emissioni Hotelling 2025",
         "description": "Installazione cold ironing per ridurre emissioni navi in sosta",
         "status": "in_progress", "target_reduction_tonnes": 500.0,
         "baseline_emissions_tonnes": 4825.7, "current_emissions_tonnes": 4100.2,
         "start_date": "2025-01-15", "end_date": "2025-12-31",
         "team_members": [{"name": "Marco Ferretti", "role": "Project Lead"},
                          {"name": "Elena Russo", "role": "Engineer"}],
         "ports_involved": ["augusta"], "reporting_year": 2025},
        {"client_id": client_ids[1], "name": "Elettrificazione Mezzi Portuali",
         "description": "Sostituzione carrelli elevatori diesel con elettrici",
         "status": "planning", "target_reduction_tonnes": 200.0,
         "baseline_emissions_tonnes": 2701.1, "current_emissions_tonnes": 2701.1,
         "start_date": "2025-06-01", "end_date": "2026-06-01",
         "team_members": [{"name": "Lucia Moretti", "role": "Project Lead"}],
         "ports_involved": ["catania"], "reporting_year": 2025},
        {"client_id": client_ids[0], "name": "Fotovoltaico Aree Portuali",
         "description": "Pannelli solari su coperture magazzini per ridurre Scope 2",
         "status": "completed", "target_reduction_tonnes": 300.0,
         "baseline_emissions_tonnes": 4825.7, "current_emissions_tonnes": 4500.0,
         "start_date": "2024-03-01", "end_date": "2024-12-31",
         "team_members": [{"name": "Marco Ferretti", "role": "Supervisor"},
                          {"name": "Paolo Conti", "role": "Installer"}],
         "ports_involved": ["augusta"], "reporting_year": 2024},
    ]
    for p in proj_demos:
        pid = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        bl = p.get("baseline_emissions_tonnes", 0)
        cur = p.get("current_emissions_tonnes", 0)
        tgt = p.get("target_reduction_tonnes", 0)
        progress = min(100.0, max(0.0, ((bl - cur) / tgt * 100) if tgt else 0))
        _projects[pid] = {"id": pid, **p, "activity_log": None,
                          "target_reduction_pct": None, "progress_pct": progress,
                          "created_at": now, "updated_at": now}

_seed_demo()


# ── Client endpoints ────────────────────────────────────────────────────

@router.get("/clients/", response_model=list[ClientResponse])
async def list_clients(status: str | None = None):
    clients = list(_clients.values())
    if status:
        clients = [c for c in clients if c["status"] == status]
    return clients


@router.post("/clients/", response_model=ClientResponse, status_code=201)
async def create_client(data: ClientCreate):
    cid = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    client = {
        "id": cid, **data.model_dump(), "status": "active",
        "total_scope1_tonnes": 0.0, "total_scope2_tonnes": 0.0,
        "total_scope3_tonnes": 0.0, "total_co2e_tonnes": 0.0,
        "is_archived": False, "created_at": now, "updated_at": now,
    }
    _clients[cid] = client
    return client


@router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: UUID):
    c = _clients.get(str(client_id))
    if not c:
        raise HTTPException(404, "Client not found")
    return c


@router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: UUID, data: ClientUpdate):
    c = _clients.get(str(client_id))
    if not c:
        raise HTTPException(404, "Client not found")
    updates = data.model_dump(exclude_unset=True)
    c.update(updates)
    c["updated_at"] = datetime.now(timezone.utc).isoformat()
    return c


@router.get("/clients/{client_id}/emissions", response_model=ClientEmissions)
async def get_client_emissions(client_id: UUID):
    c = _clients.get(str(client_id))
    if not c:
        raise HTTPException(404, "Client not found")
    return {
        "client_id": c["id"],
        "client_name": c["name"],
        "total_co2e_tonnes": c["total_co2e_tonnes"],
        "scope_1_tonnes": c["total_scope1_tonnes"],
        "scope_2_tonnes": c["total_scope2_tonnes"],
        "scope_3_tonnes": c["total_scope3_tonnes"],
    }


# ── DEASP Project endpoints ────────────────────────────────────────────

@router.get("/deasp-projects/", response_model=list[DEASPProjectResponse])
async def list_deasp_projects(client_id: str | None = None, status: str | None = None):
    projects = list(_projects.values())
    if client_id:
        projects = [p for p in projects if p["client_id"] == client_id]
    if status:
        projects = [p for p in projects if p["status"] == status]
    return projects


@router.post("/deasp-projects/", response_model=DEASPProjectResponse, status_code=201)
async def create_deasp_project(data: DEASPProjectCreate):
    if str(data.client_id) not in _clients:
        raise HTTPException(404, "Client not found")
    pid = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    proj = {
        "id": pid, **data.model_dump(), "client_id": str(data.client_id),
        "status": "planning", "activity_log": None,
        "target_reduction_pct": data.target_reduction_pct,
        "progress_pct": 0.0,
        "created_at": now, "updated_at": now,
    }
    _projects[pid] = proj
    return proj


@router.get("/deasp-projects/{project_id}", response_model=DEASPProjectResponse)
async def get_deasp_project(project_id: UUID):
    p = _projects.get(str(project_id))
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.put("/deasp-projects/{project_id}", response_model=DEASPProjectResponse)
async def update_deasp_project(project_id: UUID, data: DEASPProjectUpdate):
    p = _projects.get(str(project_id))
    if not p:
        raise HTTPException(404, "Project not found")
    updates = data.model_dump(exclude_unset=True)
    p.update(updates)
    p["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Recalculate progress
    bl = p.get("baseline_emissions_tonnes", 0)
    cur = p.get("current_emissions_tonnes", 0)
    tgt = p.get("target_reduction_tonnes", 0)
    p["progress_pct"] = min(100.0, max(0.0, ((bl - cur) / tgt * 100) if tgt else 0))
    return p


@router.get("/deasp-projects/{project_id}/progress", response_model=DEASPProjectProgress)
async def get_project_progress(project_id: UUID):
    p = _projects.get(str(project_id))
    if not p:
        raise HTTPException(404, "Project not found")
    return {
        "project_id": p["id"],
        "project_name": p["name"],
        "baseline_emissions": p.get("baseline_emissions_tonnes", 0),
        "current_emissions": p.get("current_emissions_tonnes", 0),
        "target_reduction": p.get("target_reduction_tonnes", 0),
        "progress_pct": p.get("progress_pct", 0),
        "status": p["status"],
    }


# ── Dashboard summary ──────────────────────────────────────────────────

@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    clients = list(_clients.values())
    projects = list(_projects.values())
    active_clients = [c for c in clients if c["status"] == "active"]
    active_projects = [p for p in projects if p["status"] in ("planning", "in_progress")]
    total_emissions = sum(c["total_co2e_tonnes"] for c in clients)
    return {
        "total_clients": len(clients),
        "active_clients": len(active_clients),
        "total_emissions_tonnes": total_emissions,
        "total_projects": len(projects),
        "active_projects": len(active_projects),
        "clients": clients,
        "projects": projects,
    }
