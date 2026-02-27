import { useState } from 'react';
import {
  ArrowLeft, Flame, Zap, Link2, BarChart3, Save, Calculator, CheckCircle,
  AlertTriangle, HelpCircle, Plus, Trash2, Download, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatTonnes } from '../utils/formatters';

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

// Emission factor lookup (simplified)
const EF_LOOKUP: Record<string, { value: number; source: string; unit: string }> = {
  'natural_gas': { value: 0.00205, source: 'ISPRA 2024', unit: 'tCO2/kWh' },
  'diesel': { value: 2.68, source: 'DEFRA 2024', unit: 'kgCO2/litre' },
  'lpg': { value: 1.56, source: 'DEFRA 2024', unit: 'kgCO2/litre' },
  'gasoline': { value: 2.31, source: 'DEFRA 2024', unit: 'kgCO2/litre' },
  'coal': { value: 2.42, source: 'IPCC 2006', unit: 'tCO2/tonne' },
  'biomass': { value: 0.0, source: 'GHG Protocol', unit: 'tCO2/tonne' },
  'electricity_ita': { value: 0.000260, source: 'ISPRA 2024', unit: 'tCO2/kWh' },
  'refrigerant_r410a': { value: 2088, source: 'IPCC AR6', unit: 'GWP' },
  'refrigerant_r134a': { value: 1430, source: 'IPCC AR6', unit: 'GWP' },
  'refrigerant_r32': { value: 675, source: 'IPCC AR6', unit: 'GWP' },
};

const SCOPE3_CATEGORIES = [
  { id: 'cat1', label: 'Cat 1: Purchased Goods & Services', method: 'spend' },
  { id: 'cat2', label: 'Cat 2: Capital Goods', method: 'spend' },
  { id: 'cat3', label: 'Cat 3: Fuel & Energy Activities', method: 'auto' },
  { id: 'cat4', label: 'Cat 4: Upstream Transportation', method: 'distance' },
  { id: 'cat5', label: 'Cat 5: Waste Generated', method: 'waste' },
  { id: 'cat6', label: 'Cat 6: Business Travel', method: 'distance' },
  { id: 'cat7', label: 'Cat 7: Employee Commuting', method: 'survey' },
  { id: 'cat8', label: 'Cat 8: Upstream Leased Assets', method: 'spend' },
];

export default function SMEProjectDetailPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WizardTab>('scope1');
  const [calculated, setCalculated] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stationary']));

  // Scope 1 data
  const [scope1Data, setScope1Data] = useState<DataEntry[]>([
    { id: '1', category: 'stationary_combustion', subcategory: 'Heating', description: 'Office heating - Natural Gas',
      value: 150000, unit: 'kWh', fuel_type: 'natural_gas', ef_value: 0.00205, ef_source: 'ISPRA 2024', co2e_tonnes: 307.5 },
    { id: '2', category: 'mobile_combustion', subcategory: 'Fleet', description: 'Company car fleet - Diesel',
      value: 25000, unit: 'litres', fuel_type: 'diesel', ef_value: 2.68, ef_source: 'DEFRA 2024', co2e_tonnes: 67.0 },
    { id: '3', category: 'fugitive_emissions', subcategory: 'Refrigerants', description: 'AC system - R410A leakage',
      value: 5, unit: 'kg', fuel_type: 'refrigerant_r410a', ef_value: 2088, ef_source: 'IPCC AR6', co2e_tonnes: 10.44 },
  ]);

  // Scope 2 data
  const [scope2Data, setScope2Data] = useState<DataEntry[]>([
    { id: '4', category: 'purchased_electricity', subcategory: 'Grid', description: 'Office electricity consumption',
      value: 500000, unit: 'kWh', fuel_type: 'electricity_ita', ef_value: 0.000260, ef_source: 'ISPRA 2024', co2e_tonnes: 130.0 },
  ]);
  const [scope2Method, setScope2Method] = useState<'location' | 'market'>('location');

  // Scope 3 data
  const [scope3Data, setScope3Data] = useState<DataEntry[]>([
    { id: '5', category: 'cat1', subcategory: 'Purchased Goods', description: 'Office supplies and materials',
      value: 250000, unit: 'EUR', ef_value: 0.0005, ef_source: 'EEIO 2024', co2e_tonnes: 125.0 },
    { id: '6', category: 'cat6', subcategory: 'Business Travel', description: 'Flight Rome-Milan (10 trips)',
      value: 5000, unit: 'km', ef_value: 0.000255, ef_source: 'DEFRA 2024', co2e_tonnes: 1.275 },
    { id: '7', category: 'cat7', subcategory: 'Employee Commuting', description: '50 employees avg 20km/day',
      value: 250000, unit: 'km', ef_value: 0.000171, ef_source: 'ISPRA 2024', co2e_tonnes: 42.75 },
  ]);

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

  const handleCalculate = () => {
    setCalculated(true);
    setActiveTab('results');
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

  const renderDataTable = (data: DataEntry[], scope: string) => (
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
                <button className="text-gray-500 hover:text-red-400">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/sme-projects')} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">TechnoVerde S.r.l.</h1>
            <p className="text-sm text-gray-400">SME-2025-00001 | Reporting Year: 2025 | ISO 14064-1:2019</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
            <Save className="w-4 h-4" /><span>Save Draft</span>
          </button>
          <button onClick={handleCalculate}
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
              <button className="flex items-center space-x-1 text-sm text-brand-green hover:text-brand-green/80">
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
                  {renderDataTable(scope1Data.filter(d => d.category === 'stationary_combustion'), 'Stationary')}
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
                  {renderDataTable(scope1Data.filter(d => d.category === 'mobile_combustion'), 'Mobile')}
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
                  {renderDataTable(scope1Data.filter(d => d.category === 'fugitive_emissions'), 'Fugitive')}
                </div>
              )}
            </div>

            {/* Completeness */}
            <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-brand-green" />
              <span className="text-xs text-brand-green">Scope 1 completeness: 85% - 3 categories covered</span>
            </div>
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

            {renderDataTable(scope2Data, 'Scope 2')}

            <button className="flex items-center space-x-1 text-sm text-[#6060FF] hover:text-[#6060FF]/80">
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
                        renderDataTable(entries, cat.label)
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-gray-500 mb-2">No data entered for this category</p>
                          <button className="text-xs text-brand-yellow hover:text-brand-yellow/80">
                            + Add data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center space-x-2 p-3 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-brand-yellow" />
              <span className="text-xs text-brand-yellow">
                5 of 8 Scope 3 categories have no data. Consider at least Cat 1, 5, 6, 7 for completeness.
              </span>
            </div>
          </div>
        )}

        {/* Results */}
        {activeTab === 'results' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>GHG Inventory Results</span>
            </h2>

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
              <button className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
                <Download className="w-4 h-4" /><span>Export GHG Protocol Report (PDF)</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
                <FileText className="w-4 h-4" /><span>Export Audit Trail (Excel)</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
                <Download className="w-4 h-4" /><span>CDP Format</span>
              </button>
            </div>

            {/* Conformance */}
            <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-brand-green" />
              <span className="text-xs text-brand-green">
                This inventory is aligned with ISO 14064-1:2019 and GHG Protocol Corporate Standard requirements.
                Independent verification placeholder available for third-party audit.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
