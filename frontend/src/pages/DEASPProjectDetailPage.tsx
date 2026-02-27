import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Target, TrendingDown, Calendar, Users as UsersIcon,
  Activity, MapPin, Play,
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

function loadProject(id: string): DEASPProject | null {
  try {
    const saved = localStorage.getItem('deasp_projects');
    if (saved) {
      const projects: DEASPProject[] = JSON.parse(saved);
      return projects.find(p => p.id === id) || null;
    }
  } catch { /* ignore */ }
  return null;
}

export default function DEASPProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'activity' | 'team'>('overview');
  const [project, setProject] = useState<DEASPProject | null>(null);

  useEffect(() => {
    if (id) {
      const p = loadProject(id);
      setProject(p);
    }
  }, [id]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-400 mb-3">Project not found</p>
          <button onClick={() => navigate('/deasp-projects')}
            className="text-sm text-brand-blue underline">Back to Projects</button>
        </div>
      </div>
    );
  }

  const reduction = project.baseline_emissions_tonnes - project.current_emissions_tonnes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/deasp-projects')} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-hover">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-sm text-gray-400">{project.description || 'No description'}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[project.status] || STATUS_COLORS.planning}`}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Baseline" value={`${formatTonnes(project.baseline_emissions_tonnes)} t`}
          subtitle="Starting emissions" icon={<Target className="w-6 h-6" />} color="amber" />
        <StatCard title="Current" value={`${formatTonnes(project.current_emissions_tonnes)} t`}
          subtitle="Latest measurement" icon={<Activity className="w-6 h-6" />} color="blue" />
        <StatCard title="Reduction" value={`${formatTonnes(Math.max(0, reduction))} t`}
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
            <p className="text-sm text-white">{project.start_date || 'TBD'} — {project.end_date || 'TBD'}</p>
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
            <p className="text-sm text-white capitalize">{(project.ports_involved || []).join(', ') || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-surface-card rounded-xl border border-surface-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Run Emissions Analysis</h3>
            <p className="text-xs text-gray-400 mt-1">Import ship data, add concessionaire info, and calculate port emissions</p>
          </div>
          <button onClick={() => navigate('/deasp')}
            className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">
            <Play className="w-4 h-4" /><span>Start Workflow</span>
          </button>
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
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'overview' ? '' : 'Log'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Emissions Overview</h3>
          {project.baseline_emissions_tonnes > 0 ? (
            <div className="flex items-end space-x-4 h-40">
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-red-500/60 rounded-t" style={{ height: '100%' }} />
                <span className="text-xs text-gray-400 mt-2">Baseline</span>
                <span className="text-xs text-white font-mono">{formatTonnes(project.baseline_emissions_tonnes)}</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-brand-blue/60 rounded-t" style={{ height: `${(project.current_emissions_tonnes / project.baseline_emissions_tonnes) * 100}%` }} />
                <span className="text-xs text-gray-400 mt-2">Current</span>
                <span className="text-xs text-white font-mono">{formatTonnes(project.current_emissions_tonnes)}</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-brand-green/60 rounded-t" style={{ height: `${((project.baseline_emissions_tonnes - (project.target_reduction_tonnes || 0)) / project.baseline_emissions_tonnes) * 100}%` }} />
                <span className="text-xs text-gray-400 mt-2">Target</span>
                <span className="text-xs text-white font-mono">{formatTonnes(project.baseline_emissions_tonnes - (project.target_reduction_tonnes || 0))}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No emissions data yet. Run the DEASP workflow to calculate emissions.</p>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Activity Log</h3>
          {(project.activity_log || []).length > 0 ? (
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
          ) : (
            <p className="text-sm text-gray-400">No activity recorded yet.</p>
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Team Members</h3>
          {(project.team_members || []).length > 0 ? (
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
          ) : (
            <p className="text-sm text-gray-400">No team members assigned.</p>
          )}
        </div>
      )}
    </div>
  );
}
