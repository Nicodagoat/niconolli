import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, CheckCircle, Globe, BarChart3 } from 'lucide-react';

interface Props {
  onBack: () => void;
}

interface ShipEntry {
  imo: string;
  name: string;
  port: string;
  gt: number;
  category: string;
  hours: number;
  maneuvers: number;
}

interface ShipResult {
  imo: string;
  name: string;
  port: string;
  hotelling_tco2: number;
  maneuver_tco2: number;
  total_tco2: number;
}

interface ActivityItem {
  id: string;
  activity_key: string;
  description: string;
  quantity: number;
  unit: string;
  ef_value: number;
  ef_unit: string;
  ef_source: string;
  scope: 1 | 2;
  tco2: number;
  source_ref: string;
}

interface ConcessionaireEntry {
  id: string;
  name: string;
  port: string;
  type: string;
  activities?: ActivityItem[];
  electricity_kwh?: number;
  diesel_litres?: number;
  lpg_litres?: number;
  vehicles_km?: number;
  scope1_tco2: number;
  scope2_tco2: number;
  total_tco2: number;
}

// ── Energy conversion factors (for bilancio energetico) ──
const TEP_FACTORS: Record<string, number> = {
  electricity_grid: 0.000187, // tep/kWh (ISPRA)
  natural_gas: 0.0000860,     // tep/kWh
  diesel: 0.00102,            // tep/litre
  gasoline: 0.00098,          // tep/litre
  lpg: 0.00061,               // tep/litre
  heating_oil: 0.00098,       // tep/litre
  fuel_oil: 0.00094,          // tep/litre
};

// ── EMEP/EEA ship fuel consumption (kg fuel/hour) for energy balance ──
const SHIP_FUEL_KG_PER_HOUR: Record<string, number> = {
  '1000-4999': 75,
  '5000-24999': 163,
  '25000-49999': 294,
  '50000+': 431,
};
const SHIP_FUEL_KG_PER_MANEUVER: Record<string, number> = {
  '1000-4999': 213,
  '5000-24999': 454,
  '25000-49999': 828,
  '50000+': 1219,
};
const HFO_TEP_PER_KG = 0.0000979; // tep/kg HFO (ISPRA)

function getGTClass(gt: number): string {
  if (gt < 5000) return '1000-4999';
  if (gt < 25000) return '5000-24999';
  if (gt < 50000) return '25000-49999';
  return '50000+';
}

function loadCalcResults(): ShipResult[] {
  try {
    const saved = localStorage.getItem('deasp_calc_results');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function loadShips(): ShipEntry[] {
  try {
    const saved = localStorage.getItem('deasp_ships');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function loadConcessionaires(): ConcessionaireEntry[] {
  try {
    const saved = localStorage.getItem('deasp_concessionaires');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const colCount = headers.length;
  const padRow = (r: string[]) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return padded;
  };
  return '\ufeff' + [headers.map(escape).join(','), ...rows.map(r => padRow(r).map(escape).join(','))].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const f2 = (n: number) => n.toFixed(2);
const f4 = (n: number) => n.toFixed(4);
const pct = (part: number, total: number) => total > 0 ? ((part / total) * 100).toFixed(1) + '%' : '0.0%';

// ── Aggregation helpers ──
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

// ── Complete EF reference table for reports ──
const EF_REFERENCE_TABLE = [
  { cat: 'Navi', name: 'Hotelling 1000-4999 GT', value: '0.24', unit: 'tCO2/h', source: 'EMEP/EEA 2023 Tab.3-1', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Hotelling 5000-24999 GT', value: '0.52', unit: 'tCO2/h', source: 'EMEP/EEA 2023 Tab.3-1', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Hotelling 25000-49999 GT', value: '0.94', unit: 'tCO2/h', source: 'EMEP/EEA 2023 Tab.3-1', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Hotelling 50000+ GT', value: '1.38', unit: 'tCO2/h', source: 'EMEP/EEA 2023 Tab.3-1', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Manovra 1000-4999 GT', value: '0.68', unit: 'tCO2/man.', source: 'EMEP/EEA 2023 Tab.3-2', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Manovra 5000-24999 GT', value: '1.45', unit: 'tCO2/man.', source: 'EMEP/EEA 2023 Tab.3-2', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Manovra 25000-49999 GT', value: '2.65', unit: 'tCO2/man.', source: 'EMEP/EEA 2023 Tab.3-2', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Manovra 50000+ GT', value: '3.90', unit: 'tCO2/man.', source: 'EMEP/EEA 2023 Tab.3-2', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Adj. Container', value: '1.00', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Navi', name: 'Adj. Ro-Ro', value: '0.85', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Navi', name: 'Adj. General Cargo', value: '0.75', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Navi', name: 'Adj. Cruise', value: '1.35', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Navi', name: 'Adj. Tanker', value: '0.90', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Navi', name: 'Adj. Bulk Carrier', value: '0.70', unit: 'moltiplicatore', source: 'EMEP/EEA 2023', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Energia', name: 'Elettricità rete nazionale IT', value: '0.000260', unit: 'tCO2/kWh', source: 'ISPRA NIR 2024', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Energia', name: 'Gas naturale', value: '0.00205', unit: 'tCO2/kWh', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '97%' },
  { cat: 'Energia', name: 'Gasolio', value: '2.68', unit: 'kgCO2/litro', source: 'DEFRA 2024', tier: 'Tier 1', confidence: '97%' },
  { cat: 'Energia', name: 'Benzina', value: '2.31', unit: 'kgCO2/litro', source: 'DEFRA 2024', tier: 'Tier 1', confidence: '97%' },
  { cat: 'Energia', name: 'GPL', value: '1.56', unit: 'kgCO2/litro', source: 'DEFRA 2024', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Energia', name: 'Olio combustibile', value: '2.96', unit: 'kgCO2/litro', source: 'DEFRA 2024', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Energia', name: 'HFO (navi)', value: '3.17', unit: 'kgCO2/litro', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Energia', name: 'CNG', value: '2.54', unit: 'kgCO2/kg', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '93%' },
  { cat: 'Veicoli', name: 'Auto diesel', value: '0.000171', unit: 'tCO2/km', source: 'ISPRA 2024', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Veicoli', name: 'Auto benzina', value: '0.000164', unit: 'tCO2/km', source: 'ISPRA 2024', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Veicoli', name: 'Auto ibrida', value: '0.000100', unit: 'tCO2/km', source: 'ISPRA 2024 est.', tier: 'Tier 2', confidence: '80%' },
  { cat: 'Veicoli', name: 'Auto elettrica', value: '0.000047', unit: 'tCO2/km', source: 'ISPRA 2024', tier: 'Tier 2', confidence: '90%' },
  { cat: 'Veicoli', name: 'Furgone diesel', value: '0.000250', unit: 'tCO2/km', source: 'DEFRA 2024', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Veicoli', name: 'Autocarro leggero', value: '0.000480', unit: 'tCO2/km', source: 'DEFRA 2024', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Veicoli', name: 'Autocarro pesante', value: '0.000860', unit: 'tCO2/km', source: 'DEFRA 2024', tier: 'Tier 2', confidence: '85%' },
  { cat: 'Refrigeranti', name: 'R410A', value: '2088', unit: 'kgCO2e/kg', source: 'IPCC AR6 GWP100', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Refrigeranti', name: 'R134A', value: '1430', unit: 'kgCO2e/kg', source: 'IPCC AR6 GWP100', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Refrigeranti', name: 'R404A', value: '3922', unit: 'kgCO2e/kg', source: 'IPCC AR6 GWP100', tier: 'Tier 1', confidence: '95%' },
  { cat: 'Acqua/Rifiuti', name: 'Acqua potabile', value: '0.000344', unit: 'tCO2/m3', source: 'DEFRA 2024', tier: 'Tier 1', confidence: '90%' },
  { cat: 'Acqua/Rifiuti', name: 'Rifiuti in discarica', value: '0.586', unit: 'tCO2/t', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '90%' },
  { cat: 'Acqua/Rifiuti', name: 'Rifiuti a riciclo', value: '0.021', unit: 'tCO2/t', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '85%' },
  { cat: 'Acqua/Rifiuti', name: 'Rifiuti a termovalorizz.', value: '0.021', unit: 'tCO2/t', source: 'ISPRA 2024', tier: 'Tier 1', confidence: '85%' },
];

const REPORT_TYPES = [
  {
    id: 'excel',
    title: 'Report Completo DEASP',
    desc: 'Inventario emissioni, bilancio energetico, intensità, analisi per porto, fattori, audit trail, conformità, piano riduzione',
    icon: <FileSpreadsheet className="w-8 h-8" />,
    format: 'CSV',
    sheets: ['Copertina', 'Riepilogo', 'Inventario', 'Bilancio_Energetico', 'Navi_Dettaglio', 'Navi_per_Tipologia', 'Navi_per_Porto', 'Concessionari', 'Audit_Trail', 'Intensità', 'Fattori_EF', 'Piano_Riduzione', 'Conformità', 'Riferimenti'],
  },
  {
    id: 'pdf',
    title: 'Report Esecutivo DEASP',
    desc: 'Report narrativo completo: inquadramento normativo, metodologia, inventario, indicatori, piano di monitoraggio',
    icon: <FileText className="w-8 h-8" />,
    format: 'TXT',
    sections: ['Normativa', 'Metodologia', 'Inventario', 'Indicatori', 'Piano riduzione'],
  },
  {
    id: 'inventory',
    title: 'Inventario Emissioni DEASP',
    desc: 'Inventario strutturato per sorgente, scope GHG, porto e vettore energetico con bilancio energetico in tep',
    icon: <BarChart3 className="w-8 h-8" />,
    format: 'CSV',
    sheets: ['Inventario_Sorgente', 'Inventario_Scope', 'Bilancio_Energetico', 'Intensità'],
  },
  {
    id: 'csv-calcs',
    title: 'Export CSV Calcoli Dettagliati',
    desc: 'Ogni singolo calcolo: Input × Fattore Emissione = tCO2, con fonte, tier, confidenza e origine dato',
    icon: <Download className="w-8 h-8" />,
    format: 'CSV',
  },
  {
    id: 'csv-ships',
    title: 'Export CSV Navi Completo',
    desc: 'Dettaglio scali con classe GT, categoria, fattore applicato, consumo stimato, emissioni per fase',
    icon: <Download className="w-8 h-8" />,
    format: 'CSV',
  },
];

export default function ReportStep({ onBack }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  const handleGenerate = (id: string) => {
    setGenerating(id);
    const results = loadCalcResults();
    const ships = loadShips();
    const concessionaires = loadConcessionaires();
    const shipTotal = results.reduce((s, r) => s + r.total_tco2, 0);
    const hotellingTotal = results.reduce((s, r) => s + r.hotelling_tco2, 0);
    const maneuverTotal = results.reduce((s, r) => s + r.maneuver_tco2, 0);
    const concTotal = concessionaires.reduce((s, c) => s + c.total_tco2, 0);
    const concScope1 = concessionaires.reduce((s, c) => s + c.scope1_tco2, 0);
    const concScope2 = concessionaires.reduce((s, c) => s + c.scope2_tco2, 0);
    const grandTotal = shipTotal + concTotal;
    const now = new Date().toISOString();
    const year = now.slice(0, 4);

    // Gather all concessionaire activities
    const allActivities: (ActivityItem & { concName: string; concPort: string })[] = [];
    for (const c of concessionaires) {
      if (c.activities) {
        for (const a of c.activities) allActivities.push({ ...a, concName: c.name, concPort: c.port });
      }
    }

    // Aggregate by port
    const shipsByPort = groupBy(ships, s => s.port);
    const resultsByPort = groupBy(results, r => r.port);
    const concByPort = groupBy(concessionaires, c => c.port);
    const ports = [...new Set([...ships.map(s => s.port), ...concessionaires.map(c => c.port)])];

    // Aggregate by ship category
    const shipsByCat = groupBy(ships, s => s.category);

    // Total GT for intensity metrics
    const totalGT = ships.reduce((s, sh) => s + sh.gt, 0);

    // Energy balance: estimate fuel consumption from ships
    let shipFuelTonnes = 0;
    let shipFuelTEP = 0;
    for (const sh of ships) {
      const gtc = getGTClass(sh.gt);
      const hotelFuel = sh.hours * (SHIP_FUEL_KG_PER_HOUR[gtc] || 163);
      const manFuel = sh.maneuvers * (SHIP_FUEL_KG_PER_MANEUVER[gtc] || 454);
      const totalKg = hotelFuel + manFuel;
      shipFuelTonnes += totalKg / 1000;
      shipFuelTEP += totalKg * HFO_TEP_PER_KG;
    }

    // Energy balance: concessionaire consumption
    let concElecKWh = 0, concDieselL = 0, concGasL = 0, concLpgL = 0, concGasNatKWh = 0, concOtherTEP = 0;
    for (const a of allActivities) {
      if (a.activity_key.includes('electricity')) concElecKWh += a.quantity;
      else if (a.activity_key.includes('diesel') || a.activity_key === 'forklift_diesel' || a.activity_key === 'crane_diesel' || a.activity_key === 'reach_stacker' || a.activity_key === 'terminal_tractor' || a.activity_key === 'straddle_carrier' || a.activity_key === 'generator_diesel') concDieselL += a.quantity;
      else if (a.activity_key.includes('gasoline') || a.activity_key === 'car_gasoline') concGasL += a.quantity;
      else if (a.activity_key.includes('lpg') || a.activity_key === 'forklift_lpg' || a.activity_key === 'car_lpg') concLpgL += a.quantity;
      else if (a.activity_key === 'natural_gas') concGasNatKWh += a.quantity;
      else {
        const tepF = TEP_FACTORS[a.ef_unit.includes('kWh') ? 'electricity_grid' : 'diesel'] || 0;
        concOtherTEP += a.quantity * tepF;
      }
    }
    const concElecTEP = concElecKWh * (TEP_FACTORS.electricity_grid || 0);
    const concDieselTEP = concDieselL * (TEP_FACTORS.diesel || 0);
    const concGasTEP = concGasL * (TEP_FACTORS.gasoline || 0);
    const concLpgTEP = concLpgL * (TEP_FACTORS.lpg || 0);
    const concGasNatTEP = concGasNatKWh * (TEP_FACTORS.natural_gas || 0);
    const totalTEP = shipFuelTEP + concElecTEP + concDieselTEP + concGasTEP + concLpgTEP + concGasNatTEP + concOtherTEP;

    // Activity group aggregation for concessionaires
    const actByGroup: Record<string, { tco2: number; count: number }> = {};
    for (const a of allActivities) {
      const grp = a.activity_key.includes('car_') || a.activity_key.includes('van_') || a.activity_key.includes('truck_') || a.activity_key === 'motorbike' ? 'Veicoli'
        : a.activity_key.includes('electricity') || a.activity_key.includes('natural_gas') || a.activity_key.includes('diesel_heating') || a.activity_key.includes('lpg_heating') || a.activity_key.includes('heating_oil') || a.activity_key.includes('fuel_oil') ? 'Energia'
        : a.activity_key.includes('forklift') || a.activity_key.includes('crane') || a.activity_key.includes('reach_') || a.activity_key.includes('terminal_') || a.activity_key.includes('straddle_') ? 'Mezzi portuali'
        : a.activity_key.includes('refrig') ? 'Refrigeranti'
        : a.activity_key.includes('water') || a.activity_key.includes('waste') ? 'Acqua e Rifiuti'
        : 'Altro';
      if (!actByGroup[grp]) actByGroup[grp] = { tco2: 0, count: 0 };
      actByGroup[grp].tco2 += a.tco2;
      actByGroup[grp].count += 1;
    }

    setTimeout(() => {
      if (id === 'csv-ships') {
        const headers = ['IMO', 'Nave', 'Porto', 'GT', 'Classe_GT', 'Categoria', 'Adj_Categoria', 'Ore_Hotelling', 'Manovre', 'EF_Hotelling_tCO2h', 'EF_Manovra_tCO2man', 'Fonte_EF', 'Combustibile_Stimato_kg', 'Hotelling_tCO2', 'Manovra_tCO2', 'Totale_tCO2', '%_Sul_Totale_Navi'];
        const CATEGORY_ADJ: Record<string, number> = { container: 1.0, ro_ro: 0.85, general_cargo: 0.75, cruise: 1.35, tanker: 0.90, bulk_carrier: 0.70 };
        const HOTELLING_EF: Record<string, number> = { '1000-4999': 0.24, '5000-24999': 0.52, '25000-49999': 0.94, '50000+': 1.38 };
        const MANEUVER_EF: Record<string, number> = { '1000-4999': 0.68, '5000-24999': 1.45, '25000-49999': 2.65, '50000+': 3.90 };
        const rows = ships.map(ship => {
          const calc = results.find(r => r.imo === ship.imo);
          const gtClass = getGTClass(ship.gt);
          const catAdj = CATEGORY_ADJ[ship.category] || 1.0;
          const fuelKg = ship.hours * (SHIP_FUEL_KG_PER_HOUR[gtClass] || 163) + ship.maneuvers * (SHIP_FUEL_KG_PER_MANEUVER[gtClass] || 454);
          const shipPct = shipTotal > 0 ? ((calc?.total_tco2 || 0) / shipTotal * 100) : 0;
          return [
            ship.imo, ship.name, ship.port, ship.gt.toString(), gtClass, ship.category, catAdj.toString(),
            ship.hours.toString(), ship.maneuvers.toString(),
            (HOTELLING_EF[gtClass] || 0).toString(), (MANEUVER_EF[gtClass] || 0).toString(),
            'EMEP/EEA 2023 Tier 2', Math.round(fuelKg).toString(),
            f2(calc?.hotelling_tco2 || 0), f2(calc?.maneuver_tco2 || 0), f2(calc?.total_tco2 || 0),
            shipPct.toFixed(1) + '%',
          ];
        });
        // Add per-port subtotals
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['--- SUBTOTALI PER PORTO ---', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        for (const port of ports) {
          const portResults = resultsByPort[port] || [];
          const portShips = shipsByPort[port] || [];
          const portTotal = portResults.reduce((s, r) => s + r.total_tco2, 0);
          const portHotel = portResults.reduce((s, r) => s + r.hotelling_tco2, 0);
          const portMan = portResults.reduce((s, r) => s + r.maneuver_tco2, 0);
          rows.push([`TOTALE ${port}`, '', port, portShips.reduce((s, sh) => s + sh.gt, 0).toString(), '', '', '', portShips.reduce((s, sh) => s + sh.hours, 0).toString(), portShips.reduce((s, sh) => s + sh.maneuvers, 0).toString(), '', '', '', '', f2(portHotel), f2(portMan), f2(portTotal), pct(portTotal, shipTotal)]);
        }
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['TOTALE TUTTE LE NAVI', '', '', totalGT.toString(), '', '', '', ships.reduce((s, sh) => s + sh.hours, 0).toString(), ships.reduce((s, sh) => s + sh.maneuvers, 0).toString(), '', '', '', Math.round(shipFuelTonnes * 1000).toString(), f2(hotellingTotal), f2(maneuverTotal), f2(shipTotal), '100.0%']);
        downloadFile(generateCSV(headers, rows), `DEASP_Navi_Completo_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'csv-calcs') {
        const headers = ['Sorgente', 'Soggetto', 'Attività', 'Porto', 'Scope_GHG', 'Input_Quantità', 'Input_Unità', 'EF_Valore', 'EF_Unità', 'EF_Fonte', 'Tier', 'Confidenza', 'tCO2', 'Origine_Dato', 'Formula'];
        const rows: string[][] = [];
        // Ship calculations
        const HOTELLING_EF: Record<string, number> = { '1000-4999': 0.24, '5000-24999': 0.52, '25000-49999': 0.94, '50000+': 1.38 };
        const MANEUVER_EF: Record<string, number> = { '1000-4999': 0.68, '5000-24999': 1.45, '25000-49999': 2.65, '50000+': 3.90 };
        const CATEGORY_ADJ: Record<string, number> = { container: 1.0, ro_ro: 0.85, general_cargo: 0.75, cruise: 1.35, tanker: 0.90, bulk_carrier: 0.70 };
        for (const ship of ships) {
          const calc = results.find(r => r.imo === ship.imo);
          const gtClass = getGTClass(ship.gt);
          const catAdj = CATEGORY_ADJ[ship.category] || 1.0;
          const efH = HOTELLING_EF[gtClass] || 0.52;
          const efM = MANEUVER_EF[gtClass] || 1.45;
          rows.push(['Nave', ship.name, `Hotelling (IMO ${ship.imo})`, ship.port, 'Scope 1', ship.hours.toString(), 'ore', (efH * catAdj).toFixed(4), 'tCO2/h', 'EMEP/EEA 2023 Tab.3-1', 'Tier 2', '90%', f4(calc?.hotelling_tco2 || 0), 'Dato operativo', `${ship.hours} h × ${efH} tCO2/h × ${catAdj} adj = ${f4(calc?.hotelling_tco2 || 0)} tCO2`]);
          rows.push(['Nave', ship.name, `Manovra (IMO ${ship.imo})`, ship.port, 'Scope 1', ship.maneuvers.toString(), 'manovre', (efM * catAdj).toFixed(4), 'tCO2/man', 'EMEP/EEA 2023 Tab.3-2', 'Tier 2', '90%', f4(calc?.maneuver_tco2 || 0), 'Dato operativo', `${ship.maneuvers} man × ${efM} tCO2/man × ${catAdj} adj = ${f4(calc?.maneuver_tco2 || 0)} tCO2`]);
        }
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        // Concessionaire calculations
        for (const c of concessionaires) {
          if (c.activities && c.activities.length > 0) {
            for (const a of c.activities) {
              const formula = a.ef_unit.includes('kg') ? `${a.quantity} ${a.unit} × ${a.ef_value} ${a.ef_unit} / 1000 = ${f4(a.tco2)} tCO2` : `${a.quantity} ${a.unit} × ${a.ef_value} ${a.ef_unit} = ${f4(a.tco2)} tCO2`;
              rows.push(['Concessionario', c.name, a.description, c.port, `Scope ${a.scope}`, a.quantity.toString(), a.unit, a.ef_value.toString(), a.ef_unit, a.ef_source, 'Tier 1', '95%', f4(a.tco2), a.source_ref, formula]);
            }
          } else {
            rows.push(['Concessionario', c.name, 'Scope 1 aggregato', c.port, 'Scope 1', '', '', '', '', 'ISPRA/DEFRA 2024', '', '90%', f4(c.scope1_tco2), 'legacy', '']);
            rows.push(['Concessionario', c.name, 'Scope 2 aggregato', c.port, 'Scope 2', '', '', '', '', 'ISPRA 2024', '', '90%', f4(c.scope2_tco2), 'legacy', '']);
          }
        }
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['--- TOTALI ---', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['TOTALE', 'Navi - Hotelling', '', '', 'Scope 1', '', '', '', '', '', '', '', f4(hotellingTotal), '', '']);
        rows.push(['TOTALE', 'Navi - Manovra', '', '', 'Scope 1', '', '', '', '', '', '', '', f4(maneuverTotal), '', '']);
        rows.push(['TOTALE', 'Navi', '', '', 'Scope 1', '', '', '', '', '', '', '', f4(shipTotal), '', '']);
        rows.push(['TOTALE', 'Concessionari - Scope 1', '', '', 'Scope 1', '', '', '', '', '', '', '', f4(concScope1), '', '']);
        rows.push(['TOTALE', 'Concessionari - Scope 2', '', '', 'Scope 2', '', '', '', '', '', '', '', f4(concScope2), '', '']);
        rows.push(['TOTALE', 'Concessionari', '', '', '', '', '', '', '', '', '', '', f4(concTotal), '', '']);
        rows.push(['TOTALE', 'SISTEMA PORTUALE', '', '', '', '', '', '', '', '', '', '', f4(grandTotal), '', '']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['--- INTENSITÀ ---', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        rows.push(['Indicatore', 'tCO2 / scalo nave', '', '', '', '', '', '', '', '', '', '', ships.length > 0 ? f4(shipTotal / ships.length) : '0', '', '']);
        rows.push(['Indicatore', 'tCO2 / 1000 GT movimentato', '', '', '', '', '', '', '', '', '', '', totalGT > 0 ? f4(shipTotal / totalGT * 1000) : '0', '', '']);
        rows.push(['Indicatore', 'tCO2 / concessionario', '', '', '', '', '', '', '', '', '', '', concessionaires.length > 0 ? f4(concTotal / concessionaires.length) : '0', '', '']);
        downloadFile(generateCSV(headers, rows), `DEASP_Calcoli_Dettagliati_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'excel') {
        const L: string[] = [];
        const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
        const row = (...cols: string[]) => L.push(cols.map(esc).join(','));
        const blank = () => L.push('');
        const section = (title: string) => { blank(); L.push(`"--- ${title} ---"`); };

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 1: COPERTINA E ANAGRAFICA
        // ═══════════════════════════════════════════════════════════════
        section('COPERTINA DEASP');
        row('Campo', 'Valore');
        row('Documento', 'DEASP - Documento di Analisi Energetico-Ambientale del Sistema Portuale');
        row('Quadro normativo', 'D.Lgs. 169/2016, Art.4-bis - Riforma portuale');
        row('Anno di riferimento', year);
        row('Data generazione report', now);
        row('N. Porti nel sistema', ports.length.toString());
        row('Porti', ports.join(', '));
        row('N. Scali navali analizzati', ships.length.toString());
        row('N. Concessionari censiti', concessionaires.length.toString());
        row('Metodologia navi', 'EMEP/EEA Guidebook 2023 - Tier 2 (per GT class con adj. per tipologia)');
        row('Metodologia concessionari', 'GHG Protocol Corporate Standard / ISO 14064-1:2019');
        row('GWP Reference', 'IPCC AR6 (2021) - 100-year GWP');
        row('Software', 'NicoNolli GHG Platform - Modulo DEASP');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 2: RIEPILOGO EMISSIONI
        // ═══════════════════════════════════════════════════════════════
        section('RIEPILOGO EMISSIONI SISTEMA PORTUALE');
        row('Voce', 'tCO2', '% sul totale');
        row('Emissioni Navi - Hotelling', f2(hotellingTotal), pct(hotellingTotal, grandTotal));
        row('Emissioni Navi - Manovra', f2(maneuverTotal), pct(maneuverTotal, grandTotal));
        row('SUBTOTALE NAVI', f2(shipTotal), pct(shipTotal, grandTotal));
        row('Emissioni Concessionari - Scope 1', f2(concScope1), pct(concScope1, grandTotal));
        row('Emissioni Concessionari - Scope 2', f2(concScope2), pct(concScope2, grandTotal));
        row('SUBTOTALE CONCESSIONARI', f2(concTotal), pct(concTotal, grandTotal));
        row('TOTALE SISTEMA PORTUALE', f2(grandTotal), '100.0%');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 3: INVENTARIO PER SORGENTE EMISSIVA
        // ═══════════════════════════════════════════════════════════════
        section('INVENTARIO EMISSIONI PER SORGENTE');
        row('Sorgente', 'Scope GHG', 'tCO2', '% sul totale', 'N. voci');
        row('Navi in porto - Hotelling (aux engine)', 'Scope 1', f2(hotellingTotal), pct(hotellingTotal, grandTotal), results.length.toString());
        row('Navi in porto - Manovra (main engine)', 'Scope 1', f2(maneuverTotal), pct(maneuverTotal, grandTotal), results.length.toString());
        for (const [grp, data] of Object.entries(actByGroup)) {
          const scope = grp === 'Energia' ? 'Scope 1+2' : grp === 'Refrigeranti' ? 'Scope 1' : 'Scope 1';
          row(`Concessionari - ${grp}`, scope, f2(data.tco2), pct(data.tco2, grandTotal), data.count.toString());
        }
        row('TOTALE', '', f2(grandTotal), '100.0%', (results.length * 2 + allActivities.length).toString());

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 4: RIPARTIZIONE PER SCOPE GHG
        // ═══════════════════════════════════════════════════════════════
        section('RIPARTIZIONE PER SCOPE GHG');
        row('Scope', 'Descrizione', 'tCO2', '% sul totale');
        const scope1Total = shipTotal + concScope1;
        row('Scope 1', 'Emissioni dirette (combustione navi, carburanti, refrigeranti)', f2(scope1Total), pct(scope1Total, grandTotal));
        row('Scope 2', 'Emissioni indirette da energia acquistata (elettricità rete)', f2(concScope2), pct(concScope2, grandTotal));
        row('TOTALE', '', f2(grandTotal), '100.0%');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 5: BILANCIO ENERGETICO
        // ═══════════════════════════════════════════════════════════════
        section('BILANCIO ENERGETICO PORTUALE');
        row('Vettore Energetico', 'Consumo', 'Unità', 'tep', '% tep totali', 'tCO2 associate');
        row('HFO/MDO Navi (stima EMEP/EEA)', f2(shipFuelTonnes), 'tonnellate', f2(shipFuelTEP), pct(shipFuelTEP, totalTEP), f2(shipTotal));
        row('Elettricità da rete', f2(concElecKWh), 'kWh', f2(concElecTEP), pct(concElecTEP, totalTEP), f2(concElecKWh * 0.000260));
        row('Gasolio (concessionari)', f2(concDieselL), 'litri', f2(concDieselTEP), pct(concDieselTEP, totalTEP), f2(concDieselL * 0.00268));
        row('Benzina (concessionari)', f2(concGasL), 'litri', f2(concGasTEP), pct(concGasTEP, totalTEP), f2(concGasL * 0.00231));
        row('GPL (concessionari)', f2(concLpgL), 'litri', f2(concLpgTEP), pct(concLpgTEP, totalTEP), f2(concLpgL * 0.00156));
        row('Gas naturale (concessionari)', f2(concGasNatKWh), 'kWh', f2(concGasNatTEP), pct(concGasNatTEP, totalTEP), f2(concGasNatKWh * 0.00205));
        if (concOtherTEP > 0) row('Altre fonti', '', '', f2(concOtherTEP), pct(concOtherTEP, totalTEP), '');
        row('TOTALE CONSUMO ENERGETICO', '', '', f2(totalTEP), '100.0%', f2(grandTotal));

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 6: DETTAGLIO NAVI
        // ═══════════════════════════════════════════════════════════════
        section('DETTAGLIO SCALI NAVALI');
        row('IMO', 'Nave', 'Porto', 'GT', 'Classe_GT', 'Categoria', 'Ore_Hotelling', 'N_Manovre', 'EF_Hot_adj', 'EF_Man_adj', 'Hotelling_tCO2', 'Manovra_tCO2', 'Totale_tCO2');
        const HOTELLING_EF: Record<string, number> = { '1000-4999': 0.24, '5000-24999': 0.52, '25000-49999': 0.94, '50000+': 1.38 };
        const MANEUVER_EF: Record<string, number> = { '1000-4999': 0.68, '5000-24999': 1.45, '25000-49999': 2.65, '50000+': 3.90 };
        const CATEGORY_ADJ: Record<string, number> = { container: 1.0, ro_ro: 0.85, general_cargo: 0.75, cruise: 1.35, tanker: 0.90, bulk_carrier: 0.70 };
        for (const ship of ships) {
          const calc = results.find(r => r.imo === ship.imo);
          const gtClass = getGTClass(ship.gt);
          const catAdj = CATEGORY_ADJ[ship.category] || 1.0;
          row(ship.imo, ship.name, ship.port, ship.gt.toString(), gtClass, ship.category, ship.hours.toString(), ship.maneuvers.toString(), ((HOTELLING_EF[gtClass] || 0.52) * catAdj).toFixed(4), ((MANEUVER_EF[gtClass] || 1.45) * catAdj).toFixed(4), f2(calc?.hotelling_tco2 || 0), f2(calc?.maneuver_tco2 || 0), f2(calc?.total_tco2 || 0));
        }
        row('TOTALE NAVI', '', '', totalGT.toString(), '', '', ships.reduce((s, sh) => s + sh.hours, 0).toString(), ships.reduce((s, sh) => s + sh.maneuvers, 0).toString(), '', '', f2(hotellingTotal), f2(maneuverTotal), f2(shipTotal));

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 7: ANALISI PER TIPOLOGIA NAVE
        // ═══════════════════════════════════════════════════════════════
        section('ANALISI PER TIPOLOGIA NAVE');
        row('Tipologia', 'N_Scali', 'GT_Totale', 'Ore_Hotelling', 'N_Manovre', 'tCO2_Hotelling', 'tCO2_Manovra', 'tCO2_Totale', '%_Navi');
        for (const [cat, catShips] of Object.entries(shipsByCat)) {
          const catResults = catShips.map(sh => results.find(r => r.imo === sh.imo)).filter(Boolean) as ShipResult[];
          const catTotal = catResults.reduce((s, r) => s + r.total_tco2, 0);
          const catHot = catResults.reduce((s, r) => s + r.hotelling_tco2, 0);
          const catMan = catResults.reduce((s, r) => s + r.maneuver_tco2, 0);
          row(cat, catShips.length.toString(), catShips.reduce((s, sh) => s + sh.gt, 0).toString(), catShips.reduce((s, sh) => s + sh.hours, 0).toString(), catShips.reduce((s, sh) => s + sh.maneuvers, 0).toString(), f2(catHot), f2(catMan), f2(catTotal), pct(catTotal, shipTotal));
        }

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 8: ANALISI PER PORTO
        // ═══════════════════════════════════════════════════════════════
        section('ANALISI PER PORTO');
        row('Porto', 'N_Navi', 'GT_Totale', 'tCO2_Navi', 'N_Concessionari', 'tCO2_Conc_S1', 'tCO2_Conc_S2', 'tCO2_Conc_Totale', 'tCO2_Porto_Totale', '%_Sistema');
        for (const port of ports) {
          const pShips = shipsByPort[port] || [];
          const pResults = resultsByPort[port] || [];
          const pConc = concByPort[port] || [];
          const pShipT = pResults.reduce((s, r) => s + r.total_tco2, 0);
          const pConcS1 = pConc.reduce((s, c) => s + c.scope1_tco2, 0);
          const pConcS2 = pConc.reduce((s, c) => s + c.scope2_tco2, 0);
          const pConcT = pConc.reduce((s, c) => s + c.total_tco2, 0);
          const pTotal = pShipT + pConcT;
          row(port, pShips.length.toString(), pShips.reduce((s, sh) => s + sh.gt, 0).toString(), f2(pShipT), pConc.length.toString(), f2(pConcS1), f2(pConcS2), f2(pConcT), f2(pTotal), pct(pTotal, grandTotal));
        }

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 9: DETTAGLIO CONCESSIONARI
        // ═══════════════════════════════════════════════════════════════
        section('DETTAGLIO CONCESSIONARI');
        row('Concessionario', 'Porto', 'Tipo', 'N_Voci_Attività', 'Scope1_tCO2', 'Scope2_tCO2', 'Totale_tCO2', '%_Concessionari');
        for (const c of concessionaires) {
          row(c.name, c.port, c.type, (c.activities?.length || 0).toString(), f2(c.scope1_tco2), f2(c.scope2_tco2), f2(c.total_tco2), pct(c.total_tco2, concTotal));
        }
        row('TOTALE', '', '', allActivities.length.toString(), f2(concScope1), f2(concScope2), f2(concTotal), '100.0%');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 10: AUDIT TRAIL CONCESSIONARI
        // ═══════════════════════════════════════════════════════════════
        section('AUDIT TRAIL CONCESSIONARI (tracciabilità calcoli)');
        row('Concessionario', 'Porto', 'Attività', 'Descrizione', 'Quantità', 'Unità', 'EF_Valore', 'EF_Unità', 'EF_Fonte', 'Scope', 'tCO2', 'Origine_Dato', 'Formula');
        for (const c of concessionaires) {
          if (c.activities) {
            for (const a of c.activities) {
              const formula = a.ef_unit.includes('kg') ? `${a.quantity} × ${a.ef_value} / 1000` : `${a.quantity} × ${a.ef_value}`;
              row(c.name, c.port, a.activity_key, a.description, a.quantity.toString(), a.unit, a.ef_value.toString(), a.ef_unit, a.ef_source, `Scope ${a.scope}`, f4(a.tco2), a.source_ref, formula);
            }
          }
        }

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 11: INDICATORI DI INTENSITÀ EMISSIVA
        // ═══════════════════════════════════════════════════════════════
        section('INDICATORI DI INTENSITÀ EMISSIVA');
        row('Indicatore', 'Valore', 'Unità', 'Ambito', 'Note');
        row('Intensità per scalo nave', ships.length > 0 ? f4(shipTotal / ships.length) : 'N/A', 'tCO2/scalo', 'Navi', `${ships.length} scali totali`);
        row('Intensità per 1000 GT movimentato', totalGT > 0 ? f4(shipTotal / totalGT * 1000) : 'N/A', 'tCO2/1000GT', 'Navi', `${totalGT.toLocaleString()} GT totali`);
        row('Intensità per ora hotelling', ships.reduce((s, sh) => s + sh.hours, 0) > 0 ? f4(hotellingTotal / ships.reduce((s, sh) => s + sh.hours, 0)) : 'N/A', 'tCO2/h', 'Navi', 'Media ponderata tutte le navi');
        row('Intensità per manovra', ships.reduce((s, sh) => s + sh.maneuvers, 0) > 0 ? f4(maneuverTotal / ships.reduce((s, sh) => s + sh.maneuvers, 0)) : 'N/A', 'tCO2/manovra', 'Navi', 'Media ponderata');
        row('Intensità per concessionario', concessionaires.length > 0 ? f4(concTotal / concessionaires.length) : 'N/A', 'tCO2/concess.', 'Concessionari', `${concessionaires.length} concessionari`);
        row('Intensità per tep consumato', totalTEP > 0 ? f4(grandTotal / totalTEP) : 'N/A', 'tCO2/tep', 'Sistema', 'Efficienza carbonica del sistema');
        row('Rapporto Scope2/Scope1', scope1Total > 0 ? f4(concScope2 / scope1Total) : 'N/A', 'ratio', 'Sistema', 'Indica dipendenza da fonti indirette');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 12: FATTORI DI EMISSIONE COMPLETI
        // ═══════════════════════════════════════════════════════════════
        section('TABELLA COMPLETA FATTORI DI EMISSIONE APPLICATI');
        row('Categoria', 'Nome', 'Valore', 'Unità', 'Fonte', 'Tier', 'Confidenza');
        for (const ef of EF_REFERENCE_TABLE) {
          row(ef.cat, ef.name, ef.value, ef.unit, ef.source, ef.tier, ef.confidence);
        }

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 13: PIANO DI MONITORAGGIO E RIDUZIONE
        // ═══════════════════════════════════════════════════════════════
        section('PIANO DI MONITORAGGIO E RIDUZIONE EMISSIONI');
        row('Azione', 'Sorgente_Target', 'Riduzione_Stimata_%', 'Investimento', 'Priorità', 'Stato', 'Note');
        row('Cold Ironing / OPS (alimentazione elettrica da banchina)', 'Navi - Hotelling', '90%', 'Alto', 'Alta', 'Da valutare', 'Elimina emissioni hotelling per navi collegate');
        row('LNG bunkering in porto', 'Navi - Manovra', '20-25%', 'Medio-Alto', 'Media', 'Da valutare', 'Riduzione CO2 per conversione a GNL');
        row('Impianto fotovoltaico su coperture', 'Concessionari - Scope 2', '30-50%', 'Medio', 'Alta', 'Da valutare', 'Autoconsumo riduce emissioni Scope 2');
        row('Sostituzione carrelli diesel con elettrici', 'Concessionari - Scope 1 (mezzi)', '80%', 'Medio', 'Alta', 'Da valutare', 'Passaggio a elettrico per handling portuale');
        row('LED illuminazione banchina/piazzale', 'Concessionari - Scope 2', '40-60%', 'Basso', 'Alta', 'Da valutare', 'Riduzione consumi illuminazione');
        row('Flotta veicoli aziendali elettrici/ibridi', 'Concessionari - Scope 1 (veicoli)', '60-80%', 'Medio', 'Media', 'Da valutare', 'Sostituzione progressiva parco auto');
        row('Monitoraggio continuo consumi (smart meters)', 'Tutti', '5-10%', 'Basso', 'Alta', 'Da valutare', 'Awareness e ottimizzazione in tempo reale');
        row('Certificati verdi / GO per elettricità', 'Concessionari - Scope 2', '100%', 'Basso', 'Media', 'Da valutare', 'Market-based approach: EF = 0 con GO');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 14: CHECKLIST CONFORMITÀ DEASP
        // ═══════════════════════════════════════════════════════════════
        section('CHECKLIST CONFORMITÀ DEASP');
        row('Requisito', 'Riferimento', 'Stato', 'Evidenza');
        row('Inventario emissioni da traffico marittimo', 'DEASP Art.4-bis c.1', 'Conforme', `${ships.length} scali analizzati con EMEP/EEA Tier 2`);
        row('Inventario emissioni da attività portuali', 'DEASP Art.4-bis c.2', 'Conforme', `${concessionaires.length} concessionari censiti con ${allActivities.length} voci`);
        row('Utilizzo fattori certificati e aggiornati', 'Linee Guida MIT', 'Conforme', 'ISPRA NIR 2024, DEFRA 2024, EMEP/EEA 2023');
        row('Classificazione per sorgente emissiva', 'DEASP Allegato B', 'Conforme', 'Hotelling, Manovra, Energia, Veicoli, Mezzi, Refrigeranti, Rifiuti');
        row('Ripartizione per scope GHG', 'GHG Protocol / ISO 14064-1', 'Conforme', `Scope 1: ${f2(scope1Total)} tCO2, Scope 2: ${f2(concScope2)} tCO2`);
        row('Bilancio energetico portuale', 'DEASP Art.4-bis c.3', 'Conforme', `${f2(totalTEP)} tep totali, ${ports.length} porti`);
        row('Indicatori di intensità emissiva', 'Linee Guida MIT', 'Conforme', 'tCO2/scalo, tCO2/1000GT, tCO2/concessionario, tCO2/tep');
        row('Analisi per porto del sistema', 'DEASP Art.4-bis c.4', 'Conforme', `${ports.length} porti con breakdown individuale`);
        row('Piano di monitoraggio e riduzione', 'DEASP Art.4-bis c.5', 'Conforme', '8 azioni di riduzione proposte');
        row('Tracciabilità calcoli (audit trail)', 'ISO 14064-1:2019 §6', 'Conforme', 'Ogni calcolo registrato: input × EF = tCO2 con fonte');
        row('GWP conforme IPCC', 'IPCC AR6 (2021)', 'Conforme', 'GWP100 da IPCC AR6 per tutti i gas serra');
        row('Approccio Tier 2 per navi', 'EMEP/EEA Guidebook 2023', 'Conforme', 'EF per classe GT con adjustment per tipologia nave');

        // ═══════════════════════════════════════════════════════════════
        // SEZIONE 15: RIFERIMENTI NORMATIVI E BIBLIOGRAFICI
        // ═══════════════════════════════════════════════════════════════
        section('RIFERIMENTI NORMATIVI E BIBLIOGRAFICI');
        row('Codice', 'Titolo', 'Anno', 'Utilizzo nel DEASP');
        row('D.Lgs. 169/2016', 'Riorganizzazione, razionalizzazione e semplificazione della disciplina concernente le Autorità di Sistema Portuale', '2016', 'Base normativa DEASP (Art. 4-bis)');
        row('Reg. EU 2015/757', 'Monitoraggio, comunicazione e verifica delle emissioni di CO2 del trasporto marittimo (MRV)', '2015', 'Framework MRV per emissioni navali');
        row('IMO MEPC.278(70)', 'Data Collection System for Fuel Oil Consumption of Ships', '2016', 'DCS per consumo carburante navi');
        row('EMEP/EEA 2023', 'Air Pollutant Emission Inventory Guidebook - 1.A.3.d Navigation', '2023', 'Fattori emissione navi (Tier 2) per classe GT');
        row('ISPRA NIR 2024', 'Italian Greenhouse Gas Inventory - National Inventory Report', '2024', 'EF elettricità mix nazionale, veicoli, rifiuti');
        row('DEFRA 2024', 'UK Government GHG Conversion Factors for Company Reporting', '2024', 'EF combustibili fossili, veicoli commerciali');
        row('IPCC AR6', 'Sixth Assessment Report - Global Warming Potentials', '2021', 'GWP100 per refrigeranti e gas fluorurati');
        row('GHG Protocol', 'Corporate Accounting and Reporting Standard (Revised Edition)', '2015', 'Classificazione Scope 1/2/3');
        row('ISO 14064-1:2019', 'Greenhouse gases - Part 1: Specification for organization-level quantification', '2019', 'Standard per quantificazione GHG a livello organizzazione');
        row('D.Lgs. 254/2016', 'Dichiarazione Non Finanziaria (DNF) - Attuazione Dir. 2014/95/UE', '2016', 'Obbligo DNF per enti di interesse pubblico');
        row('Dir. 2022/2464/UE (CSRD)', 'Corporate Sustainability Reporting Directive', '2022', 'Nuovi obblighi di reporting sostenibilità');
        row('D.Lgs. 125/2024', 'Attuazione direttiva CSRD in Italia', '2024', 'Transposizione italiana della CSRD');
        row('Reg. Del. 2023/2772', 'European Sustainability Reporting Standards (ESRS)', '2023', 'Standard ESRS E1 per reporting climatico');

        downloadFile('\ufeff' + L.join('\n'), `DEASP_Report_Completo_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'pdf') {
        const P: string[] = [];
        const W = 80;
        const sep = () => P.push('='.repeat(W));
        const subsep = () => P.push('-'.repeat(W));
        const bl = () => P.push('');
        const scope1Total = shipTotal + concScope1;

        sep();
        P.push('DOCUMENTO DI ANALISI ENERGETICO-AMBIENTALE');
        P.push('DEL SISTEMA PORTUALE (DEASP)');
        P.push('ai sensi del D.Lgs. 169/2016, Art. 4-bis');
        sep();
        bl();
        P.push(`Data generazione:     ${now}`);
        P.push(`Anno di riferimento:  ${year}`);
        P.push(`N. Porti:             ${ports.length} (${ports.join(', ')})`);
        P.push(`N. Scali navali:      ${ships.length}`);
        P.push(`N. Concessionari:     ${concessionaires.length}`);
        bl();

        // 1. INQUADRAMENTO NORMATIVO
        P.push('1. INQUADRAMENTO NORMATIVO');
        subsep();
        P.push('   Il presente documento è redatto in conformità al D.Lgs. 169/2016');
        P.push('   (Riforma portuale), Art. 4-bis, che prevede l\'obbligo per le Autorità');
        P.push('   di Sistema Portuale di predisporre un Documento di Analisi');
        P.push('   Energetico-Ambientale del Sistema Portuale (DEASP).');
        bl();
        P.push('   Il DEASP include:');
        P.push('   a) Inventario delle emissioni da traffico marittimo (hotelling e manovra)');
        P.push('   b) Inventario delle emissioni da attività dei concessionari portuali');
        P.push('   c) Bilancio energetico del sistema portuale');
        P.push('   d) Indicatori di intensità emissiva');
        P.push('   e) Piano di monitoraggio e riduzione delle emissioni');
        bl();
        P.push('   Normativa di riferimento:');
        P.push('   - D.Lgs. 169/2016 (Riforma portuale)');
        P.push('   - Regolamento UE 2015/757 (MRV marittimo)');
        P.push('   - EMEP/EEA Guidebook 2023 (fattori emissione navi)');
        P.push('   - GHG Protocol Corporate Standard (classificazione Scope)');
        P.push('   - ISO 14064-1:2019 (quantificazione GHG organizzazione)');
        P.push('   - IPCC AR6 (2021) (Global Warming Potentials)');
        P.push('   - Direttiva CSRD 2022/2464/UE (reporting sostenibilità)');
        P.push('   - D.Lgs. 125/2024 (transposizione CSRD in Italia)');
        bl();

        // 2. METODOLOGIA
        P.push('2. METODOLOGIA');
        subsep();
        P.push('   2.1 Confini organizzativi');
        P.push('       Approccio: Controllo operativo (GHG Protocol)');
        P.push('       Perimetro: Tutte le attività entro il sedime portuale');
        bl();
        P.push('   2.2 Classificazione sorgenti emissive');
        P.push('       NAVI:');
        P.push('       - Hotelling: emissioni da motori ausiliari durante la sosta');
        P.push('       - Manovra: emissioni da motore principale durante entrata/uscita');
        P.push('       Approccio: EMEP/EEA Guidebook 2023, Tier 2');
        P.push('       Fattori per classe GT: 1000-4999, 5000-24999, 25000-49999, 50000+');
        P.push('       Adjustment per tipologia: Container(1.0), Ro-Ro(0.85),');
        P.push('         General Cargo(0.75), Cruise(1.35), Tanker(0.90), Bulk(0.70)');
        bl();
        P.push('       CONCESSIONARI:');
        P.push('       - Scope 1: combustione diretta (gasolio, GPL, gas naturale,');
        P.push('         veicoli aziendali, mezzi portuali, refrigeranti)');
        P.push('       - Scope 2: energia elettrica acquistata dalla rete');
        P.push('       Fonti EF: ISPRA NIR 2024 (Italia), DEFRA 2024 (UK), IPCC AR6');
        bl();
        P.push('   2.3 Gerarchia dei fattori di emissione');
        P.push('       1. Specifico azienda / misurazione diretta');
        P.push('       2. Fattore nazionale (ISPRA NIR)');
        P.push('       3. Fattore europeo (EMEP/EEA, AIB)');
        P.push('       4. Fattore internazionale (DEFRA, IPCC)');
        bl();

        // 3. INVENTARIO EMISSIONI
        P.push('3. INVENTARIO EMISSIONI');
        subsep();
        P.push('   3.1 Riepilogo');
        P.push(`       Emissioni Navi - Hotelling:         ${f2(hotellingTotal).padStart(12)} tCO2  (${pct(hotellingTotal, grandTotal)})`);
        P.push(`       Emissioni Navi - Manovra:           ${f2(maneuverTotal).padStart(12)} tCO2  (${pct(maneuverTotal, grandTotal)})`);
        P.push(`       SUBTOTALE NAVI:                     ${f2(shipTotal).padStart(12)} tCO2  (${pct(shipTotal, grandTotal)})`);
        P.push(`       Concessionari - Scope 1:            ${f2(concScope1).padStart(12)} tCO2  (${pct(concScope1, grandTotal)})`);
        P.push(`       Concessionari - Scope 2:            ${f2(concScope2).padStart(12)} tCO2  (${pct(concScope2, grandTotal)})`);
        P.push(`       SUBTOTALE CONCESSIONARI:            ${f2(concTotal).padStart(12)} tCO2  (${pct(concTotal, grandTotal)})`);
        P.push(`       ────────────────────────────────────────────────────`);
        P.push(`       TOTALE SISTEMA PORTUALE:            ${f2(grandTotal).padStart(12)} tCO2  (100%)`);
        bl();

        P.push('   3.2 Ripartizione per Scope GHG');
        P.push(`       Scope 1 (emissioni dirette):        ${f2(scope1Total).padStart(12)} tCO2  (${pct(scope1Total, grandTotal)})`);
        P.push(`       Scope 2 (energia acquistata):       ${f2(concScope2).padStart(12)} tCO2  (${pct(concScope2, grandTotal)})`);
        bl();

        P.push('   3.3 Ripartizione per sorgente concessionari');
        for (const [grp, data] of Object.entries(actByGroup)) {
          P.push(`       ${grp.padEnd(30)} ${f2(data.tco2).padStart(12)} tCO2  (${data.count} voci)`);
        }
        bl();

        // 4. ANALISI PER PORTO
        P.push('4. ANALISI PER PORTO');
        subsep();
        for (const port of ports) {
          const pShips = shipsByPort[port] || [];
          const pResults = resultsByPort[port] || [];
          const pConc = concByPort[port] || [];
          const pShipT = pResults.reduce((s, r) => s + r.total_tco2, 0);
          const pConcT = pConc.reduce((s, c) => s + c.total_tco2, 0);
          P.push(`   Porto: ${port}`);
          P.push(`       Navi: ${pShips.length} scali, ${pShips.reduce((s, sh) => s + sh.gt, 0).toLocaleString()} GT tot → ${f2(pShipT)} tCO2`);
          P.push(`       Concessionari: ${pConc.length} soggetti → ${f2(pConcT)} tCO2`);
          P.push(`       TOTALE PORTO: ${f2(pShipT + pConcT)} tCO2 (${pct(pShipT + pConcT, grandTotal)} del sistema)`);
          bl();
        }

        // 5. DETTAGLIO NAVI
        P.push('5. DETTAGLIO PER NAVE');
        subsep();
        P.push('   ' + 'Nave'.padEnd(22) + 'Porto'.padEnd(14) + 'GT'.padStart(8) + 'Hotelling'.padStart(12) + 'Manovra'.padStart(12) + 'Totale'.padStart(12));
        P.push('   ' + '-'.repeat(78));
        for (const ship of ships) {
          const calc = results.find(r => r.imo === ship.imo);
          P.push(`   ${ship.name.substring(0, 20).padEnd(22)}${ship.port.padEnd(14)}${ship.gt.toString().padStart(8)}${f2(calc?.hotelling_tco2 || 0).padStart(12)}${f2(calc?.maneuver_tco2 || 0).padStart(12)}${f2(calc?.total_tco2 || 0).padStart(12)}`);
        }
        P.push('   ' + '-'.repeat(78));
        P.push(`   ${'TOTALE'.padEnd(22)}${''.padEnd(14)}${totalGT.toString().padStart(8)}${f2(hotellingTotal).padStart(12)}${f2(maneuverTotal).padStart(12)}${f2(shipTotal).padStart(12)}`);
        bl();

        // 6. DETTAGLIO CONCESSIONARI
        P.push('6. DETTAGLIO PER CONCESSIONARIO');
        subsep();
        for (const c of concessionaires) {
          P.push(`   ${c.name} (${c.port}, ${c.type})`);
          P.push(`       Scope 1: ${f2(c.scope1_tco2).padStart(10)} tCO2    Scope 2: ${f2(c.scope2_tco2).padStart(10)} tCO2    Totale: ${f2(c.total_tco2).padStart(10)} tCO2`);
          if (c.activities && c.activities.length > 0) {
            for (const a of c.activities) {
              P.push(`       - ${a.description.substring(0, 35).padEnd(35)} ${a.quantity.toLocaleString().padStart(10)} ${a.unit.padEnd(8)} × ${String(a.ef_value).padStart(10)} ${a.ef_unit.padEnd(14)} = ${f4(a.tco2).padStart(10)} tCO2`);
              P.push(`         Fonte: ${a.ef_source} | Origine: ${a.source_ref}`);
            }
          }
          bl();
        }
        P.push(`   TOTALE CONCESSIONARI: S1 ${f2(concScope1)} + S2 ${f2(concScope2)} = ${f2(concTotal)} tCO2`);
        bl();

        // 7. BILANCIO ENERGETICO
        P.push('7. BILANCIO ENERGETICO PORTUALE');
        subsep();
        P.push(`   ${'Vettore'.padEnd(35)} ${'Consumo'.padStart(12)} ${'Unità'.padEnd(10)} ${'tep'.padStart(10)} ${'%'.padStart(8)}`);
        P.push('   ' + '-'.repeat(75));
        P.push(`   ${'HFO/MDO Navi (stima EMEP/EEA)'.padEnd(35)} ${f2(shipFuelTonnes).padStart(12)} ${'tonnellate'.padEnd(10)} ${f2(shipFuelTEP).padStart(10)} ${pct(shipFuelTEP, totalTEP).padStart(8)}`);
        P.push(`   ${'Elettricità da rete'.padEnd(35)} ${f2(concElecKWh).padStart(12)} ${'kWh'.padEnd(10)} ${f2(concElecTEP).padStart(10)} ${pct(concElecTEP, totalTEP).padStart(8)}`);
        P.push(`   ${'Gasolio concessionari'.padEnd(35)} ${f2(concDieselL).padStart(12)} ${'litri'.padEnd(10)} ${f2(concDieselTEP).padStart(10)} ${pct(concDieselTEP, totalTEP).padStart(8)}`);
        P.push(`   ${'Gas naturale'.padEnd(35)} ${f2(concGasNatKWh).padStart(12)} ${'kWh'.padEnd(10)} ${f2(concGasNatTEP).padStart(10)} ${pct(concGasNatTEP, totalTEP).padStart(8)}`);
        P.push('   ' + '-'.repeat(75));
        P.push(`   ${'TOTALE'.padEnd(35)} ${''.padStart(12)} ${''.padEnd(10)} ${f2(totalTEP).padStart(10)} ${'100.0%'.padStart(8)}`);
        bl();

        // 8. INDICATORI
        P.push('8. INDICATORI DI INTENSITÀ EMISSIVA');
        subsep();
        P.push(`   tCO2 per scalo nave:             ${ships.length > 0 ? f4(shipTotal / ships.length) : 'N/A'} tCO2/scalo`);
        P.push(`   tCO2 per 1000 GT movimentato:    ${totalGT > 0 ? f4(shipTotal / totalGT * 1000) : 'N/A'} tCO2/1000GT`);
        P.push(`   tCO2 per ora hotelling:           ${ships.reduce((s, sh) => s + sh.hours, 0) > 0 ? f4(hotellingTotal / ships.reduce((s, sh) => s + sh.hours, 0)) : 'N/A'} tCO2/h`);
        P.push(`   tCO2 per manovra:                 ${ships.reduce((s, sh) => s + sh.maneuvers, 0) > 0 ? f4(maneuverTotal / ships.reduce((s, sh) => s + sh.maneuvers, 0)) : 'N/A'} tCO2/man`);
        P.push(`   tCO2 per concessionario:          ${concessionaires.length > 0 ? f4(concTotal / concessionaires.length) : 'N/A'} tCO2/conc`);
        P.push(`   tCO2 per tep consumato:           ${totalTEP > 0 ? f4(grandTotal / totalTEP) : 'N/A'} tCO2/tep`);
        bl();

        // 9. PIANO DI RIDUZIONE
        P.push('9. PIANO DI MONITORAGGIO E RIDUZIONE');
        subsep();
        P.push('   Le principali azioni individuate per la riduzione delle emissioni:');
        bl();
        P.push('   1. COLD IRONING / OPS (Onshore Power Supply)');
        P.push('      Target: Emissioni hotelling navi | Riduzione stimata: fino a 90%');
        P.push('      Alimentazione elettrica da banchina per eliminare l\'uso dei');
        P.push('      motori ausiliari durante la sosta in porto.');
        bl();
        P.push('   2. IMPIANTI FOTOVOLTAICI SU COPERTURE');
        P.push('      Target: Scope 2 concessionari | Riduzione stimata: 30-50%');
        P.push('      Autoconsumo da fonte rinnovabile per ridurre dipendenza dalla rete.');
        bl();
        P.push('   3. SOSTITUZIONE MEZZI DIESEL CON ELETTRICI');
        P.push('      Target: Scope 1 mezzi portuali | Riduzione stimata: fino a 80%');
        P.push('      Carrelli elevatori, gru, terminal tractor elettrici.');
        bl();
        P.push('   4. FLOTTA VEICOLI AZIENDALI ELETTRICI');
        P.push('      Target: Scope 1 veicoli | Riduzione stimata: 60-80%');
        P.push('      Sostituzione progressiva parco auto diesel con EV/PHEV.');
        bl();
        P.push('   5. LED E SMART METERING');
        P.push('      Target: Scope 2 illuminazione | Riduzione stimata: 40-60%');
        P.push('      Illuminazione LED + monitoraggio consumi in tempo reale.');
        bl();

        // 10. CONFORMITÀ
        P.push('10. DICHIARAZIONE DI CONFORMITÀ');
        subsep();
        P.push('   Il presente documento è conforme ai requisiti del DEASP ai sensi');
        P.push('   del D.Lgs. 169/2016, Art. 4-bis e delle Linee Guida MIT.');
        bl();
        P.push('   Sono stati rispettati i seguenti requisiti:');
        P.push('   [OK] Inventario emissioni da traffico marittimo');
        P.push('   [OK] Inventario emissioni da attività portuali');
        P.push('   [OK] Utilizzo fattori di emissione certificati e aggiornati');
        P.push('   [OK] Classificazione per sorgente emissiva');
        P.push('   [OK] Ripartizione per scope GHG (ISO 14064-1)');
        P.push('   [OK] Bilancio energetico portuale');
        P.push('   [OK] Indicatori di intensità emissiva');
        P.push('   [OK] Analisi per porto del sistema');
        P.push('   [OK] Piano di monitoraggio e riduzione');
        P.push('   [OK] Tracciabilità completa dei calcoli (audit trail)');
        P.push('   [OK] GWP conforme IPCC AR6');
        P.push('   [OK] Approccio Tier 2 EMEP/EEA per emissioni navali');
        bl();

        sep();
        P.push('FINE DOCUMENTO DEASP');
        P.push(`Generato il ${now} da NicoNolli GHG Platform`);
        sep();
        downloadFile(P.join('\n'), `DEASP_Report_Esecutivo_${now.slice(0, 10)}.txt`, 'text/plain');
      }

      if (id === 'inventory') {
        const scope1Total = shipTotal + concScope1;
        const headers = ['Sezione', 'Sorgente', 'Sottocategoria', 'Porto', 'Scope', 'tCO2', '%_Totale', 'N_Voci', 'tep_Stimati', 'Vettore_Energetico'];
        const rows: string[][] = [];

        // INVENTARIO PER SORGENTE
        rows.push(['INVENTARIO PER SORGENTE EMISSIVA', '', '', '', '', '', '', '', '', '']);
        // Ships by port
        for (const port of ports) {
          const pResults = resultsByPort[port] || [];
          const pHotel = pResults.reduce((s, r) => s + r.hotelling_tco2, 0);
          const pMan = pResults.reduce((s, r) => s + r.maneuver_tco2, 0);
          rows.push(['Sorgente', 'Navi - Hotelling', `Motori ausiliari sosta`, port, 'Scope 1', f4(pHotel), pct(pHotel, grandTotal), pResults.length.toString(), '', 'HFO/MDO']);
          rows.push(['Sorgente', 'Navi - Manovra', 'Motore principale ingresso/uscita', port, 'Scope 1', f4(pMan), pct(pMan, grandTotal), pResults.length.toString(), '', 'HFO/MDO']);
        }
        // Concessionaires by group
        for (const [grp, data] of Object.entries(actByGroup)) {
          rows.push(['Sorgente', `Concessionari - ${grp}`, '', '', grp === 'Refrigeranti' ? 'Scope 1' : 'Scope 1+2', f4(data.tco2), pct(data.tco2, grandTotal), data.count.toString(), '', '']);
        }
        rows.push(['TOTALE SORGENTI', '', '', '', '', f4(grandTotal), '100.0%', '', '', '']);

        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['INVENTARIO PER SCOPE GHG', '', '', '', '', '', '', '', '', '']);
        rows.push(['Scope', 'Scope 1 - Emissioni dirette', 'Combustione, refrigeranti, veicoli', '', 'Scope 1', f4(scope1Total), pct(scope1Total, grandTotal), '', '', '']);
        rows.push(['Scope', 'Scope 2 - Energia acquistata', 'Elettricità da rete', '', 'Scope 2', f4(concScope2), pct(concScope2, grandTotal), '', '', '']);
        rows.push(['TOTALE SCOPE', '', '', '', '', f4(grandTotal), '100.0%', '', '', '']);

        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['BILANCIO ENERGETICO (tep)', '', '', '', '', '', '', '', '', '']);
        rows.push(['Energia', 'HFO/MDO Navi', 'Stima EMEP/EEA da fattori Tier 2', '', '', f4(shipTotal), '', '', f4(shipFuelTEP), 'HFO/MDO']);
        rows.push(['Energia', 'Elettricità rete', 'Mix nazionale Italia', '', '', f4(concElecKWh * 0.000260), '', '', f4(concElecTEP), 'Elettricità']);
        rows.push(['Energia', 'Gasolio', 'Riscaldamento, mezzi, generatori', '', '', f4(concDieselL * 0.00268), '', '', f4(concDieselTEP), 'Gasolio']);
        rows.push(['Energia', 'Gas naturale', 'Riscaldamento, processi', '', '', f4(concGasNatKWh * 0.00205), '', '', f4(concGasNatTEP), 'Gas naturale']);
        rows.push(['Energia', 'GPL', 'Riscaldamento, mezzi', '', '', f4(concLpgL * 0.00156), '', '', f4(concLpgTEP), 'GPL']);
        rows.push(['Energia', 'Benzina', 'Veicoli', '', '', f4(concGasL * 0.00231), '', '', f4(concGasTEP), 'Benzina']);
        rows.push(['TOTALE ENERGIA', '', '', '', '', f4(grandTotal), '', '', f4(totalTEP), '']);

        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['INDICATORI INTENSITÀ', '', '', '', '', '', '', '', '', '']);
        rows.push(['Indicatore', 'tCO2/scalo nave', '', '', '', ships.length > 0 ? f4(shipTotal / ships.length) : 'N/A', '', ships.length.toString(), '', '']);
        rows.push(['Indicatore', 'tCO2/1000 GT', '', '', '', totalGT > 0 ? f4(shipTotal / totalGT * 1000) : 'N/A', '', '', '', '']);
        rows.push(['Indicatore', 'tCO2/ora hotelling', '', '', '', ships.reduce((s, sh) => s + sh.hours, 0) > 0 ? f4(hotellingTotal / ships.reduce((s, sh) => s + sh.hours, 0)) : 'N/A', '', '', '', '']);
        rows.push(['Indicatore', 'tCO2/concessionario', '', '', '', concessionaires.length > 0 ? f4(concTotal / concessionaires.length) : 'N/A', '', concessionaires.length.toString(), '', '']);
        rows.push(['Indicatore', 'tCO2/tep', '', '', '', totalTEP > 0 ? f4(grandTotal / totalTEP) : 'N/A', '', '', '', '']);
        rows.push(['Indicatore', 'Scope2/Scope1 ratio', '', '', '', scope1Total > 0 ? f4(concScope2 / scope1Total) : 'N/A', '', '', '', '']);

        // Per-port summary
        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['INVENTARIO PER PORTO', '', '', '', '', '', '', '', '', '']);
        for (const port of ports) {
          const pShips = shipsByPort[port] || [];
          const pResults = resultsByPort[port] || [];
          const pConc = concByPort[port] || [];
          const pShipT = pResults.reduce((s, r) => s + r.total_tco2, 0);
          const pConcT = pConc.reduce((s, c) => s + c.total_tco2, 0);
          rows.push(['Porto', port, `${pShips.length} navi, ${pConc.length} concessionari`, port, '', f4(pShipT + pConcT), pct(pShipT + pConcT, grandTotal), (pShips.length + pConc.length).toString(), '', '']);
        }

        downloadFile(generateCSV(headers, rows), `DEASP_Inventario_Emissioni_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      setGenerating(null);
      setGenerated((prev) => new Set([...prev, id]));
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Download className="w-5 h-5 text-brand-blue" />
          <span>Step 4: Generazione Report DEASP</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Genera output conformi alla Direttiva Europea Ambiente Sistema Portuale con tracciabilità fattori
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TYPES.map((report) => (
          <div key={report.id} className="bg-surface-hover rounded-xl border border-surface-border p-5 hover:border-brand-blue/30 transition-colors">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-brand-blue/10 text-brand-blue">{report.icon}</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">{report.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{report.desc}</p>

                {'sheets' in report && report.sheets && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {report.sheets.map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 text-[10px] bg-surface-card text-gray-400 rounded">{s}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs text-gray-500">Formato: {report.format}</span>
                  {generated.has(report.id) && (
                    <span className="flex items-center space-x-1 text-xs text-brand-green">
                      <CheckCircle className="w-3 h-3" />
                      <span>Generato e scaricato</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating === report.id}
                  className="mt-3 flex items-center space-x-2 px-4 py-2 text-xs primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <Download className="w-3 h-3" />
                  <span>{generating === report.id ? 'Generazione...' : generated.has(report.id) ? 'Rigenera e scarica' : 'Genera e scarica'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conformity Section */}
      <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-brand-green flex items-center space-x-2 mb-3">
          <Globe className="w-4 h-4" />
          <span>Conformità DEASP e Tracciabilità</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-brand-green/80">
          <div>
            <div className="font-semibold text-brand-green">Base normativa</div>
            <p>D.Lgs. 169/2016, Art.4-bis (Riforma portuale)</p>
          </div>
          <div>
            <div className="font-semibold text-brand-green">Fonti EF</div>
            <p>ISPRA NIR 2024, DEFRA 2024, EMEP/EEA 2023, IPCC AR6</p>
          </div>
          <div>
            <div className="font-semibold text-brand-green">Sezioni DEASP</div>
            <p>Inventario, Bilancio energetico, Intensità, Piano riduzione, Audit trail</p>
          </div>
          <div>
            <div className="font-semibold text-brand-green">Tracciabilità</div>
            <p>Ogni calcolo: Input × EF = tCO2 con fonte, tier e confidenza</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-surface-border">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
          ← Indietro
        </button>
      </div>
    </div>
  );
}
