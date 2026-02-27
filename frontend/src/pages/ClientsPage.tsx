import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, ChevronRight } from 'lucide-react';
import { clientAPI } from '../services/api';
import { formatTonnes } from '../utils/formatters';
import type { Client } from '../types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-brand-green/20 text-brand-green',
  inactive: 'bg-gray-600/20 text-gray-400',
};

const DEMO_CLIENTS: Client[] = [
  { id: '1', name: 'Porto di Augusta S.r.l.', industry: 'transportation', status: 'active',
    contact_name: 'Marco Ferretti', contact_email: 'm.ferretti@portoaugusta.it', country: 'ITA',
    total_scope1_tonnes: 1250.3, total_scope2_tonnes: 890.4, total_scope3_tonnes: 2685.0,
    total_co2e_tonnes: 4825.7, created_at: '2024-01-15', updated_at: '2024-12-01' },
  { id: '2', name: 'Terminal Catania S.p.A.', industry: 'transportation', status: 'active',
    contact_name: 'Lucia Moretti', country: 'ITA',
    total_scope1_tonnes: 820.1, total_scope2_tonnes: 540.2, total_scope3_tonnes: 1340.8,
    total_co2e_tonnes: 2701.1, created_at: '2024-02-10', updated_at: '2024-11-20' },
  { id: '3', name: 'Siracusa Port Services', industry: 'transportation', status: 'active',
    contact_name: 'Giuseppe Rizzo', country: 'ITA',
    total_scope1_tonnes: 450.5, total_scope2_tonnes: 310.7, total_scope3_tonnes: 980.3,
    total_co2e_tonnes: 1741.5, created_at: '2024-03-05', updated_at: '2024-10-15' },
  { id: '4', name: 'Navigazione Messina', industry: 'transportation', status: 'inactive',
    contact_name: 'Anna Bianchi', country: 'ITA',
    total_scope1_tonnes: 620.0, total_scope2_tonnes: 410.0, total_scope3_tonnes: 1100.0,
    total_co2e_tonnes: 2130.0, created_at: '2024-04-20', updated_at: '2024-08-30' },
];

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    clientAPI.list().then((res) => setClients(res.data)).catch(() => {});
  }, []);

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your client portfolio</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg hover:opacity-90 text-sm">
          <Plus className="w-4 h-4" /><span>Add Client</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-gray-300 focus:outline-none focus:border-brand-blue">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-surface-card rounded-xl border border-surface-border p-5 hover:border-brand-blue/40 cursor-pointer transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{client.name}</h3>
                  <p className="text-xs text-gray-400">{client.contact_name}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[client.status]}`}>
                {client.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Scope 1</span>
                <span className="text-red-400 font-medium">{formatTonnes(client.total_scope1_tonnes)} t</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Scope 2</span>
                <span className="text-amber-400 font-medium">{formatTonnes(client.total_scope2_tonnes)} t</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Scope 3</span>
                <span className="text-[#6060FF] font-medium">{formatTonnes(client.total_scope3_tonnes)} t</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-border">
              <span className="text-sm font-bold text-white">{formatTonnes(client.total_co2e_tonnes)} tCO2e</span>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#6060FF] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
