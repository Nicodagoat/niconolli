import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Flame, Zap, Globe, BarChart3, Upload,
  FileBarChart, Download, Mail, Phone, Plus, Trash2, X,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { formatTonnes } from '../utils/formatters';
import type { Client } from '../types';

const DEMO_MAP: Record<string, Client> = {
  '1': { id: '1', name: 'Porto di Augusta S.r.l.', industry: 'transportation', status: 'active',
    contact_name: 'Marco Ferretti', contact_email: 'm.ferretti@portoaugusta.it', contact_phone: '+39 095 123456',
    address: 'Via Porto 1, Augusta (SR)', country: 'ITA',
    total_scope1_tonnes: 1250.3, total_scope2_tonnes: 890.4, total_scope3_tonnes: 2685.0,
    total_co2e_tonnes: 4825.7, created_at: '2024-01-15', updated_at: '2024-12-01' },
  '2': { id: '2', name: 'Terminal Catania S.p.A.', industry: 'transportation', status: 'active',
    contact_name: 'Lucia Moretti', contact_email: 'l.moretti@terminalct.it', country: 'ITA',
    total_scope1_tonnes: 820.1, total_scope2_tonnes: 540.2, total_scope3_tonnes: 1340.8,
    total_co2e_tonnes: 2701.1, created_at: '2024-02-10', updated_at: '2024-11-20' },
  '3': { id: '3', name: 'Siracusa Port Services', industry: 'transportation', status: 'active',
    contact_name: 'Giuseppe Rizzo', contact_email: 'g.rizzo@srportservices.it', country: 'ITA',
    total_scope1_tonnes: 450.5, total_scope2_tonnes: 310.7, total_scope3_tonnes: 980.3,
    total_co2e_tonnes: 1741.5, created_at: '2024-03-05', updated_at: '2024-10-15' },
  '4': { id: '4', name: 'Navigazione Messina', industry: 'transportation', status: 'inactive',
    contact_name: 'Anna Bianchi', contact_email: 'a.bianchi@navme.it', country: 'ITA',
    total_scope1_tonnes: 620.0, total_scope2_tonnes: 410.0, total_scope3_tonnes: 1100.0,
    total_co2e_tonnes: 2130.0, created_at: '2024-04-20', updated_at: '2024-08-30' },
};

interface ActivityEntry {
  id: string;
  scope: string;
  category: string;
  description: string;
  value: number;
  unit: string;
  ef_source: string;
  co2e_tonnes: number;
}

const STORAGE_KEY_PREFIX = 'client_activities_';

function loadActivities(clientId: string): ActivityEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + clientId);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveActivities(clientId: string, activities: ActivityEntry[]) {
  localStorage.setItem(STORAGE_KEY_PREFIX + clientId, JSON.stringify(activities));
}

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'activities' | 'reports'>('overview');
  const [activities, setActivities] = useState<ActivityEntry[]>(() => loadActivities(id || ''));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [newActivity, setNewActivity] = useState({
    scope: 'scope_1', category: '', description: '', value: '', unit: 'kWh', ef_source: 'ISPRA 2024', co2e_factor: '0.00026',
  });

  const client = id ? DEMO_MAP[id] : undefined;
  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Client not found. <button onClick={() => navigate('/clients')} className="text-brand-blue underline">Go back</button></p>
      </div>
    );
  }

  const total = client.total_co2e_tonnes || 1;
  const s1pct = ((client.total_scope1_tonnes / total) * 100).toFixed(1);
  const s2pct = ((client.total_scope2_tonnes / total) * 100).toFixed(1);
  const s3pct = ((client.total_scope3_tonnes / total) * 100).toFixed(1);

  const handleAddActivity = () => {
    const numValue = parseFloat(newActivity.value);
    const factor = parseFloat(newActivity.co2e_factor);
    if (isNaN(numValue) || isNaN(factor) || !newActivity.description) return;

    const entry: ActivityEntry = {
      id: `act_${Date.now()}`,
      scope: newActivity.scope.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: newActivity.category || 'General',
      description: newActivity.description,
      value: numValue,
      unit: newActivity.unit,
      ef_source: newActivity.ef_source,
      co2e_tonnes: numValue * factor,
    };

    const updated = [...activities, entry];
    setActivities(updated);
    saveActivities(id!, updated);
    setShowAddModal(false);
    setNewActivity({ scope: 'scope_1', category: '', description: '', value: '', unit: 'kWh', ef_source: 'ISPRA 2024', co2e_factor: '0.00026' });
  };

  const handleDeleteActivity = (actId: string) => {
    const updated = activities.filter(a => a.id !== actId);
    setActivities(updated);
    saveActivities(id!, updated);
  };

  const handleCSVImport = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n');
    const imported: ActivityEntry[] = [];
    // Skip header line if it contains non-numeric first field
    const startIdx = lines[0].includes('scope') || lines[0].includes('Scope') ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 5) {
        imported.push({
          id: `csv_${Date.now()}_${i}`,
          scope: cols[0] || 'Scope 1',
          category: cols[1] || 'Imported',
          description: cols[2] || `Row ${i}`,
          value: parseFloat(cols[3]) || 0,
          unit: cols[4] || 'kWh',
          ef_source: cols[5] || 'CSV Import',
          co2e_tonnes: parseFloat(cols[6]) || 0,
        });
      }
    }
    if (imported.length > 0) {
      const updated = [...activities, ...imported];
      setActivities(updated);
      saveActivities(id!, updated);
    }
    setShowCSVModal(false);
    setCsvText('');
  };

  const exportGHGReport = () => {
    const headers = ['Client', 'Scope', 'Category', 'Description', 'Value', 'Unit', 'EF Source', 'tCO2e'];
    const rows: string[][] = [];

    // Include both baseline data and user activities
    rows.push([client.name, 'Scope 1', 'Direct Emissions', 'Baseline Scope 1', client.total_scope1_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope1_tonnes.toFixed(4)]);
    rows.push([client.name, 'Scope 2', 'Energy Indirect', 'Baseline Scope 2', client.total_scope2_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope2_tonnes.toFixed(4)]);
    rows.push([client.name, 'Scope 3', 'Value Chain', 'Baseline Scope 3', client.total_scope3_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope3_tonnes.toFixed(4)]);

    for (const act of activities) {
      rows.push([client.name, act.scope, act.category, act.description, act.value.toString(), act.unit, act.ef_source, act.co2e_tonnes.toFixed(4)]);
    }

    const actTotal = activities.reduce((s, a) => s + a.co2e_tonnes, 0);
    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', '', '', (client.total_co2e_tonnes + actTotal).toFixed(4)]);

    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_GHG_Protocol_Report.csv`, 'text/csv');
  };

  const exportAllCSV = () => {
    const headers = ['Scope', 'Category', 'Description', 'Activity Value', 'Unit', 'EF Source', 'tCO2e'];
    const rows: string[][] = [];

    rows.push(['Scope 1', 'Direct', 'All Scope 1 emissions (baseline)', client.total_scope1_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope1_tonnes.toFixed(4)]);
    rows.push(['Scope 2', 'Energy', 'All Scope 2 emissions (baseline)', client.total_scope2_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope2_tonnes.toFixed(4)]);
    rows.push(['Scope 3', 'Value Chain', 'All Scope 3 emissions (baseline)', client.total_scope3_tonnes.toString(), 'tCO2e', 'Baseline', client.total_scope3_tonnes.toFixed(4)]);

    for (const act of activities) {
      rows.push([act.scope, act.category, act.description, act.value.toString(), act.unit, act.ef_source, act.co2e_tonnes.toFixed(4)]);
    }

    const csv = generateCSV(headers, rows);
    downloadFile(csv, `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_Emissions_Export.csv`, 'text/csv');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/clients')} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <p className="text-sm text-gray-400">{client.industry} &middot; {client.country}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
          client.status === 'active' ? 'bg-brand-green/20 text-brand-green' : 'bg-gray-600/20 text-gray-400'
        }`}>
          {client.status}
        </span>
      </div>

      {/* Client Info Panel */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Contact</p>
              <p className="text-sm text-white">{client.contact_name}</p>
              <p className="text-xs text-gray-400">{client.contact_email}</p>
            </div>
          </div>
          {client.contact_phone && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-brand-yellow/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-brand-yellow" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="text-sm text-white">{client.contact_phone}</p>
              </div>
            </div>
          )}
          {client.address && (
            <div>
              <p className="text-xs text-gray-400">Address</p>
              <p className="text-sm text-white">{client.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scope Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Emissions" value={`${formatTonnes(client.total_co2e_tonnes)} tCO2e`}
          subtitle="All scopes" icon={<BarChart3 className="w-6 h-6" />} color="blue" />
        <StatCard title="Scope 1 (Direct)" value={`${formatTonnes(client.total_scope1_tonnes)} tCO2e`}
          subtitle="Combustion, fugitive" icon={<Flame className="w-6 h-6" />} color="red" />
        <StatCard title="Scope 2 (Energy)" value={`${formatTonnes(client.total_scope2_tonnes)} tCO2e`}
          subtitle="Electricity, heat" icon={<Zap className="w-6 h-6" />} color="amber" />
        <StatCard title="Scope 3 (Value Chain)" value={`${formatTonnes(client.total_scope3_tonnes)} tCO2e`}
          subtitle="Travel, procurement" icon={<Globe className="w-6 h-6" />} color="purple" />
      </div>

      {/* Scope Distribution Bar */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Scope Distribution</h3>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div className="bg-red-500" style={{ width: `${s1pct}%` }} title={`Scope 1: ${s1pct}%`} />
          <div className="bg-amber-500" style={{ width: `${s2pct}%` }} title={`Scope 2: ${s2pct}%`} />
          <div className="bg-[#4040FF]" style={{ width: `${s3pct}%` }} title={`Scope 3: ${s3pct}%`} />
        </div>
        <div className="flex items-center space-x-6 mt-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-400">Scope 1 ({s1pct}%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-400">Scope 2 ({s2pct}%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#4040FF]" />
            <span className="text-xs text-gray-400">Scope 3 ({s3pct}%)</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-border">
        <div className="flex space-x-6">
          {(['overview', 'activities', 'reports'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-blue text-white' : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.slice(-5).reverse().map(act => (
                <div key={act.id} className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div>
                    <p className="text-sm text-white">{act.description}</p>
                    <p className="text-xs text-gray-500">{act.scope} - {act.category}</p>
                  </div>
                  <span className="text-sm font-mono text-brand-green">{act.co2e_tonnes.toFixed(2)} tCO2e</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recent activities recorded. Go to Activities tab to add data.</p>
          )}
        </div>
      )}

      {tab === 'activities' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Emission Activities ({activities.length})</h3>
            <div className="flex space-x-2">
              <button onClick={() => setShowCSVModal(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-brand-yellow/10 text-brand-yellow rounded-lg text-xs hover:bg-brand-yellow/20">
                <Upload className="w-3 h-3" /><span>Upload CSV</span>
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-1 px-3 py-1.5 primary-gradient text-white rounded-lg text-xs hover:opacity-90">
                <Plus className="w-3 h-3" /><span>Add Activity</span>
              </button>
            </div>
          </div>
          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-hover">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Scope</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Value</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Unit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Source</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">tCO2e</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {activities.map(act => (
                    <tr key={act.id} className="hover:bg-surface-hover/50">
                      <td className="px-3 py-2 text-xs text-gray-300">{act.scope}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{act.category}</td>
                      <td className="px-3 py-2 text-xs text-white">{act.description}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white">{act.value.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{act.unit}</td>
                      <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 bg-brand-blue/10 text-[#6060FF] rounded">{act.ef_source}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{act.co2e_tonnes.toFixed(4)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleDeleteActivity(act.id)} className="text-gray-500 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-border">
                    <td colSpan={6} className="px-3 py-2 text-xs font-bold text-gray-300">Activities Total</td>
                    <td className="px-3 py-2 text-right font-mono text-sm font-bold text-white">
                      {activities.reduce((s, a) => s + a.co2e_tonnes, 0).toFixed(4)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No activities yet. Add manual entries or upload CSV data.</p>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Reports</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={exportGHGReport}
              className="flex items-center space-x-3 p-4 bg-surface-hover rounded-lg hover:bg-surface-border transition-colors">
              <FileBarChart className="w-5 h-5 text-brand-blue" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">GHG Protocol Report</p>
                <p className="text-xs text-gray-400">Download standard GHG Protocol format (CSV)</p>
              </div>
            </button>
            <button onClick={exportAllCSV}
              className="flex items-center space-x-3 p-4 bg-surface-hover rounded-lg hover:bg-surface-border transition-colors">
              <Download className="w-5 h-5 text-brand-green" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Export CSV</p>
                <p className="text-xs text-gray-400">Download all emission data</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Activity</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Scope *</label>
                  <select value={newActivity.scope} onChange={(e) => setNewActivity({ ...newActivity, scope: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="scope_1">Scope 1</option>
                    <option value="scope_2">Scope 2</option>
                    <option value="scope_3">Scope 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <input type="text" value={newActivity.category} onChange={(e) => setNewActivity({ ...newActivity, category: e.target.value })}
                    placeholder="e.g., Electricity"
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
                <input type="text" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  placeholder="e.g., Office electricity consumption"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Value *</label>
                  <input type="number" value={newActivity.value} onChange={(e) => setNewActivity({ ...newActivity, value: e.target.value })}
                    placeholder="150000"
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Unit</label>
                  <select value={newActivity.unit} onChange={(e) => setNewActivity({ ...newActivity, unit: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="kWh">kWh</option>
                    <option value="litres">litres</option>
                    <option value="kg">kg</option>
                    <option value="tonnes">tonnes</option>
                    <option value="km">km</option>
                    <option value="EUR">EUR</option>
                    <option value="m3">m3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">EF (tCO2/unit)</label>
                  <input type="number" step="any" value={newActivity.co2e_factor} onChange={(e) => setNewActivity({ ...newActivity, co2e_factor: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
              </div>
              {newActivity.value && newActivity.co2e_factor && (
                <p className="text-xs text-brand-green">
                  Estimated: {(parseFloat(newActivity.value) * parseFloat(newActivity.co2e_factor)).toFixed(4)} tCO2e
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Cancel</button>
              <button onClick={handleAddActivity} disabled={!newActivity.description || !newActivity.value}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Add Activity</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Import CSV Data</h2>
              <button onClick={() => setShowCSVModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Paste CSV data with columns: Scope, Category, Description, Value, Unit, EF Source, tCO2e</p>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
                rows={8} placeholder="Scope 1,Electricity,Office power,500000,kWh,ISPRA 2024,130.0"
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-3 text-sm text-white font-mono focus:outline-none focus:border-brand-blue" />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowCSVModal(false)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Cancel</button>
              <button onClick={handleCSVImport} disabled={!csvText.trim()}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
