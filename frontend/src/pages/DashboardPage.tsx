import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, BarChart3, Building2,
  ChevronRight, Plus, Flame, Zap, Link2, Anchor,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { dashboardAPI } from '../services/api';
import { formatTonnes } from '../utils/formatters';
import { useStore } from '../store';
import type { Client, DEASPProject, DashboardSummary } from '../types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-brand-green/20 text-brand-green',
  inactive: 'bg-gray-600/20 text-gray-400',
  planning: 'bg-brand-yellow/20 text-brand-yellow',
  in_progress: 'bg-brand-blue/20 text-[#6060FF]',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-brand-green/20 text-brand-green',
  cancelled: 'bg-red-500/20 text-red-400',
  draft: 'bg-gray-500/20 text-gray-400',
  data_collection: 'bg-brand-yellow/20 text-brand-yellow',
  calculation: 'bg-brand-blue/20 text-[#6060FF]',
  review: 'bg-purple-500/20 text-purple-400',
  finalized: 'bg-brand-green/20 text-brand-green',
};

const DEMO_SME_PROJECTS = [
  { id: '1', project_id: 'SME-2025-00001', company_name: 'TechnoVerde S.r.l.',
    status: 'data_collection', total_co2e: 1351.4, completeness: 65 },
  { id: '2', project_id: 'SME-2025-00002', company_name: 'Manifattura Sicilia S.p.A.',
    status: 'calculation', total_co2e: 3540.0, completeness: 92 },
  { id: '3', project_id: 'SME-2024-00003', company_name: 'Green Logistics Italia',
    status: 'finalized', total_co2e: 6450.0, completeness: 100 },
];

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
];

const DEMO_DEASP_PROJECTS: DEASPProject[] = [
  { id: 'p1', client_id: '1', name: 'Riduzione Emissioni Hotelling 2025',
    description: 'Cold ironing per ridurre emissioni navi in sosta',
    status: 'in_progress', target_reduction_tonnes: 500.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4100.2,
    progress_pct: 72.5, start_date: '2025-01-15', end_date: '2025-12-31',
    created_at: '2025-01-15', updated_at: '2025-02-20' },
  { id: 'p2', client_id: '2', name: 'Elettrificazione Mezzi Portuali',
    status: 'planning', baseline_emissions_tonnes: 2701.1, current_emissions_tonnes: 2701.1,
    progress_pct: 0, created_at: '2025-02-01', updated_at: '2025-02-20' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [deaspProjects, setDeaspProjects] = useState<DEASPProject[]>(DEMO_DEASP_PROJECTS);
  const [smeProjects] = useState(DEMO_SME_PROJECTS);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await dashboardAPI.getSummary();
      const data: DashboardSummary = res.data;
      setClients(data.clients);
      setDeaspProjects(data.projects);
    } catch {
      // Keep demo data
    }
  };

  const showSME = !user || user.role !== 'deasp_user';
  const showDEASP = !user || user.role !== 'sme_user';

  const totalSMEEmissions = smeProjects.reduce((s, p) => s + p.total_co2e, 0);
  const totalDEASPEmissions = clients.reduce((s, c) => s + c.total_co2e_tonnes, 0);
  const activeClients = clients.filter(c => c.status === 'active').length;
  const activeDeasp = deaspProjects.filter(p => p.status === 'in_progress' || p.status === 'planning').length;
  const activeSME = smeProjects.filter(p => p.status !== 'finalized').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            {user?.full_name ? `Welcome back, ${user.full_name}` : 'Overview of your GHG accounting projects'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {showSME && (
            <button onClick={() => navigate('/sme-projects')}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-green/10 text-brand-green border border-brand-green/30 rounded-lg hover:bg-brand-green/20">
              <Plus className="w-4 h-4" /><span>New SME Project</span>
            </button>
          )}
          {showDEASP && (
            <button onClick={() => navigate('/deasp')}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-blue/10 text-[#6060FF] border border-brand-blue/30 rounded-lg hover:bg-brand-blue/20">
              <Plus className="w-4 h-4" /><span>New DEASP Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {showSME && (
          <StatCard title="SME Emissions" value={`${formatTonnes(totalSMEEmissions)} tCO2e`}
            subtitle={`${activeSME} active projects`} icon={<Building2 className="w-6 h-6" />} color="green" />
        )}
        {showDEASP && (
          <>
            <StatCard title="DEASP Emissions" value={`${formatTonnes(totalDEASPEmissions)} tCO2e`}
              subtitle={`${activeClients} port authorities`} icon={<Anchor className="w-6 h-6" />} color="blue" />
            <StatCard title="DEASP Projects" value={`${activeDeasp}`}
              subtitle={`${deaspProjects.length} total`} icon={<FolderKanban className="w-6 h-6" />} color="yellow" />
          </>
        )}
        <StatCard title="Total Tracked" value={`${formatTonnes(totalSMEEmissions + totalDEASPEmissions)} tCO2e`}
          subtitle="All modules combined" icon={<BarChart3 className="w-6 h-6" />} color="blue" />
      </div>

      {/* Split View */}
      <div className={`grid grid-cols-1 ${showSME && showDEASP ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* SME Projects */}
        {showSME && (
          <div className="bg-surface-card rounded-xl border border-surface-border">
            <div className="flex items-center justify-between p-5 border-b border-surface-border">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-brand-green" />
                <h3 className="text-lg font-semibold text-white">SME Projects</h3>
              </div>
              <button onClick={() => navigate('/sme-projects')}
                className="text-sm text-brand-green hover:text-brand-green/80">View All</button>
            </div>
            <div className="divide-y divide-surface-border">
              {smeProjects.map((project) => (
                <div key={project.id} onClick={() => navigate(`/sme-projects/${project.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-surface-hover cursor-pointer transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-semibold text-white truncate">{project.company_name}</h4>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[project.status]}`}>
                        {project.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500 font-mono">{project.project_id}</span>
                      <span className="text-xs text-gray-400">{formatTonnes(project.total_co2e)} tCO2e</span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1.5">
                      <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full bg-brand-green" style={{ width: `${project.completeness}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{project.completeness}%</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-brand-green transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEASP Projects */}
        {showDEASP && (
          <div className="bg-surface-card rounded-xl border border-surface-border">
            <div className="flex items-center justify-between p-5 border-b border-surface-border">
              <div className="flex items-center space-x-2">
                <Anchor className="w-5 h-5 text-[#6060FF]" />
                <h3 className="text-lg font-semibold text-white">DEASP Port Authorities</h3>
              </div>
              <button onClick={() => navigate('/deasp')}
                className="text-sm text-[#6060FF] hover:text-[#6060FF]/80">DEASP Workflow</button>
            </div>
            <div className="divide-y divide-surface-border">
              {clients.map((client) => (
                <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                  className="p-4 hover:bg-surface-hover cursor-pointer transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-white truncate">{client.name}</h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[client.status]}`}>
                      {client.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <Flame className="w-3 h-3 text-brand-green" />
                      <span className="text-gray-400">{formatTonnes(client.total_scope1_tonnes)} t</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-[#6060FF]" />
                      <span className="text-gray-400">{formatTonnes(client.total_scope2_tonnes)} t</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Link2 className="w-3 h-3 text-brand-yellow" />
                      <span className="text-gray-400">{formatTonnes(client.total_scope3_tonnes)} t</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
