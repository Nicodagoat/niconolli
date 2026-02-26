import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FolderKanban, BarChart3, TrendingDown,
  ChevronRight, MoreHorizontal, Plus,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { dashboardAPI } from '../services/api';
import { formatTonnes } from '../utils/formatters';
import type { Client, DEASPProject, DashboardSummary } from '../types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-brand-green/20 text-brand-green',
  inactive: 'bg-gray-600/20 text-gray-400',
  planning: 'bg-brand-yellow/20 text-brand-yellow',
  in_progress: 'bg-brand-blue/20 text-[#6060FF]',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-brand-green/20 text-brand-green',
  cancelled: 'bg-red-500/20 text-red-400',
};

// Demo data fallback
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

const DEMO_PROJECTS: DEASPProject[] = [
  { id: 'p1', client_id: '1', name: 'Riduzione Emissioni Hotelling 2025',
    description: 'Cold ironing per ridurre emissioni navi in sosta',
    status: 'in_progress', target_reduction_tonnes: 500.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4100.2,
    progress_pct: 72.5, start_date: '2025-01-15', end_date: '2025-12-31',
    created_at: '2025-01-15', updated_at: '2025-02-20' },
  { id: 'p2', client_id: '2', name: 'Elettrificazione Mezzi Portuali',
    description: 'Sostituzione carrelli elevatori diesel con elettrici',
    status: 'planning', target_reduction_tonnes: 200.0,
    baseline_emissions_tonnes: 2701.1, current_emissions_tonnes: 2701.1,
    progress_pct: 0, start_date: '2025-06-01', end_date: '2026-06-01',
    created_at: '2025-02-01', updated_at: '2025-02-20' },
  { id: 'p3', client_id: '1', name: 'Fotovoltaico Aree Portuali',
    description: 'Pannelli solari su coperture magazzini',
    status: 'completed', target_reduction_tonnes: 300.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4500.0,
    progress_pct: 100, start_date: '2024-03-01', end_date: '2024-12-31',
    created_at: '2024-03-01', updated_at: '2024-12-31' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [projects, setProjects] = useState<DEASPProject[]>(DEMO_PROJECTS);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await dashboardAPI.getSummary();
      const data: DashboardSummary = res.data;
      setClients(data.clients);
      setProjects(data.projects);
    } catch {
      // Keep demo data
    }
  };

  const totalEmissions = clients.reduce((s, c) => s + c.total_co2e_tonnes, 0);
  const activeClients = clients.filter((c) => c.status === 'active').length;
  const activeProjects = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').length;
  const avgProgress = (() => {
    const withProgress = projects.filter(p => p.progress_pct > 0);
    return withProgress.length > 0
      ? (withProgress.reduce((s, p) => s + p.progress_pct, 0) / withProgress.length).toFixed(0)
      : '0';
  })();

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Overview of clients and DEASP projects</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Emissions" value={`${formatTonnes(totalEmissions)} tCO2e`}
          subtitle="Across all clients" icon={<BarChart3 className="w-6 h-6" />} color="blue" />
        <StatCard title="Active Clients" value={`${activeClients}`}
          subtitle={`${clients.length} total`} icon={<Users className="w-6 h-6" />} color="green" />
        <StatCard title="Active Projects" value={`${activeProjects}`}
          subtitle={`${projects.length} total`} icon={<FolderKanban className="w-6 h-6" />} color="yellow" />
        <StatCard title="Avg Reduction" value={`${avgProgress}%`}
          subtitle="Progress toward targets" icon={<TrendingDown className="w-6 h-6" />} color="green" />
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Clients */}
        <div className="bg-surface-card rounded-xl border border-surface-border">
          <div className="flex items-center justify-between p-5 border-b border-surface-border">
            <h3 className="text-lg font-semibold text-white">Clients</h3>
            <button onClick={() => navigate('/clients')}
              className="flex items-center space-x-1 text-sm text-brand-yellow hover:text-brand-yellow/80 transition-colors">
              <Plus className="w-4 h-4" /><span>Add Client</span>
            </button>
          </div>
          <div className="divide-y divide-surface-border">
            {clients.map((client) => (
              <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                className="flex items-center justify-between p-4 hover:bg-surface-hover cursor-pointer transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-semibold text-white truncate">{client.name}</h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[client.status]}`}>
                      {client.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatTonnes(client.total_co2e_tonnes)} tCO2e total</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={(e) => { e.stopPropagation(); }}
                    className="p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#6060FF] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: DEASP Projects */}
        <div className="bg-surface-card rounded-xl border border-surface-border">
          <div className="flex items-center justify-between p-5 border-b border-surface-border">
            <h3 className="text-lg font-semibold text-white">DEASP Projects</h3>
            <button onClick={() => navigate('/deasp-projects')}
              className="flex items-center space-x-1 text-sm text-brand-yellow hover:text-brand-yellow/80 transition-colors">
              <Plus className="w-4 h-4" /><span>New Project</span>
            </button>
          </div>
          <div className="divide-y divide-surface-border">
            {projects.map((project) => (
              <div key={project.id} onClick={() => navigate(`/deasp-projects/${project.id}`)}
                className="p-4 hover:bg-surface-hover cursor-pointer transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white truncate">{project.name}</h4>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_COLORS[project.status]}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {getClientName(project.client_id)} &middot; {formatTonnes(project.current_emissions_tonnes)} tCO2e
                </p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, project.progress_pct)}%`,
                        background: project.progress_pct >= 100 ? '#00FF80'
                          : project.progress_pct > 50 ? 'linear-gradient(90deg, #0000FF, #4040FF)' : '#FEC500',
                      }} />
                  </div>
                  <span className="text-xs font-medium text-gray-300 w-10 text-right">
                    {project.progress_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
