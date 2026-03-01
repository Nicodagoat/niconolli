import { useState, useRef } from 'react';
import { Factory, Plus, Trash2, X, CheckCircle, Upload, Download, ChevronDown, ChevronUp, FileText, AlertTriangle } from 'lucide-react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// ── Activity Line Item (the core auditable unit) ──
export interface ActivityLineItem {
  id: string;
  activity_key: string;       // key into ACTIVITY_CATALOG
  description: string;        // free text for audit trail
  quantity: number;
  unit: string;
  ef_value: number;           // the actual EF applied
  ef_unit: string;
  ef_source: string;
  scope: 1 | 2;
  tco2: number;               // calculated = quantity * ef_value (with unit conversion)
  source_ref: string;         // 'manual' | 'csv_row_5' | 'questionnaire'
}

export interface ConcessionaireEntry {
  id: string;
  name: string;
  port: string;
  type: string;
  activities: ActivityLineItem[];
  scope1_tco2: number;
  scope2_tco2: number;
  total_tco2: number;
  imported_at: string;
}

// ── Emission Factor Table (all auditable, all with sources) ──
const EF_TABLE: Record<string, { value: number; unit: string; source: string; convert?: 'kg_to_t' }> = {
  // Energy
  electricity_grid:   { value: 0.000260,  unit: 'tCO2/kWh',    source: 'ISPRA 2024 NIR' },
  electricity_renew:  { value: 0.0,       unit: 'tCO2/kWh',    source: 'GO Certificate' },
  natural_gas:        { value: 0.00205,   unit: 'tCO2/kWh',    source: 'ISPRA 2024' },
  diesel:             { value: 2.68,      unit: 'kgCO2/litre', source: 'DEFRA 2024', convert: 'kg_to_t' },
  gasoline:           { value: 2.31,      unit: 'kgCO2/litre', source: 'DEFRA 2024', convert: 'kg_to_t' },
  lpg:                { value: 1.56,      unit: 'kgCO2/litre', source: 'DEFRA 2024', convert: 'kg_to_t' },
  heating_oil:        { value: 2.96,      unit: 'kgCO2/litre', source: 'DEFRA 2024', convert: 'kg_to_t' },
  fuel_oil:           { value: 3.17,      unit: 'kgCO2/litre', source: 'ISPRA 2024', convert: 'kg_to_t' },
  cng:                { value: 2.54,      unit: 'kgCO2/kg',    source: 'ISPRA 2024', convert: 'kg_to_t' },
  // Vehicles (per km)
  car_diesel:         { value: 0.000171,  unit: 'tCO2/km',     source: 'ISPRA 2024' },
  car_gasoline:       { value: 0.000164,  unit: 'tCO2/km',     source: 'ISPRA 2024' },
  car_hybrid:         { value: 0.000100,  unit: 'tCO2/km',     source: 'ISPRA 2024 est.' },
  car_electric:       { value: 0.000047,  unit: 'tCO2/km',     source: 'ISPRA 2024 (0.18 kWh/km * 0.260 gCO2/kWh)' },
  car_cng:            { value: 0.000130,  unit: 'tCO2/km',     source: 'ISPRA 2024' },
  car_lpg:            { value: 0.000152,  unit: 'tCO2/km',     source: 'ISPRA 2024' },
  van_diesel:         { value: 0.000250,  unit: 'tCO2/km',     source: 'DEFRA 2024 (van class III)' },
  truck_small:        { value: 0.000480,  unit: 'tCO2/km',     source: 'DEFRA 2024 (rigid 3.5-7.5t)' },
  truck_large:        { value: 0.000860,  unit: 'tCO2/km',     source: 'DEFRA 2024 (rigid >7.5t)' },
  motorbike:          { value: 0.000113,  unit: 'tCO2/km',     source: 'ISPRA 2024' },
  // Refrigerants
  refrigerant_r410a:  { value: 2.088,     unit: 'tCO2e/kg',    source: 'IPCC AR6 GWP100' },
  refrigerant_r134a:  { value: 1.430,     unit: 'tCO2e/kg',    source: 'IPCC AR6 GWP100' },
  refrigerant_r404a:  { value: 3.922,     unit: 'tCO2e/kg',    source: 'IPCC AR6 GWP100' },
  refrigerant_r407c:  { value: 1.774,     unit: 'tCO2e/kg',    source: 'IPCC AR6 GWP100' },
  // Water & Waste
  water_supply:       { value: 0.000344,  unit: 'tCO2/m3',     source: 'DEFRA 2024' },
  waste_landfill:     { value: 0.586,     unit: 'tCO2/tonne',  source: 'ISPRA 2024' },
  waste_recycling:    { value: 0.021,     unit: 'tCO2/tonne',  source: 'ISPRA 2024' },
  waste_incineration: { value: 0.021,     unit: 'tCO2/tonne',  source: 'ISPRA 2024' },
};

// ── Activity Catalog: questionnaire answer → deterministic EF mapping ──
interface CatalogItem {
  label: string;
  group: string;
  unit: string;
  ef_key: string;
  scope: 1 | 2;
}

const ACTIVITY_CATALOG: Record<string, CatalogItem> = {
  // ── Energia ──
  'electricity_grid':     { label: 'Elettricità da rete nazionale',       group: 'Energia',       unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  'electricity_renew':    { label: 'Elettricità 100% rinnovabile (GO)',    group: 'Energia',       unit: 'kWh',        ef_key: 'electricity_renew',  scope: 2 },
  'natural_gas':          { label: 'Gas naturale (metano)',                group: 'Energia',       unit: 'kWh',        ef_key: 'natural_gas',        scope: 1 },
  'diesel_heating':       { label: 'Gasolio per riscaldamento',           group: 'Energia',       unit: 'litri',      ef_key: 'diesel',             scope: 1 },
  'lpg_heating':          { label: 'GPL per riscaldamento/cucina',        group: 'Energia',       unit: 'litri',      ef_key: 'lpg',                scope: 1 },
  'heating_oil':          { label: 'Olio combustibile',                   group: 'Energia',       unit: 'litri',      ef_key: 'heating_oil',        scope: 1 },
  'fuel_oil':             { label: 'Olio combustibile pesante (BTZ)',     group: 'Energia',       unit: 'litri',      ef_key: 'fuel_oil',           scope: 1 },
  // ── Flotta Veicoli ──
  'car_diesel':           { label: 'Auto aziendale diesel',               group: 'Veicoli',       unit: 'km',         ef_key: 'car_diesel',         scope: 1 },
  'car_gasoline':         { label: 'Auto aziendale benzina',              group: 'Veicoli',       unit: 'km',         ef_key: 'car_gasoline',       scope: 1 },
  'car_hybrid':           { label: 'Auto aziendale ibrida',              group: 'Veicoli',       unit: 'km',         ef_key: 'car_hybrid',         scope: 1 },
  'car_electric':         { label: 'Auto aziendale elettrica',           group: 'Veicoli',       unit: 'km',         ef_key: 'car_electric',       scope: 2 },
  'car_cng':              { label: 'Auto aziendale metano CNG',          group: 'Veicoli',       unit: 'km',         ef_key: 'car_cng',            scope: 1 },
  'car_lpg':              { label: 'Auto aziendale GPL',                 group: 'Veicoli',       unit: 'km',         ef_key: 'car_lpg',            scope: 1 },
  'van_diesel':           { label: 'Furgone diesel',                     group: 'Veicoli',       unit: 'km',         ef_key: 'van_diesel',         scope: 1 },
  'truck_small':          { label: 'Autocarro leggero (3.5-7.5t)',       group: 'Veicoli',       unit: 'km',         ef_key: 'truck_small',        scope: 1 },
  'truck_large':          { label: 'Autocarro pesante (>7.5t)',          group: 'Veicoli',       unit: 'km',         ef_key: 'truck_large',        scope: 1 },
  'motorbike':            { label: 'Motociclo / Scooter',                group: 'Veicoli',       unit: 'km',         ef_key: 'motorbike',          scope: 1 },
  // ── Mezzi Portuali ──
  'forklift_diesel':      { label: 'Carrello elevatore diesel',          group: 'Mezzi portuali', unit: 'litri',     ef_key: 'diesel',             scope: 1 },
  'forklift_lpg':         { label: 'Carrello elevatore GPL',             group: 'Mezzi portuali', unit: 'litri',     ef_key: 'lpg',                scope: 1 },
  'forklift_electric':    { label: 'Carrello elevatore elettrico',       group: 'Mezzi portuali', unit: 'kWh',       ef_key: 'electricity_grid',   scope: 2 },
  'crane_diesel':         { label: 'Gru mobile diesel',                  group: 'Mezzi portuali', unit: 'litri',     ef_key: 'diesel',             scope: 1 },
  'crane_electric':       { label: 'Gru a portale elettrica',            group: 'Mezzi portuali', unit: 'kWh',       ef_key: 'electricity_grid',   scope: 2 },
  'reach_stacker':        { label: 'Reach stacker (impilatore)',         group: 'Mezzi portuali', unit: 'litri',     ef_key: 'diesel',             scope: 1 },
  'terminal_tractor':     { label: 'Trattore portuale',                  group: 'Mezzi portuali', unit: 'litri',     ef_key: 'diesel',             scope: 1 },
  'straddle_carrier':     { label: 'Straddle carrier',                   group: 'Mezzi portuali', unit: 'litri',     ef_key: 'diesel',             scope: 1 },
  // ── Altre Attrezzature ──
  'generator_diesel':     { label: 'Generatore diesel di emergenza',     group: 'Attrezzature',  unit: 'litri',      ef_key: 'diesel',             scope: 1 },
  'compressor':           { label: 'Compressore aria',                   group: 'Attrezzature',  unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  'pump_electric':        { label: 'Pompa elettrica',                    group: 'Attrezzature',  unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  'reefer_container':     { label: 'Container frigo (reefer)',           group: 'Attrezzature',  unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  'cold_storage':         { label: 'Cella frigorifera',                  group: 'Attrezzature',  unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  'lighting':             { label: 'Illuminazione piazzale/banchina',    group: 'Attrezzature',  unit: 'kWh',        ef_key: 'electricity_grid',   scope: 2 },
  // ── Refrigeranti ──
  'refrig_r410a':         { label: 'Perdita refrigerante R410A',         group: 'Refrigeranti',  unit: 'kg',         ef_key: 'refrigerant_r410a',  scope: 1 },
  'refrig_r134a':         { label: 'Perdita refrigerante R134A',         group: 'Refrigeranti',  unit: 'kg',         ef_key: 'refrigerant_r134a',  scope: 1 },
  'refrig_r404a':         { label: 'Perdita refrigerante R404A',         group: 'Refrigeranti',  unit: 'kg',         ef_key: 'refrigerant_r404a',  scope: 1 },
  'refrig_r407c':         { label: 'Perdita refrigerante R407C',         group: 'Refrigeranti',  unit: 'kg',         ef_key: 'refrigerant_r407c',  scope: 1 },
  // ── Acqua & Rifiuti ──
  'water':                { label: 'Consumo idrico',                     group: 'Acqua e Rifiuti', unit: 'm3',       ef_key: 'water_supply',       scope: 2 },
  'waste_landfill':       { label: 'Rifiuti in discarica',               group: 'Acqua e Rifiuti', unit: 'tonnellate', ef_key: 'waste_landfill',   scope: 1 },
  'waste_recycling':      { label: 'Rifiuti avviati a riciclo',          group: 'Acqua e Rifiuti', unit: 'tonnellate', ef_key: 'waste_recycling',  scope: 1 },
  'waste_incineration':   { label: 'Rifiuti a termovalorizzazione',      group: 'Acqua e Rifiuti', unit: 'tonnellate', ef_key: 'waste_incineration', scope: 1 },
};

const GROUPS = ['Energia', 'Veicoli', 'Mezzi portuali', 'Attrezzature', 'Refrigeranti', 'Acqua e Rifiuti'];

// ── Calculation engine (deterministic, auditable) ──
function calcTCO2(ef_key: string, quantity: number): { tco2: number; ef_value: number; ef_unit: string; ef_source: string } {
  const ef = EF_TABLE[ef_key];
  if (!ef) return { tco2: 0, ef_value: 0, ef_unit: '', ef_source: '' };
  const tco2 = ef.convert === 'kg_to_t' ? (quantity * ef.value) / 1000 : quantity * ef.value;
  return { tco2: Math.round(tco2 * 10000) / 10000, ef_value: ef.value, ef_unit: ef.unit, ef_source: ef.source };
}

function summarize(activities: ActivityLineItem[]): { scope1: number; scope2: number; total: number } {
  const scope1 = activities.filter(a => a.scope === 1).reduce((s, a) => s + a.tco2, 0);
  const scope2 = activities.filter(a => a.scope === 2).reduce((s, a) => s + a.tco2, 0);
  return { scope1: Math.round(scope1 * 100) / 100, scope2: Math.round(scope2 * 100) / 100, total: Math.round((scope1 + scope2) * 100) / 100 };
}

// ── Persistence ──
const STORAGE_KEY = 'deasp_concessionaires';

function loadData(): ConcessionaireEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Backward compat: if old format without activities, migrate
      return parsed.map((e: ConcessionaireEntry & { electricity_kwh?: number; diesel_litres?: number; lpg_litres?: number; vehicles_km?: number }) => {
        if (e.activities) return e;
        // Migrate old format
        const activities: ActivityLineItem[] = [];
        if (e.electricity_kwh && e.electricity_kwh > 0) {
          const c = calcTCO2('electricity_grid', e.electricity_kwh);
          activities.push({ id: `mig_elec_${e.id}`, activity_key: 'electricity_grid', description: 'Elettricità (migrato)', quantity: e.electricity_kwh, unit: 'kWh', ...c, scope: 2, source_ref: 'migrated' });
        }
        if (e.diesel_litres && e.diesel_litres > 0) {
          const c = calcTCO2('diesel', e.diesel_litres);
          activities.push({ id: `mig_diesel_${e.id}`, activity_key: 'diesel_heating', description: 'Gasolio (migrato)', quantity: e.diesel_litres, unit: 'litri', ...c, scope: 1, source_ref: 'migrated' });
        }
        if (e.lpg_litres && e.lpg_litres > 0) {
          const c = calcTCO2('lpg', e.lpg_litres);
          activities.push({ id: `mig_lpg_${e.id}`, activity_key: 'lpg_heating', description: 'GPL (migrato)', quantity: e.lpg_litres, unit: 'litri', ...c, scope: 1, source_ref: 'migrated' });
        }
        if (e.vehicles_km && e.vehicles_km > 0) {
          const c = calcTCO2('car_diesel', e.vehicles_km);
          activities.push({ id: `mig_veh_${e.id}`, activity_key: 'car_diesel', description: 'Veicoli (migrato)', quantity: e.vehicles_km, unit: 'km', ...c, scope: 1, source_ref: 'migrated' });
        }
        const sums = summarize(activities);
        return { ...e, activities, scope1_tco2: sums.scope1, scope2_tco2: sums.scope2, total_tco2: sums.total };
      });
    }
  } catch { /* ignore */ }
  return [];
}

function saveData(entries: ConcessionaireEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── CSV Import Parser ──
function parseCSVImport(text: string): ActivityLineItem[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const items: ActivityLineItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;
    // Expected: activity_key, description, quantity [, note]
    const key = cols[0].toLowerCase().replace(/\s+/g, '_');
    const desc = cols[1] || '';
    const qty = parseFloat(cols[2]);
    if (isNaN(qty) || qty === 0) continue;

    // Find matching catalog entry (exact or fuzzy)
    const catEntry = ACTIVITY_CATALOG[key] || findBestMatch(key);
    if (!catEntry) continue;

    const ef = EF_TABLE[catEntry.ef_key];
    if (!ef) continue;
    const calc = calcTCO2(catEntry.ef_key, qty);
    items.push({
      id: `csv_${Date.now()}_${i}`,
      activity_key: key,
      description: desc || catEntry.label,
      quantity: qty,
      unit: catEntry.unit,
      ...calc,
      scope: catEntry.scope,
      source_ref: `csv_row_${i}`,
    });
  }
  return items;
}

function findBestMatch(key: string): CatalogItem | null {
  // Fuzzy match: check if key contains a known catalog key or vice versa
  for (const [ck, cv] of Object.entries(ACTIVITY_CATALOG)) {
    if (key.includes(ck) || ck.includes(key)) return cv;
  }
  // Check labels
  for (const cv of Object.values(ACTIVITY_CATALOG)) {
    if (cv.label.toLowerCase().replace(/\s+/g, '_').includes(key)) return cv;
  }
  return null;
}

function generateTemplateCSV(): string {
  return '\ufeff' + [
    'activity_key,description,quantity',
    'electricity_grid,Consumo elettrico uffici e piazzale,500000',
    'diesel_heating,Gasolio per riscaldamento capannone,15000',
    'car_diesel,Flotta auto aziendali diesel (5 veicoli x 20000 km),100000',
    'van_diesel,Furgone consegne (2 mezzi x 30000 km),60000',
    'forklift_diesel,Carrelli elevatori diesel (consumo annuo),8000',
    'forklift_electric,Carrelli elevatori elettrici,25000',
    'crane_electric,Gru portuale elettrica,180000',
    'reach_stacker,Reach stacker (consumo gasolio annuo),12000',
    'generator_diesel,Generatore emergenza (ore x consumo/h),3000',
    'cold_storage,Celle frigorifere,250000',
    'reefer_container,Container frigo collegati a banchina,150000',
    'refrig_r410a,Perdita refrigerante clima uffici,8',
    'water,Consumo idrico annuo,5000',
    'waste_landfill,Rifiuti indifferenziati,50',
    'waste_recycling,Rifiuti differenziati avviati a riciclo,30',
  ].join('\n');
}

export default function ConcessionaireDataStep({ onNext, onBack }: Props) {
  const [entries, setEntries] = useState<ConcessionaireEntry[]>(loadData);
  const [showAddConc, setShowAddConc] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState<string | null>(null); // concessionaire id
  const [showCSVImport, setShowCSVImport] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Energia']));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvTarget, setCsvTarget] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');

  const [concForm, setConcForm] = useState({ name: '', port: 'Augusta', type: 'terminal' });
  const [actForm, setActForm] = useState({ activity_key: 'electricity_grid', description: '', quantity: '', count: '1' });

  // Add concessionaire
  const handleAddConc = () => {
    if (!concForm.name.trim()) return;
    const entry: ConcessionaireEntry = {
      id: `conc_${Date.now()}`,
      name: concForm.name.trim(),
      port: concForm.port,
      type: concForm.type,
      activities: [],
      scope1_tco2: 0, scope2_tco2: 0, total_tco2: 0,
      imported_at: new Date().toISOString(),
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveData(updated);
    setShowAddConc(false);
    setConcForm({ name: '', port: 'Augusta', type: 'terminal' });
  };

  // Add activity to a concessionaire
  const handleAddActivity = () => {
    if (!showAddActivity) return;
    const catEntry = ACTIVITY_CATALOG[actForm.activity_key];
    if (!catEntry) return;
    const qty = parseFloat(actForm.quantity) || 0;
    const count = parseInt(actForm.count) || 1;
    const totalQty = qty * count;
    if (totalQty <= 0) return;

    const calc = calcTCO2(catEntry.ef_key, totalQty);
    const item: ActivityLineItem = {
      id: `act_${Date.now()}`,
      activity_key: actForm.activity_key,
      description: actForm.description || (count > 1 ? `${catEntry.label} (${count} unità x ${qty.toLocaleString()} ${catEntry.unit})` : catEntry.label),
      quantity: totalQty,
      unit: catEntry.unit,
      ...calc,
      scope: catEntry.scope,
      source_ref: 'manual',
    };

    const updated = entries.map(e => {
      if (e.id !== showAddActivity) return e;
      const acts = [...e.activities, item];
      const sums = summarize(acts);
      return { ...e, activities: acts, scope1_tco2: sums.scope1, scope2_tco2: sums.scope2, total_tco2: sums.total };
    });
    setEntries(updated);
    saveData(updated);
    setShowAddActivity(null);
    setActForm({ activity_key: 'electricity_grid', description: '', quantity: '', count: '1' });
  };

  // Delete activity from concessionaire
  const handleDeleteActivity = (concId: string, actId: string) => {
    const updated = entries.map(e => {
      if (e.id !== concId) return e;
      const acts = e.activities.filter(a => a.id !== actId);
      const sums = summarize(acts);
      return { ...e, activities: acts, scope1_tco2: sums.scope1, scope2_tco2: sums.scope2, total_tco2: sums.total };
    });
    setEntries(updated);
    saveData(updated);
  };

  // Delete concessionaire
  const handleDeleteConc = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveData(updated);
  };

  // CSV Import
  const handleCSVImport = () => {
    if (!csvTarget || !csvText.trim()) return;
    const items = parseCSVImport(csvText);
    if (items.length === 0) return;

    const updated = entries.map(e => {
      if (e.id !== csvTarget) return e;
      const acts = [...e.activities, ...items];
      const sums = summarize(acts);
      return { ...e, activities: acts, scope1_tco2: sums.scope1, scope2_tco2: sums.scope2, total_tco2: sums.total };
    });
    setEntries(updated);
    saveData(updated);
    setShowCSVImport(null);
    setCsvTarget(null);
    setCsvText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) setCsvText(text);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([generateTemplateCSV()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'DEASP_questionario_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Totals
  const totalScope1 = entries.reduce((s, e) => s + e.scope1_tco2, 0);
  const totalScope2 = entries.reduce((s, e) => s + e.scope2_tco2, 0);
  const grandTotal = entries.reduce((s, e) => s + e.total_tco2, 0);
  const totalActivities = entries.reduce((s, e) => s + e.activities.length, 0);

  // Current activity form preview
  const previewCat = ACTIVITY_CATALOG[actForm.activity_key];
  const previewQty = (parseFloat(actForm.quantity) || 0) * (parseInt(actForm.count) || 1);
  const previewCalc = previewCat ? calcTCO2(previewCat.ef_key, previewQty) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Factory className="w-5 h-5 text-brand-yellow" />
          <span>Step 2: Dati Concessionari</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Inserisci i dati dai questionari dei concessionari portuali. Ogni voce viene mappata a un fattore di emissione certificato con audit trail completo.
        </p>
      </div>

      {/* Summary Cards */}
      {entries.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-surface-hover rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-brand-blue">{entries.length}</div>
            <div className="text-[10px] text-gray-400">Concessionari</div>
          </div>
          <div className="bg-surface-hover rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-400">{totalScope1.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400">Scope 1 (tCO2)</div>
          </div>
          <div className="bg-surface-hover rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{totalScope2.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400">Scope 2 (tCO2)</div>
          </div>
          <div className="bg-surface-hover rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-white">{grandTotal.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400">Totale (tCO2)</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-3">
        <button onClick={() => setShowAddConc(true)}
          className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /><span>Aggiungi Concessionario</span>
        </button>
        <button onClick={downloadTemplate}
          className="flex items-center space-x-2 px-3 py-2 text-xs border border-surface-border text-gray-400 rounded-lg hover:bg-surface-hover">
          <Download className="w-3 h-3" /><span>Scarica template questionario CSV</span>
        </button>
      </div>

      {/* Concessionaire Cards */}
      {entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map(conc => (
            <div key={conc.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              {/* Concessionaire Header */}
              <div className="flex items-center justify-between p-4 bg-surface-hover/50">
                <div>
                  <div className="text-sm font-semibold text-white">{conc.name}</div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-brand-blue/10 text-brand-blue">{conc.port}</span>
                    <span className="text-[10px] text-gray-500 capitalize">{conc.type.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-gray-500">{conc.activities.length} voci</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">
                      S1: <span className="text-red-400 font-mono">{conc.scope1_tco2.toFixed(2)}</span> |
                      S2: <span className="text-amber-400 font-mono">{conc.scope2_tco2.toFixed(2)}</span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono">{conc.total_tco2.toFixed(2)} tCO2</div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => { setShowAddActivity(conc.id); setActForm({ activity_key: 'electricity_grid', description: '', quantity: '', count: '1' }); }}
                      className="p-1.5 text-brand-green hover:bg-brand-green/10 rounded" title="Aggiungi voce">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setShowCSVImport(conc.id); setCsvTarget(conc.id); setCsvText(''); }}
                      className="p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded" title="Importa CSV">
                      <Upload className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowAudit(showAudit === conc.id ? null : conc.id)}
                      className="p-1.5 text-brand-yellow hover:bg-brand-yellow/10 rounded" title="Audit trail">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteConc(conc.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded" title="Elimina">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity Summary Table */}
              {conc.activities.length > 0 && (
                <div className="px-4 pb-3">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="border-b border-surface-border">
                        <th className="py-1.5 text-left font-medium text-gray-500">Attività</th>
                        <th className="py-1.5 text-right font-medium text-gray-500">Quantità</th>
                        <th className="py-1.5 text-left font-medium text-gray-500 pl-2">Unità</th>
                        <th className="py-1.5 text-center font-medium text-gray-500">Scope</th>
                        <th className="py-1.5 text-right font-medium text-gray-500">tCO2</th>
                        <th className="py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/50">
                      {conc.activities.map(act => (
                        <tr key={act.id} className="hover:bg-surface-hover/30">
                          <td className="py-1.5">
                            <span className="text-gray-300">{act.description || ACTIVITY_CATALOG[act.activity_key]?.label || act.activity_key}</span>
                          </td>
                          <td className="py-1.5 text-right font-mono text-gray-300">{act.quantity.toLocaleString()}</td>
                          <td className="py-1.5 text-gray-500 pl-2">{act.unit}</td>
                          <td className="py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${act.scope === 1 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              S{act.scope}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-mono font-medium text-white">{act.tco2.toFixed(4)}</td>
                          <td className="py-1.5 text-center">
                            <button onClick={() => handleDeleteActivity(conc.id, act.id)} className="text-gray-600 hover:text-red-400">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {conc.activities.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-500">Nessuna voce. Usa + per aggiungere o importa CSV dal questionario.</p>
                </div>
              )}

              {/* Audit Trail (expanded) */}
              {showAudit === conc.id && conc.activities.length > 0 && (
                <div className="border-t border-surface-border bg-brand-dark/50 p-4">
                  <h4 className="text-xs font-semibold text-brand-yellow mb-2 flex items-center space-x-1">
                    <FileText className="w-3 h-3" /><span>Audit Trail — {conc.name}</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="py-1 text-left text-gray-500">ID</th>
                          <th className="py-1 text-left text-gray-500">Attività</th>
                          <th className="py-1 text-right text-gray-500">Input</th>
                          <th className="py-1 text-left text-gray-500 pl-1">Unità</th>
                          <th className="py-1 text-left text-gray-500">×</th>
                          <th className="py-1 text-left text-gray-500">EF</th>
                          <th className="py-1 text-left text-gray-500">EF Unità</th>
                          <th className="py-1 text-left text-gray-500">Fonte EF</th>
                          <th className="py-1 text-left text-gray-500">=</th>
                          <th className="py-1 text-right text-gray-500">tCO2</th>
                          <th className="py-1 text-center text-gray-500">Scope</th>
                          <th className="py-1 text-left text-gray-500">Origine</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/30 font-mono">
                        {conc.activities.map(act => (
                          <tr key={act.id}>
                            <td className="py-1 text-gray-600">{act.id.slice(-6)}</td>
                            <td className="py-1 text-gray-300 font-sans">{ACTIVITY_CATALOG[act.activity_key]?.label || act.activity_key}</td>
                            <td className="py-1 text-right text-white">{act.quantity.toLocaleString()}</td>
                            <td className="py-1 text-gray-500 pl-1">{act.unit}</td>
                            <td className="py-1 text-gray-600">×</td>
                            <td className="py-1 text-brand-blue">{act.ef_value}</td>
                            <td className="py-1 text-gray-500">{act.ef_unit}</td>
                            <td className="py-1"><span className="px-1 py-0.5 bg-brand-blue/10 text-brand-blue rounded">{act.ef_source}</span></td>
                            <td className="py-1 text-gray-600">=</td>
                            <td className="py-1 text-right font-bold text-white">{act.tco2.toFixed(4)}</td>
                            <td className="py-1 text-center">
                              <span className={act.scope === 1 ? 'text-red-400' : 'text-amber-400'}>S{act.scope}</span>
                            </td>
                            <td className="py-1 text-gray-500 font-sans">{act.source_ref}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-surface-border rounded-xl p-8 text-center">
          <Factory className="w-10 h-10 mx-auto text-gray-500 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Nessun concessionario aggiunto</p>
          <p className="text-xs text-gray-500">Aggiungi i concessionari e importa i dati dai questionari compilati</p>
        </div>
      )}

      {/* EF Reference */}
      <div className="bg-surface-hover rounded-lg p-3 space-y-1">
        <p className="text-[10px] font-semibold text-gray-400">Fattori di emissione applicati ({Object.keys(EF_TABLE).length} fattori, {Object.keys(ACTIVITY_CATALOG).length} tipi attività):</p>
        <p className="text-[10px] text-gray-500">
          Elettricità: 0.000260 tCO2/kWh (ISPRA 2024) | Gasolio: 2.68 kgCO2/L (DEFRA 2024) | GPL: 1.56 kgCO2/L (DEFRA 2024) |
          Auto diesel: 0.000171 tCO2/km (ISPRA 2024) | Autocarro: 0.000860 tCO2/km (DEFRA 2024) |
          R410A: 2.088 tCO2e/kg (IPCC AR6) | Acqua: 0.000344 tCO2/m3 (DEFRA 2024)
        </p>
        <p className="text-[10px] text-gray-500">
          Ogni calcolo: Input × EF = tCO2. Nessun modello AI. Mappatura deterministica e verificabile.
        </p>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-brand-green" />
          <span className="text-xs text-brand-green">
            {entries.length} concessionari, {totalActivities} voci — {grandTotal.toFixed(1)} tCO2 totali.
            Ogni voce è auditabile (Input × EF = tCO2 con fonte certificata).
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-surface-border">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-surface-border rounded-lg hover:bg-surface-hover text-gray-300">
          ← Indietro
        </button>
        <button onClick={onNext}
          className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
          Prosegui → Calcolo Emissioni
        </button>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Concessionaire Modal */}
      {showAddConc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Nuovo Concessionario</h2>
              <button onClick={() => setShowAddConc(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome *</label>
                <input type="text" value={concForm.name} onChange={(e) => setConcForm({ ...concForm, name: e.target.value })}
                  placeholder="e.g., Terminal Container Augusta S.r.l."
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Porto</label>
                  <select value={concForm.port} onChange={(e) => setConcForm({ ...concForm, port: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="Augusta">Augusta</option>
                    <option value="Catania">Catania</option>
                    <option value="Siracusa">Siracusa</option>
                    <option value="Pozzallo">Pozzallo</option>
                    <option value="Gela">Gela</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={concForm.type} onChange={(e) => setConcForm({ ...concForm, type: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="terminal">Terminal Container</option>
                    <option value="deposito">Deposito Costiero</option>
                    <option value="logistica">Logistica</option>
                    <option value="bunkeraggio">Bunkeraggio</option>
                    <option value="cantiere">Cantiere Navale</option>
                    <option value="servizi">Servizi Portuali</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddConc(false)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Annulla</button>
              <button onClick={handleAddConc} disabled={!concForm.name.trim()}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Crea</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddActivity && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Aggiungi Voce Questionario</h2>
              <button onClick={() => setShowAddActivity(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {/* Activity type grouped by category */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo attività *</label>
                {GROUPS.map(group => {
                  const items = Object.entries(ACTIVITY_CATALOG).filter(([, v]) => v.group === group);
                  const isExpanded = expandedGroups.has(group);
                  return (
                    <div key={group} className="mb-1">
                      <button onClick={() => {
                        const next = new Set(expandedGroups);
                        isExpanded ? next.delete(group) : next.add(group);
                        setExpandedGroups(next);
                      }} className="w-full flex items-center justify-between px-3 py-2 bg-surface-hover rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-border">
                        <span>{group} ({items.length})</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-1 mt-1 pl-2">
                          {items.map(([key, item]) => (
                            <button key={key} onClick={() => setActForm({ ...actForm, activity_key: key })}
                              className={`text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                                actForm.activity_key === key
                                  ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30'
                                  : 'bg-surface-card text-gray-400 hover:text-white hover:bg-surface-hover border border-transparent'
                              }`}>
                              {item.label}
                              <span className="text-[9px] text-gray-600 ml-1">({item.unit})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descrizione (opzionale)</label>
                <input type="text" value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })}
                  placeholder="e.g., 3 carrelli elevatori diesel, turno mattina+pomeriggio"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>

              {/* Quantity and Count */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">N. unità/mezzi</label>
                  <input type="number" min="1" value={actForm.count} onChange={(e) => setActForm({ ...actForm, count: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Consumo per unità ({previewCat?.unit || ''}/anno) *
                  </label>
                  <input type="number" value={actForm.quantity} onChange={(e) => setActForm({ ...actForm, quantity: e.target.value })}
                    placeholder={previewCat?.unit === 'km' ? 'e.g., 20000' : previewCat?.unit === 'kWh' ? 'e.g., 500000' : 'e.g., 15000'}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
              </div>

              {/* Live preview with full audit chain */}
              {previewCalc && previewQty > 0 && (
                <div className="p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg space-y-1">
                  <p className="text-xs text-brand-green font-medium">Calcolo emissioni:</p>
                  <p className="text-xs text-brand-green font-mono">
                    {previewQty.toLocaleString()} {previewCat?.unit} × {previewCalc.ef_value} {previewCalc.ef_unit} = <strong>{previewCalc.tco2.toFixed(4)} tCO2</strong>
                  </p>
                  <p className="text-[10px] text-brand-green/70">
                    EF: {previewCalc.ef_source} | Scope {previewCat?.scope}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddActivity(null)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Annulla</button>
              <button onClick={handleAddActivity} disabled={!actForm.quantity || parseFloat(actForm.quantity) <= 0}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Aggiungi</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Importa dati questionario (CSV)</h2>
              <button onClick={() => { setShowCSVImport(null); setCsvText(''); }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-surface-hover rounded-lg">
                <p className="text-xs text-gray-400 mb-2">
                  Formato CSV: <code className="text-brand-blue">activity_key,description,quantity</code>
                </p>
                <p className="text-[10px] text-gray-500">
                  Chiavi attività: {Object.keys(ACTIVITY_CATALOG).slice(0, 8).join(', ')}...
                  ({Object.keys(ACTIVITY_CATALOG).length} tipi supportati)
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1 px-3 py-2 text-xs primary-gradient text-white rounded-lg">
                  <Upload className="w-3 h-3" /><span>Scegli file</span>
                </button>
                <button onClick={downloadTemplate}
                  className="flex items-center space-x-1 px-3 py-2 text-xs border border-surface-border text-gray-400 rounded-lg hover:bg-surface-hover">
                  <Download className="w-3 h-3" /><span>Template</span>
                </button>
              </div>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8}
                placeholder="activity_key,description,quantity&#10;electricity_grid,Consumo uffici,500000&#10;diesel_heating,Gasolio riscaldamento,15000&#10;car_diesel,Auto aziendali (5 x 20000km),100000"
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-3 text-xs text-white font-mono focus:outline-none focus:border-brand-blue" />
              {csvText && (
                <div className="text-xs text-gray-400">
                  {parseCSVImport(csvText).length} voci riconosciute su {csvText.trim().split('\n').length - 1} righe
                  {parseCSVImport(csvText).length < csvText.trim().split('\n').length - 1 && (
                    <span className="text-brand-yellow ml-2">
                      <AlertTriangle className="w-3 h-3 inline" /> Alcune righe non matchano. Verifica le chiavi attività.
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => { setShowCSVImport(null); setCsvText(''); }} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Annulla</button>
              <button onClick={handleCSVImport} disabled={!csvText.trim() || parseCSVImport(csvText).length === 0}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                Importa {parseCSVImport(csvText).length} voci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
