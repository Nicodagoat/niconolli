# GHG Emissions Accounting Platform

A complete greenhouse gas emissions accounting platform for small and medium enterprises (SMEs). Calculate Scope 1, 2, and 3 emissions with automated conversion factor management, GHG Protocol compliance, and comprehensive reporting.

## Features

### Emissions Calculation Engine
- **Scope 1** - Direct emissions: stationary combustion, mobile combustion, fugitive emissions (refrigerants), process emissions
- **Scope 2** - Indirect energy: location-based and market-based electricity, purchased heat/steam/cooling
- **Scope 3** - Value chain: 11 categories including purchased goods, business travel, employee commuting, waste, upstream transportation

### Conversion Factor Management
- Pre-loaded factors from EPA, DEFRA/DESNZ, IEA, eGRID, and IPCC
- 35+ built-in emission factors covering all major emission sources
- Version control with full audit trail for factor changes
- Automatic notifications when factors change >5%
- Support for custom/uploaded emission factors
- Scheduled background updates via Celery

### Data Input
- Web forms with validation and guidance
- Bulk CSV upload with template validation
- Future-proof API architecture for ERP/utility integrations

### Standards Compliance
- GHG Protocol Corporate Standard
- ISO 14064-1 alignment
- CDP Climate Change response format
- GRI Standards alignment
- IPCC AR5/AR6 GWP values (configurable)

### Reporting & Visualization
- Real-time dashboard with scope breakdowns
- Pie charts, line trends, bar charts, Sankey-style emission flow diagrams
- Data quality distribution visualization
- Intensity metrics (per employee, per revenue)
- CSV/Excel export, GHG Protocol report, CDP format

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 16, Redis 7 |
| Background Tasks | Celery with Redis broker |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Visualization | Recharts |
| Forms | React Hook Form |
| State | Zustand |
| Infrastructure | Docker, Docker Compose, GitHub Actions CI/CD |

## Quick Start

### Using Docker Compose (recommended)

```bash
docker-compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Start PostgreSQL and Redis, then:
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Seed default emission factors:**
```bash
curl -X POST http://localhost:8000/api/v1/emission-factors/seed-defaults
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/organizations/` | Create organization |
| GET | `/api/v1/organizations/` | List organizations |
| POST | `/api/v1/inventories/` | Create GHG inventory |
| POST | `/api/v1/activities/{inventory_id}` | Add activity |
| POST | `/api/v1/activities/{inventory_id}/upload-csv` | Bulk CSV upload |
| GET | `/api/v1/activities/template` | Download CSV template |
| GET | `/api/v1/emission-factors/` | List emission factors |
| POST | `/api/v1/emission-factors/seed-defaults` | Load default factors |
| POST | `/api/v1/calculations/{inventory_id}/calculate` | Run calculations |
| GET | `/api/v1/calculations/{inventory_id}/summary` | Get emissions summary |
| GET | `/api/v1/calculations/{inventory_id}/breakdown` | Scope/category breakdown |
| GET | `/api/v1/calculations/{inventory_id}/trends` | Monthly trends |
| GET | `/api/v1/reports/{inventory_id}/ghg-protocol` | GHG Protocol report |
| GET | `/api/v1/reports/{inventory_id}/cdp` | CDP format |
| GET | `/api/v1/reports/{inventory_id}/export/calculations-csv` | Export CSV |

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/routes/          # FastAPI route handlers
│   │   ├── core/                # Config, database, security
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   │   ├── calculation_engine.py  # Core GHG calculations
│   │   │   ├── factor_manager.py      # Emission factor management
│   │   │   ├── unit_converter.py      # Unit conversions
│   │   │   ├── report_generator.py    # Report generation
│   │   │   └── csv_importer.py        # CSV bulk import
│   │   └── tasks/               # Celery background tasks
│   ├── tests/                   # pytest test suite
│   └── alembic/                 # Database migrations
├── frontend/
│   └── src/
│       ├── components/          # React components
│       │   ├── dashboard/       # Charts and visualizations
│       │   ├── forms/           # Activity forms, CSV upload
│       │   └── layout/          # Sidebar, header
│       ├── pages/               # Route pages
│       ├── services/            # API client
│       ├── store/               # Zustand state
│       └── types/               # TypeScript types
├── docker/                      # Dockerfiles, nginx config
├── docker-compose.yml
└── .github/workflows/ci.yml    # CI/CD pipeline
```

## Running Tests

```bash
# Backend
cd backend
python -m pytest tests/ -v

# Frontend
cd frontend
npm run test
```

## License

MIT
