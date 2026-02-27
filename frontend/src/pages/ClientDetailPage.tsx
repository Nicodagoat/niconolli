import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Flame, Zap, Globe, BarChart3, Upload,
  FileBarChart, Download, Mail, Phone,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { formatTonnes } from '../utils/formatters';
import type { Client } from '../types';

// Demo data keyed by id
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'activities' | 'reports'>('overview');

  const client = id ? DEMO_MAP[id] : undefined;
  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Client not found</p>
      </div>
    );
  }

  const total = client.total_co2e_tonnes || 1;
  const s1pct = ((client.total_scope1_tonnes / total) * 100).toFixed(1);
  const s2pct = ((client.total_scope2_tonnes / total) * 100).toFixed(1);
  const s3pct = ((client.total_scope3_tonnes / total) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
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
          <p className="text-sm text-gray-400">No recent activities recorded. Add activities or upload CSV data.</p>
        </div>
      )}

      {tab === 'activities' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Emission Activities</h3>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-1 px-3 py-1.5 bg-brand-yellow/10 text-brand-yellow rounded-lg text-xs hover:bg-brand-yellow/20">
                <Upload className="w-3 h-3" /><span>Upload CSV</span>
              </button>
              <button className="flex items-center space-x-1 px-3 py-1.5 primary-gradient text-white rounded-lg text-xs hover:opacity-90">
                <span>+ Add Activity</span>
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400">No activities yet. Add manual entries or upload CSV data for this client.</p>
        </div>
      )}

      {tab === 'reports' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Reports</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center space-x-3 p-4 bg-surface-hover rounded-lg hover:bg-surface-border transition-colors">
              <FileBarChart className="w-5 h-5 text-brand-blue" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">GHG Protocol Report</p>
                <p className="text-xs text-gray-400">Standard GHG Protocol format</p>
              </div>
            </button>
            <button className="flex items-center space-x-3 p-4 bg-surface-hover rounded-lg hover:bg-surface-border transition-colors">
              <Download className="w-5 h-5 text-brand-green" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Export CSV</p>
                <p className="text-xs text-gray-400">Download all emission data</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
