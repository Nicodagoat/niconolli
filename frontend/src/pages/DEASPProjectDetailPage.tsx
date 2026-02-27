import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Target, TrendingDown, Calendar, Users as UsersIcon,
  Activity, MapPin,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { formatTonnes } from '../utils/formatters';
import type { DEASPProject } from '../types';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-brand-yellow/20 text-brand-yellow',
  in_progress: 'bg-brand-blue/20 text-[#6060FF]',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-brand-green/20 text-brand-green',
  cancelled: 'bg-red-500/20 text-red-400',
};

const DEMO_MAP: Record<string, DEASPProject> = {
  'p1': { id: 'p1', client_id: '1', name: 'Riduzione Emissioni Hotelling 2025',
    description: 'Installazione di impianti cold ironing per la fornitura di energia elettrica da terra alle navi in sosta, eliminando la necessità di mantenere i motori ausiliari accesi durante le operazioni di hotelling.',
    status: 'in_progress', target_reduction_tonnes: 500.0, target_reduction_pct: 15.0,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4100.2,
    progress_pct: 72.5, start_date: '2025-01-15', end_date: '2025-12-31',
    team_members: [{ name: 'Marco Ferretti', role: 'Project Lead' }, { name: 'Elena Russo', role: 'Engineer' }, { name: 'Paolo Conti', role: 'Technician' }],
    activity_log: [
      { date: '2025-02-20', action: 'Updated current emissions: 4100.2 tCO2e', user: 'Marco Ferretti' },
      { date: '2025-02-01', action: 'Cold ironing system Phase 1 installed', user: 'Elena Russo' },
      { date: '2025-01-15', action: 'Project kickoff meeting', user: 'Marco Ferretti' },
    ],
    ports_involved: ['augusta'], reporting_year: 2025,
    created_at: '2025-01-15', updated_at: '2025-02-20' },
  'p2': { id: 'p2', client_id: '2', name: 'Elettrificazione Mezzi Portuali',
    description: 'Programma di sostituzione progressiva dei carrelli elevatori diesel con modelli elettrici per ridurre le emissioni dirette Scope 1 nelle aree operative del terminal container.',
    status: 'planning', target_reduction_tonnes: 200.0, target_reduction_pct: 7.4,
    baseline_emissions_tonnes: 2701.1, current_emissions_tonnes: 2701.1,
    progress_pct: 0, start_date: '2025-06-01', end_date: '2026-06-01',
    team_members: [{ name: 'Lucia Moretti', role: 'Project Lead' }],
    activity_log: [
      { date: '2025-02-01', action: 'Project proposal submitted', user: 'Lucia Moretti' },
    ],
    ports_involved: ['catania'], reporting_year: 2025,
    created_at: '2025-02-01', updated_at: '2025-02-20' },
  'p3': { id: 'p3', client_id: '1', name: 'Fotovoltaico Aree Portuali',
    description: 'Installazione di pannelli fotovoltaici sulle coperture dei magazzini portuali per generare energia rinnovabile e ridurre le emissioni Scope 2.',
    status: 'completed', target_reduction_tonnes: 300.0, target_reduction_pct: 6.2,
    baseline_emissions_tonnes: 4825.7, current_emissions_tonnes: 4500.0,
    progress_pct: 100, start_date: '2024-03-01', end_date: '2024-12-31',
    team_members: [{ name: 'Marco Ferretti', role: 'Supervisor' }, { name: 'Paolo Conti', role: 'Installer' }],
    activity_log: [
      { date: '2024-12-31', action: 'Project completed - target achieved', user: 'Marco Ferretti' },
      { date: '2024-09-15', action: 'Phase 2 panels installed', user: 'Paolo Conti' },
      { date: '2024-06-01', action: 'Phase 1 panels operational', user: 'Paolo Conti' },
      { date: '2024-03-01', action: 'Project started', user: 'Marco Ferretti' },
    ],
    ports_involved: ['augusta'], reporting_year: 2024,
    created_at: '2024-03-01', updated_at: '2024-12-31' },
};

export default function DEASPProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'activity' | 'team'>('overview');

  const project = id ? DEMO_MAP[id] : undefined;
  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Project not found</p>
      </div>
    );
  }

  const reduction = project.baseline_emissions_tonnes - project.current_emissions_tonnes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-sm text-gray-400">{project.description}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[project.status]}`}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Baseline" value={`${formatTonnes(project.baseline_emissions_tonnes)} t`}
          subtitle="Starting emissions" icon={<Target className="w-6 h-6" />} color="amber" />
        <StatCard title="Current" value={`${formatTonnes(project.current_emissions_tonnes)} t`}
          subtitle="Latest measurement" icon={<Activity className="w-6 h-6" />} color="blue" />
        <StatCard title="Reduction" value={`${formatTonnes(reduction)} t`}
          subtitle={`${project.progress_pct.toFixed(1)}% of target`} icon={<TrendingDown className="w-6 h-6" />} color="green" />
        <StatCard title="Target" value={`${formatTonnes(project.target_reduction_tonnes || 0)} t`}
          subtitle="Reduction goal" icon={<Target className="w-6 h-6" />} color="yellow" />
      </div>

      {/* Progress Bar */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Progress Toward Target</h3>
          <span className="text-lg font-bold text-white">{project.progress_pct.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-surface-hover rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, project.progress_pct)}%`,
              background: project.progress_pct >= 100 ? '#00FF80'
                : project.progress_pct > 50 ? 'linear-gradient(90deg, #0000FF, #4040FF)' : '#FEC500',
            }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>0 tCO2e reduced</span>
          <span>{formatTonnes(project.target_reduction_tonnes || 0)} tCO2e target</span>
        </div>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-xl border border-surface-border p-4 flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-brand-yellow" />
          <div>
            <p className="text-xs text-gray-400">Timeline</p>
            <p className="text-sm text-white">{project.start_date} — {project.end_date}</p>
          </div>
        </div>
        <div className="bg-surface-card rounded-xl border border-surface-border p-4 flex items-center space-x-3">
          <UsersIcon className="w-5 h-5 text-[#6060FF]" />
          <div>
            <p className="text-xs text-gray-400">Team</p>
            <p className="text-sm text-white">{(project.team_members || []).length} members</p>
          </div>
        </div>
        <div className="bg-surface-card rounded-xl border border-surface-border p-4 flex items-center space-x-3">
          <MapPin className="w-5 h-5 text-brand-green" />
          <div>
            <p className="text-xs text-gray-400">Ports</p>
            <p className="text-sm text-white capitalize">{(project.ports_involved || []).join(', ')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-border">
        <div className="flex space-x-6">
          {(['overview', 'activity', 'team'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-blue text-white' : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)} Log
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Emissions Over Time</h3>
          <div className="flex items-end space-x-4 h-40">
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-red-500/60 rounded-t" style={{ height: `${(project.baseline_emissions_tonnes / project.baseline_emissions_tonnes) * 100}%` }} />
              <span className="text-xs text-gray-400 mt-2">Baseline</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-brand-blue/60 rounded-t" style={{ height: `${(project.current_emissions_tonnes / project.baseline_emissions_tonnes) * 100}%` }} />
              <span className="text-xs text-gray-400 mt-2">Current</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-brand-green/60 rounded-t" style={{ height: `${((project.baseline_emissions_tonnes - (project.target_reduction_tonnes || 0)) / project.baseline_emissions_tonnes) * 100}%` }} />
              <span className="text-xs text-gray-400 mt-2">Target</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Activity Log</h3>
          <div className="space-y-4">
            {(project.activity_log || []).map((entry, i) => (
              <div key={i} className="flex items-start space-x-3 pb-4 border-b border-surface-border last:border-0">
                <div className="w-2 h-2 rounded-full bg-brand-blue mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white">{entry.action}</p>
                  <p className="text-xs text-gray-400 mt-1">{entry.user} &middot; {entry.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Team Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(project.team_members || []).map((member, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 bg-surface-hover rounded-lg">
                <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center text-xs text-white font-bold">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-gray-400">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
