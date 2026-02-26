import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FolderKanban, ChevronRight } from 'lucide-react';
import { deaspProjectAPI } from '../services/api';
import { formatTonnes } from '../utils/formatters';
import type { DEASPProject } from '../types';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-brand-yellow/20 text-brand-yellow',
  in_progress: 'bg-brand-blue/20 text-[#6060FF]',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-brand-green/20 text-brand-green',
  cancelled: 'bg-red-500/20 text-red-400',
};

const DEMO_PROJECTS: DEASPProject[] = [
  { id: 'p1', client_id: '1', name: 'Riduzione Emissioni Hotelling 2025',
    description: 'Cold ironing per ridurre emissioni navi in sosta',
    status: 'in_progress', target_reduction_tonnes: 500.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4100.2,
    progress_pct: 72.5, start_date: '2025-01-15', end_date: '2025-12-31',
    team_members: [{ name: 'Marco Ferretti', role: 'Project Lead' }, { name: 'Elena Russo', role: 'Engineer' }],
    ports_involved: ['augusta'], reporting_year: 2025,
    created_at: '2025-01-15', updated_at: '2025-02-20' },
  { id: 'p2', client_id: '2', name: 'Elettrificazione Mezzi Portuali',
    description: 'Sostituzione carrelli elevatori diesel con elettrici',
    status: 'planning', target_reduction_tonnes: 200.0,
    baseline_emissions_tonnes: 2701.1, current_emissions_tonnes: 2701.1,
    progress_pct: 0, start_date: '2025-06-01', end_date: '2026-06-01',
    team_members: [{ name: 'Lucia Moretti', role: 'Project Lead' }],
    ports_involved: ['catania'], reporting_year: 2025,
    created_at: '2025-02-01', updated_at: '2025-02-20' },
  { id: 'p3', client_id: '1', name: 'Fotovoltaico Aree Portuali',
    description: 'Pannelli solari su coperture magazzini per ridurre Scope 2',
    status: 'completed', target_reduction_tonnes: 300.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4500.0,
    progress_pct: 100, start_date: '2024-03-01', end_date: '2024-12-31',
    ports_involved: ['augusta'], reporting_year: 2024,
    created_at: '2024-03-01', updated_at: '2024-12-31' },
];

export default function DEASPProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DEASPProject[]>(DEMO_PROJECTS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    deaspProjectAPI.list().then((res) => setProjects(res.data)).catch(() => {});
  }, []);

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">DEASP Projects</h1>
          <p className="text-sm text-gray-400 mt-1">Emission reduction project tracking</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg hover:opacity-90 text-sm">
          <Plus className="w-4 h-4" /><span>New Project</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-gray-300 focus:outline-none focus:border-brand-blue">
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <div key={project.id} onClick={() => navigate(`/deasp-projects/${project.id}`)}
            className="bg-surface-card rounded-xl border border-surface-border p-5 hover:border-brand-blue/40 cursor-pointer transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-brand-yellow/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-brand-yellow" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                  <p className="text-xs text-gray-400">{project.description?.slice(0, 50)}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_COLORS[project.status]}`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Progress</span>
                <span className="text-white font-medium">{project.progress_pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, project.progress_pct)}%`,
                    background: project.progress_pct >= 100 ? '#00FF80'
                      : project.progress_pct > 50 ? 'linear-gradient(90deg, #0000FF, #4040FF)' : '#FEC500',
                  }} />
              </div>
            </div>

            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Current</span>
                <span className="text-gray-300">{formatTonnes(project.current_emissions_tonnes)} tCO2e</span>
              </div>
              {project.target_reduction_tonnes && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Target reduction</span>
                  <span className="text-brand-green">{formatTonnes(project.target_reduction_tonnes)} t</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-border">
              <div className="flex -space-x-2">
                {(project.team_members || []).slice(0, 3).map((m, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-surface-border border-2 border-surface-card flex items-center justify-center text-[9px] text-gray-300 font-medium">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </div>
                ))}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#6060FF] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
