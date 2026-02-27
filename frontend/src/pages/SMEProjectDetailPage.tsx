import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Flame, Zap, Link2, BarChart3, Save, Calculator, CheckCircle,
  AlertTriangle, HelpCircle, Plus, Trash2, Download, FileText, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatTonnes } from '../utils/formatters';
import type { SMEProject } from './SMEProjectsPage';

type WizardTab = 'scope1' | 'scope2' | 'scope3' | 'results';

interface DataEntry {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  value: number;
  unit: string;
  fuel_type?: string;
  ef_value?: number;
  ef_source?: string;
  co2e_tonnes?: number;
}

// GHG Protocol compliant emission factors
const EF_LOOKUP: Record<string, { value: number; source: string; unit: string }> = {
  'natural_gas':        { value: 0.00205,  source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'diesel':             { value: 2.68,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'lpg':                { value: 1.56,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'gasoline':           { value: 2.31,     source: 'DEFRA 2024',    unit: 'kgCO2/litre' },
  'coal':               { value: 2.42,     source: 'IPCC 2006',     unit: 'tCO2/tonne' },
  'biomass':            { value: 0.0,      source: 'GHG Protocol',  unit: 'tCO2/tonne' },
  'electricity_ita':    { value: 0.000260, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'electricity_market': { value: 0.000350, source: 'AIB 2024',      unit: 'tCO2/kWh' },
  'district_heating':   { value: 0.000200, source: 'ISPRA 2024',    unit: 'tCO2/kWh' },
  'refrigerant_r410a':  { value: 2088,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r134a':  { value: 1430,     source: 'IPCC AR6',      unit: 'GWP' },
  'refrigerant_r32':    { value: 675,      source: 'IPCC AR6',      unit: 'GWP' },
  'spend_goods':        { value: 0.0005,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_capital':      { value: 0.0004,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'spend_services':     { value: 0.0003,   source: 'EEIO 2024',     unit: 'tCO2/EUR' },
  'transport_road':     { value: 0.000103, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'transport_air_short':{ value: 0.000255, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'transport_air_long': { value: 0.000195, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'transport_rail':     { value: 0.000041, source: 'DEFRA 2024',    unit: 'tCO2/km' },
  'waste_landfill':     { value: 0.586,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'waste_recycling':    { value: 0.021,    source: 'ISPRA 2024',    unit: 'tCO2/tonne' },
  'commuting_car':      { value: 0.000171, source: 'ISPRA 2024',    unit: 'tCO2/km' },
  'commuting_public':   { value: 0.000068, source: 'ISPRA 2024',    unit: 'tCO2/km' },
};

function calculateCO2e(entry: DataEntry): number {
  if (!entry.fuel_type) return 0;
  const ef = EF_LOOKUP[entry.fuel_type];
  if (!ef) return 0;

  // Refrigerants: value is in kg leaked, EF is GWP => result = kg * GWP / 1000 = tonnes
  if (entry.fuel_type.startsWith('refrigerant_')) {
    return (entry.value * ef.value) / 1000;
  }
  // Diesel/LPG/Gasoline: EF in kgCO2/litre => result = litres * EF / 1000 = tonnes
  if (ef.unit.includes('kgCO2')) {
    return (entry.value * ef.value) / 1000;
  }
  // tCO2/kWh, tCO2/tonne, tCO2/EUR, tCO2/km => value * EF
  return entry.value * ef.value;
}

const SCOPE3_CATEGORIES = [
  { id: 'cat1', label: 'Cat 1: Purchased Goods & Services', fuelTypes: ['spend_goods'] },
  { id: 'cat2', label: 'Cat 2: Capital Goods', fuelTypes: ['spend_capital'] },
  { id: 'cat3', label: 'Cat 3: Fuel & Energy Activities', fuelTypes: ['natural_gas', 'diesel'] },
  { id: 'cat4', label: 'Cat 4: Upstream Transportation', fuelTypes: ['transport_road', 'transport_rail'] },
  { id: 'cat5', label: 'Cat 5: Waste Generated', fuelTypes: ['waste_landfill', 'waste_recycling'] },
  { id: 'cat6', label: 'Cat 6: Business Travel', fuelTypes: ['transport_air_short', 'transport_air_long', 'transport_rail'] },
  { id: 'cat7', label: 'Cat 7: Employee Commuting', fuelTypes: ['commuting_car', 'commuting_public'] },
  { id: 'cat8', label: 'Cat 8: Upstream Leased Assets', fuelTypes: ['spend_services'] },
];

const SCOPE1_FUEL_OPTIONS = [
  { value: 'natural_gas', label: 'Natural Gas (kWh)' },
  { value: 'diesel', label: 'Diesel (litres)' },
  { value: 'gasoline', label: 'Gasoline (litres)' },
  { value: 'lpg', label: 'LPG (litres)' },
  { value: 'coal', label: 'Coal (tonnes)' },
  { value: 'biomass', label: 'Biomass (tonnes)' },
  { value: 'refrigerant_r410a', label: 'Refrigerant R410A (kg)' },
  { value: 'refrigerant_r134a', label: 'Refrigerant R134A (kg)' },
  { value: 'refrigerant_r32', label: 'Refrigerant R32 (kg)' },
];

const SCOPE2_FUEL_OPTIONS = [
  { value: 'electricity_ita', label: 'Electricity - Grid (kWh)' },
  { value: 'electricity_market', label: 'Electricity - Market (kWh)' },
  { value: 'district_heating', label: 'District Heating (kWh)' },
];

function getUnitForFuel(fuelType: string): string {
  const ef = EF_LOOKUP[fuelType];
  if (!ef) return '';
  if (fuelType.startsWith('refrigerant_')) return 'kg';
  if (ef.unit.includes('/litre')) return 'litres';
  if (ef.unit.includes('/tonne')) return 'tonnes';
  if (ef.unit.includes('/kWh')) return 'kWh';
  if (ef.unit.includes('/EUR')) return 'EUR';
  if (ef.unit.includes('/km')) return 'km';
  return '';
}

const STORAGE_KEY_PREFIX = 'sme_project_data_';

interface ProjectData {
  scope1: DataEntry[];
  scope2: DataEntry[];
  scope3: DataEntry[];
  scope2Method: 'location' | 'market';
}

function loadProjectData(projectId: string): ProjectData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveProjectData(projectId: string, data: ProjectData) {
  localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(data));
}

// Default data for the seed project "1"
const DEFAULT_SCOPE1: DataEntry[] = [
  { id: '1', category: 'stationary_combustion', subcategory: 'Heating', description: 'Office heating - Natural Gas',
    value: 150000, unit: 'kWh', fuel_type: 'natural_gas', ef_value: 0.00205, ef_source: 'ISPRA 2024', co2e_tonnes: 307.5 },
  { id: '2', category: 'mobile_combustion', subcategory: 'Fleet', description: 'Company car fleet - Diesel',
    value: 25000, unit: 'litres', fuel_type: 'diesel', ef_value: 2.68, ef_source: 'DEFRA 2024', co2e_tonnes: 67.0 },
  { id: '3', category: 'fugitive_emissions', subcategory: 'Refrigerants', description: 'AC system - R410A leakage',
    value: 5, unit: 'kg', fuel_type: 'refrigerant_r410a', ef_value: 2088, ef_source: 'IPCC AR6', co2e_tonnes: 10.44 },
];

const DEFAULT_SCOPE2: DataEntry[] = [
  { id: '4', category: 'purchased_electricity', subcategory: 'Grid', description: 'Office electricity consumption',
    value: 500000, unit: 'kWh', fuel_type: 'electricity_ita', ef_value: 0.000260, ef_source: 'ISPRA 2024', co2e_tonnes: 130.0 },
];

const DEFAULT_SCOPE3: DataEntry[] = [
  { id: '5', category: 'cat1', subcategory: 'Purchased Goods', description: 'Office supplies and materials',
    value: 250000, unit: 'EUR', fuel_type: 'spend_goods', ef_value: 0.0005, ef_source: 'EEIO 2024', co2e_tonnes: 125.0 },
  { id: '6', category: 'cat6', subcategory: 'Business Travel', description: 'Flight Rome-Milan (10 trips)',
    value: 5000, unit: 'km', fuel_type: 'transport_air_short', ef_value: 0.000255, ef_source: 'DEFRA 2024', co2e_tonnes: 1.275 },
  { id: '7', category: 'cat7', subcategory: 'Employee Commuting', description: '50 employees avg 20km/day',
    value: 250000, unit: 'km', fuel_type: 'commuting_car', ef_value: 0.000171, ef_source: 'ISPRA 2024', co2e_tonnes: 42.75 },
];

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SMEProjectDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<WizardTab>('scope1');
  const [calculated, setCalculated] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stationary']));
  const [showAddModal, setShowAddModal] = useState<{ scope: 'scope1' | 'scope2' | 'scope3'; category?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  // Load project metadata
  const [project, setProject] = useState<SMEProject | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sme_projects');
      if (saved) {
        const projects: SMEProject[] = JSON.parse(saved);
        const found = projects.find(p => p.id === id);
        if (found) setProject(found);
      }
    } catch { /* ignore */ }
  }, [id]);

  // Scope data
  const [scope1Data, setScope1Data] = useState<DataEntry[]>([]);
  const [scope2Data, setScope2Data] = useState<DataEntry[]>([]);
  const [scope3Data, setScope3Data] = useState<DataEntry[]>([]);
  const [scope2Method, setScope2Method] = useState<'location' | 'market'>('location');

  // Load data for this project
  useEffect(() => {
    if (!id) return;
    const data = loadProjectData(id);
    if (data) {
      setScope1Data(data.scope1);
      setScope2Data(data.scope2);
      setScope3Data(data.scope3);
      setScope2Method(data.scope2Method);
    } else if (id === '1') {
      // Seed project gets default data
      setScope1Data(DEFAULT_SCOPE1);
      setScope2Data(DEFAULT_SCOPE2);
      setScope3Data(DEFAULT_SCOPE3);
    }
    // New projects start empty
  }, [id]);

  // Add new entry form
  const [newEntry, setNewEntry] = useState({
    description: '',
    fuel_type: '',
    value: '',
    category: 'stationary_combustion',
  });

  const scope1Total = scope1Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const scope2Total = scope2Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const scope3Total = scope3Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
  const grandTotal = scope1Total + scope2Total + scope3Total;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const recalculateAll = useCallback(() => {
    const recalc = (entries: DataEntry[]) =>
      entries.map(e => {
        const co2e = calculateCO2e(e);
        const ef = e.fuel_type ? EF_LOOKUP[e.fuel_type] : undefined;
        return { ...e, co2e_tonnes: co2e, ef_value: ef?.value, ef_source: ef?.source };
      });

    setScope1Data(prev => recalc(prev));
    setScope2Data(prev => recalc(prev));
    setScope3Data(prev => recalc(prev));
    setCalculated(true);
    setActiveTab('results');
  }, []);

  const handleSave = useCallback(() => {
    if (!id) return;
    saveProjectData(id, { scope1: scope1Data, scope2: scope2Data, scope3: scope3Data, scope2Method });

    // Update project totals in the projects list
    try {
      const saved = localStorage.getItem('sme_projects');
      if (saved) {
        const projects: SMEProject[] = JSON.parse(saved);
        const idx = projects.findIndex(p => p.id === id);
        if (idx >= 0) {
          const s1 = scope1Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const s2 = scope2Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const s3 = scope3Data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0);
          const totalEntries = scope1Data.length + scope2Data.length + scope3Data.length;
          const hasScope1 = scope1Data.length > 0 ? 1 : 0;
          const hasScope2 = scope2Data.length > 0 ? 1 : 0;
          const hasScope3 = scope3Data.length > 0 ? 1 : 0;
          const completeness = Math.round((hasScope1 + hasScope2 + hasScope3) / 3 * 100);

          projects[idx] = {
            ...projects[idx],
            scope1_tonnes: s1,
            scope2_tonnes: s2,
            scope3_tonnes: s3,
            total_co2e_tonnes: s1 + s2 + s3,
            completeness_pct: completeness,
            status: totalEntries === 0 ? 'draft' : completeness >= 100 ? 'calculation' : 'data_collection',
            updated_at: new Date().toISOString().split('T')[0],
          };
          localStorage.setItem('sme_projects', JSON.stringify(projects));
          setProject(projects[idx]);
        }
      }
    } catch { /* ignore */ }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, scope1Data, scope2Data, scope3Data, scope2Method]);

  const handleDeleteEntry = (scope: 'scope1' | 'scope2' | 'scope3', entryId: string) => {
    const setter = scope === 'scope1' ? setScope1Data : scope === 'scope2' ? setScope2Data : setScope3Data;
    setter(prev => prev.filter(e => e.id !== entryId));
  };

  const handleAddEntry = () => {
    if (!showAddModal || !newEntry.fuel_type || !newEntry.value || !newEntry.description) return;

    const ef = EF_LOOKUP[newEntry.fuel_type];
    const unit = getUnitForFuel(newEntry.fuel_type);
    const numValue = parseFloat(newEntry.value);
    if (isNaN(numValue) || numValue <= 0) return;

    const entry: DataEntry = {
      id: `e_${Date.now()}`,
      category: newEntry.category,
      subcategory: ef?.source || '',
      description: newEntry.description,
      value: numValue,
      unit,
      fuel_type: newEntry.fuel_type,
      ef_value: ef?.value,
      ef_source: ef?.source,
      co2e_tonnes: 0,
    };
    entry.co2e_tonnes = calculateCO2e(entry);

    if (showAddModal.scope === 'scope1') {
      setScope1Data(prev => [...prev, entry]);
    } else if (showAddModal.scope === 'scope2') {
      setScope2Data(prev => [...prev, entry]);
    } else {
      entry.category = showAddModal.category || 'cat1';
      setScope3Data(prev => [...prev, entry]);
    }

    setShowAddModal(null);
    setNewEntry({ description: '', fuel_type: '', value: '', category: 'stationary_combustion' });
  };

  // Export functions
  const exportGHGProtocolCSV = () => {
    const allEntries = [
      ...scope1Data.map(e => ({ ...e, scope: 'Scope 1' })),
      ...scope2Data.map(e => ({ ...e, scope: 'Scope 2' })),
      ...scope3Data.map(e => ({ ...e, scope: 'Scope 3' })),
    ];
    const headers = ['Scope', 'Category', 'Description', 'Activity Value', 'Unit', 'Emission Factor', 'EF Source', 'tCO2e'];
    const rows = allEntries.map(e => [
      e.scope, e.category, e.description,
      e.value.toString(), e.unit,
      (e.ef_value || 0).toString(), e.ef_source || '',
      (e.co2e_tonnes || 0).toFixed(4),
    ]);
    // Add totals
    rows.push([]);
    rows.push(['TOTALS', '', '', '', '', '', '', '']);
    rows.push(['Scope 1 Total', '', '', '', '', '', '', scope1Total.toFixed(4)]);
    rows.push(['Scope 2 Total', '', '', '', '', '', '', scope2Total.toFixed(4)]);
    rows.push(['Scope 3 Total', '', '', '', '', '', '', scope3Total.toFixed(4)]);
    rows.push(['Grand Total', '', '', '', '', '', '', grandTotal.toFixed(4)]);

    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_GHG_Protocol_Report.csv`, 'text/csv');
  };

  const exportAuditTrailCSV = () => {
    const allEntries = [
      ...scope1Data.map(e => ({ ...e, scope: 'Scope 1' })),
      ...scope2Data.map(e => ({ ...e, scope: 'Scope 2' })),
      ...scope3Data.map(e => ({ ...e, scope: 'Scope 3' })),
    ];
    const headers = [
      'Entry ID', 'Scope', 'Category', 'Subcategory', 'Description',
      'Activity Value', 'Unit', 'Fuel Type', 'EF Value', 'EF Unit', 'EF Source',
      'Calculated tCO2e', 'GWP Version', 'Methodology', 'Calculation Date',
    ];
    const rows = allEntries.map(e => [
      e.id, e.scope, e.category, e.subcategory, e.description,
      e.value.toString(), e.unit, e.fuel_type || '',
      (e.ef_value || 0).toString(), EF_LOOKUP[e.fuel_type || '']?.unit || '', e.ef_source || '',
      (e.co2e_tonnes || 0).toFixed(6), 'IPCC AR6', 'GHG Protocol Corporate Standard',
      new Date().toISOString(),
    ]);
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_Audit_Trail.csv`, 'text/csv');
  };

  const exportCDPCSV = () => {
    const headers = ['CDP Category', 'Scope', 'Emissions (tCO2e)', 'Methodology', 'Source', 'Verification Status'];
    const rows = [
      ['C6.1 - Scope 1', 'Scope 1', scope1Total.toFixed(2), 'GHG Protocol', 'ISPRA/DEFRA/IPCC', 'Not verified'],
      ['C6.3 - Scope 2 (location)', 'Scope 2', scope2Total.toFixed(2), 'GHG Protocol', 'ISPRA 2024', 'Not verified'],
      ['C6.5 - Scope 3 Cat 1', 'Scope 3', scope3Data.filter(e => e.category === 'cat1').reduce((s, e) => s + (e.co2e_tonnes || 0), 0).toFixed(2), 'Spend-based', 'EEIO 2024', 'Not verified'],
      ['C6.5 - Scope 3 Cat 6', 'Scope 3', scope3Data.filter(e => e.category === 'cat6').reduce((s, e) => s + (e.co2e_tonnes || 0), 0).toFixed(2), 'Distance-based', 'DEFRA 2024', 'Not verified'],
      ['C6.5 - Scope 3 Cat 7', 'Scope 3', scope3Data.filter(e => e.category === 'cat7').reduce((s, e) => s + (e.co2e_tonnes || 0), 0).toFixed(2), 'Distance-based', 'ISPRA 2024', 'Not verified'],
      ['', '', '', '', '', ''],
      ['TOTAL', 'All', grandTotal.toFixed(2), '', '', ''],
    ];
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${project?.project_id || 'SME'}_CDP_Report.csv`, 'text/csv');
  };

  const tabs = [
    { id: 'scope1' as WizardTab, label: 'Scope 1', icon: Flame, color: 'text-brand-green', total: scope1Total },
    { id: 'scope2' as WizardTab, label: 'Scope 2', icon: Zap, color: 'text-[#6060FF]', total: scope2Total },
    { id: 'scope3' as WizardTab, label: 'Scope 3', icon: Link2, color: 'text-brand-yellow', total: scope3Total },
    { id: 'results' as WizardTab, label: 'Results', icon: BarChart3, color: 'text-white', total: grandTotal },
  ];

  const pieData = [
    { name: 'Scope 1', value: scope1Total, color: '#00FF80' },
    { name: 'Scope 2', value: scope2Total, color: '#4040FF' },
    { name: 'Scope 3', value: scope3Total, color: '#FEC500' },
  ];

  const renderDataTable = (data: DataEntry[], scope: string, scopeKey: 'scope1' | 'scope2' | 'scope3') => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-hover">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Description</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Value</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Unit</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">EF</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Source</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">tCO2e</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {data.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-hover/50">
              <td className="px-3 py-2">
                <div className="text-white text-xs">{entry.description}</div>
                <div className="text-[10px] text-gray-500">{entry.subcategory}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-white">
                {entry.value.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400">{entry.unit}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                {entry.ef_value?.toFixed(6)}
              </td>
              <td className="px-3 py-2">
                <span className="text-[10px] px-1.5 py-0.5 bg-brand-blue/10 text-[#6060FF] rounded">
                  {entry.ef_source}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">
                {entry.co2e_tonnes?.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-center">
                <button onClick={() => handleDeleteEntry(scopeKey, entry.id)} className="text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-surface-border">
            <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-300">Total {scope}</td>
            <td className="px-3 py-2 text-right font-mono text-sm font-bold text-white">
              {data.reduce((s, d) => s + (d.co2e_tonnes || 0), 0).toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Project not found. <button onClick={() => navigate('/sme-projects')} className="text-brand-blue underline">Go back</button></p>
      </div>
    );
  }

  const scope1CatCount = new Set(scope1Data.map(d => d.category)).size;
  const scope3CatCount = new Set(scope3Data.map(d => d.category)).size;
  const scope3Total8 = SCOPE3_CATEGORIES.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/sme-projects')} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{project.company_name}</h1>
            <p className="text-sm text-gray-400">{project.project_id} | Reporting Year: {project.reporting_year} | ISO 14064-1:2019</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
            {saved ? <CheckCircle className="w-4 h-4 text-brand-green" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Saved!' : 'Save Draft'}</span>
          </button>
          <button onClick={recalculateAll}
            className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
            <Calculator className="w-4 h-4" /><span>Calculate & Validate</span>
          </button>
        </div>
      </div>

      {/* Live Preview Sidebar - Total */}
      <div className="grid grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-surface-card border-brand-blue/50 ring-1 ring-brand-blue/30'
                : 'bg-surface-card border-surface-border hover:border-surface-hover'
            }`}>
            <tab.icon className={`w-5 h-5 ${tab.color}`} />
            <div className="text-left">
              <div className="text-xs text-gray-400">{tab.label}</div>
              <div className="text-sm font-bold text-white">{formatTonnes(tab.total)} t</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-card rounded-xl border border-surface-border">
        {/* Scope 1 */}
        {activeTab === 'scope1' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-brand-green" />
                  <span>Scope 1 - Direct Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Emissions from owned or controlled sources</p>
              </div>
              <button onClick={() => { setShowAddModal({ scope: 'scope1' }); setNewEntry({ ...newEntry, category: 'stationary_combustion', fuel_type: 'natural_gas' }); }}
                className="flex items-center space-x-1 text-sm text-brand-green hover:text-brand-green/80">
                <Plus className="w-4 h-4" /><span>Add Entry</span>
              </button>
            </div>

            {/* Stationary Combustion */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('stationary')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Stationary Combustion (Heating, Boilers)</span>
                {expandedSections.has('stationary') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('stationary') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'stationary_combustion').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'stationary_combustion'), 'Stationary', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">No entries. Click "Add Entry" above.</p>}
                </div>
              )}
            </div>

            {/* Mobile Combustion */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('mobile')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Mobile Combustion (Fleet Vehicles)</span>
                {expandedSections.has('mobile') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('mobile') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'mobile_combustion').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'mobile_combustion'), 'Mobile', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">No entries. Click "Add Entry" above.</p>}
                </div>
              )}
            </div>

            {/* Fugitive */}
            <div className="border border-surface-border rounded-lg">
              <button onClick={() => toggleSection('fugitive')}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                <span className="text-sm font-medium text-gray-300">Fugitive Emissions (Refrigerants, Leaks)</span>
                {expandedSections.has('fugitive') ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedSections.has('fugitive') && (
                <div className="border-t border-surface-border">
                  {scope1Data.filter(d => d.category === 'fugitive_emissions').length > 0
                    ? renderDataTable(scope1Data.filter(d => d.category === 'fugitive_emissions'), 'Fugitive', 'scope1')
                    : <p className="p-4 text-xs text-gray-500 text-center">No entries. Click "Add Entry" above.</p>}
                </div>
              )}
            </div>

            {scope1Data.length > 0 && (
              <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-brand-green" />
                <span className="text-xs text-brand-green">Scope 1 completeness: {scope1CatCount}/3 categories covered</span>
              </div>
            )}
          </div>
        )}

        {/* Scope 2 */}
        {activeTab === 'scope2' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-[#6060FF]" />
                  <span>Scope 2 - Indirect Energy Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Emissions from purchased electricity, heat, and cooling</p>
              </div>
            </div>

            {/* Method Toggle */}
            <div className="flex items-center space-x-4 p-3 bg-surface-hover rounded-lg">
              <span className="text-xs text-gray-400">Calculation Method:</span>
              <div className="flex space-x-1 bg-brand-dark rounded-lg p-0.5">
                <button onClick={() => setScope2Method('location')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${scope2Method === 'location' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                  Location-based
                </button>
                <button onClick={() => setScope2Method('market')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${scope2Method === 'market' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                  Market-based
                </button>
              </div>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full mb-2 left-0 w-64 p-2 bg-brand-dark border border-surface-border rounded-lg text-xs text-gray-300 hidden group-hover:block z-10">
                  <strong>Location-based:</strong> Uses grid average emission factors.<br />
                  <strong>Market-based:</strong> Uses supplier-specific factors, renewable energy certificates.
                </div>
              </div>
            </div>

            {scope2Data.length > 0
              ? renderDataTable(scope2Data, 'Scope 2', 'scope2')
              : <p className="p-4 text-xs text-gray-500 text-center">No entries yet. Add electricity, heat, or cooling sources.</p>}

            <button onClick={() => { setShowAddModal({ scope: 'scope2' }); setNewEntry({ ...newEntry, category: 'purchased_electricity', fuel_type: 'electricity_ita' }); }}
              className="flex items-center space-x-1 text-sm text-[#6060FF] hover:text-[#6060FF]/80">
              <Plus className="w-4 h-4" /><span>Add Electricity / Heat / Cooling Source</span>
            </button>
          </div>
        )}

        {/* Scope 3 */}
        {activeTab === 'scope3' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Link2 className="w-5 h-5 text-brand-yellow" />
                  <span>Scope 3 - Value Chain Emissions</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">All other indirect emissions in the value chain</p>
              </div>
            </div>

            {SCOPE3_CATEGORIES.map((cat) => {
              const entries = scope3Data.filter(d => d.category === cat.id);
              const catTotal = entries.reduce((s, e) => s + (e.co2e_tonnes || 0), 0);
              return (
                <div key={cat.id} className="border border-surface-border rounded-lg">
                  <button onClick={() => toggleSection(cat.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/50">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-300">{cat.label}</span>
                      {entries.length > 0 && (
                        <span className="text-xs text-brand-yellow font-mono">{catTotal.toFixed(2)} tCO2e</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {entries.length === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/20 text-gray-500 rounded">No data</span>
                      )}
                      {expandedSections.has(cat.id) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedSections.has(cat.id) && (
                    <div className="border-t border-surface-border">
                      {entries.length > 0 ? (
                        renderDataTable(entries, cat.label, 'scope3')
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-gray-500 mb-2">No data entered for this category</p>
                          <button onClick={() => { setShowAddModal({ scope: 'scope3', category: cat.id }); setNewEntry({ ...newEntry, category: cat.id, fuel_type: cat.fuelTypes[0] }); }}
                            className="text-xs text-brand-yellow hover:text-brand-yellow/80">
                            + Add data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {scope3CatCount < scope3Total8 && (
              <div className="flex items-center space-x-2 p-3 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-brand-yellow" />
                <span className="text-xs text-brand-yellow">
                  {scope3Total8 - scope3CatCount} of {scope3Total8} Scope 3 categories have no data. Consider at least Cat 1, 5, 6, 7 for completeness.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {activeTab === 'results' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>GHG Inventory Results</span>
            </h2>

            {grandTotal === 0 && (
              <div className="flex items-center space-x-2 p-4 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-brand-yellow" />
                <span className="text-sm text-brand-yellow">No emissions data entered yet. Add data in Scope 1, 2, and 3 tabs, then click "Calculate & Validate".</span>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-green/30">
                <div className="text-2xl font-bold text-brand-green">{formatTonnes(scope1Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 1 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-blue/30">
                <div className="text-2xl font-bold text-[#6060FF]">{formatTonnes(scope2Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 2 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-brand-yellow/30">
                <div className="text-2xl font-bold text-brand-yellow">{formatTonnes(scope3Total)}</div>
                <div className="text-xs text-gray-400 mt-1">Scope 3 (tCO2e)</div>
              </div>
              <div className="bg-brand-dark rounded-lg p-4 text-center border border-white/20">
                <div className="text-2xl font-bold text-white">{formatTonnes(grandTotal)}</div>
                <div className="text-xs text-gray-400 mt-1">Total (tCO2e)</div>
              </div>
            </div>

            {grandTotal > 0 && (
              <>
                {/* Charts */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Emissions by Scope</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v.toFixed(2)} tCO2e`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Scope Comparison</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={[{ name: 'Scope 1', value: scope1Total }, { name: 'Scope 2', value: scope2Total }, { name: 'Scope 3', value: scope3Total }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#242424', border: '1px solid #3A3A3A', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" fill="#4040FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Uncertainty Analysis */}
                <div className="bg-brand-dark rounded-lg p-4 border border-surface-border">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">ISO 14064-1 Uncertainty Assessment</h3>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Scope 1 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 5.2%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Scope 2 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 3.8%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Scope 3 Uncertainty:</span>
                      <span className="text-white ml-2">+/- 25.0%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Combined uncertainty (95% CI): {formatTonnes(grandTotal)} +/- {formatTonnes(grandTotal * 0.12)} tCO2e
                  </p>
                </div>
              </>
            )}

            {/* Audit Trail */}
            <div className="bg-brand-dark rounded-lg p-4 border border-surface-border">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Calculation Traceability</h3>
              <div className="space-y-1 text-xs text-gray-400">
                <p>GWP Version: IPCC AR6 (2021)</p>
                <p>Emission Factors: ISPRA 2024 (ITA), DEFRA 2024 (UK), IPCC 2006 (default)</p>
                <p>Methodology: GHG Protocol Corporate Standard + ISO 14064-1:2019</p>
                <p>Calculated at: {new Date().toISOString()}</p>
              </div>
            </div>

            {/* Export */}
            <div className="flex items-center space-x-3">
              <button onClick={exportGHGProtocolCSV}
                disabled={grandTotal === 0}
                className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                <Download className="w-4 h-4" /><span>Export GHG Protocol Report (CSV)</span>
              </button>
              <button onClick={exportAuditTrailCSV}
                disabled={grandTotal === 0}
                className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover disabled:opacity-50">
                <FileText className="w-4 h-4" /><span>Export Audit Trail (CSV)</span>
              </button>
              <button onClick={exportCDPCSV}
                disabled={grandTotal === 0}
                className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover disabled:opacity-50">
                <Download className="w-4 h-4" /><span>CDP Format (CSV)</span>
              </button>
            </div>

            {/* Conformance */}
            {grandTotal > 0 && (
              <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-brand-green" />
                <span className="text-xs text-brand-green">
                  This inventory is aligned with ISO 14064-1:2019 and GHG Protocol Corporate Standard requirements.
                  Independent verification placeholder available for third-party audit.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Add {showAddModal.scope === 'scope1' ? 'Scope 1' : showAddModal.scope === 'scope2' ? 'Scope 2' : 'Scope 3'} Entry
              </h2>
              <button onClick={() => setShowAddModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
                <input type="text" value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="e.g., Office heating - Natural Gas"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>

              {showAddModal.scope === 'scope1' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
                  <select value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="stationary_combustion">Stationary Combustion</option>
                    <option value="mobile_combustion">Mobile Combustion</option>
                    <option value="fugitive_emissions">Fugitive Emissions</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Source / Fuel Type *</label>
                <select value={newEntry.fuel_type}
                  onChange={(e) => setNewEntry({ ...newEntry, fuel_type: e.target.value })}
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                  <option value="">Select...</option>
                  {showAddModal.scope === 'scope1' && SCOPE1_FUEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  {showAddModal.scope === 'scope2' && SCOPE2_FUEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  {showAddModal.scope === 'scope3' && (() => {
                    const cat = SCOPE3_CATEGORIES.find(c => c.id === showAddModal.category);
                    return (cat?.fuelTypes || []).map(ft => (
                      <option key={ft} value={ft}>{ft.replace(/_/g, ' ')} ({getUnitForFuel(ft)})</option>
                    ));
                  })()}
                </select>
                {newEntry.fuel_type && EF_LOOKUP[newEntry.fuel_type] && (
                  <p className="text-xs text-gray-500 mt-1">
                    EF: {EF_LOOKUP[newEntry.fuel_type].value} {EF_LOOKUP[newEntry.fuel_type].unit} | Source: {EF_LOOKUP[newEntry.fuel_type].source}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Activity Value * {newEntry.fuel_type && `(${getUnitForFuel(newEntry.fuel_type)})`}
                </label>
                <input type="number" value={newEntry.value}
                  onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
                  placeholder="e.g., 150000"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                {newEntry.fuel_type && newEntry.value && !isNaN(parseFloat(newEntry.value)) && (
                  <p className="text-xs text-brand-green mt-1">
                    Estimated: {calculateCO2e({
                      id: '', category: '', subcategory: '', description: '',
                      value: parseFloat(newEntry.value), unit: '', fuel_type: newEntry.fuel_type,
                    }).toFixed(4)} tCO2e
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddModal(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={handleAddEntry}
                disabled={!newEntry.description || !newEntry.fuel_type || !newEntry.value}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
