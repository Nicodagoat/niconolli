import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, ChevronRight, BarChart3,
  Flame, Zap, Link2, CheckCircle, Clock, FileEdit, Send,
} from 'lucide-react';
import { formatTonnes } from '../utils/formatters';

type ProjectStatus = 'draft' | 'data_collection' | 'calculation' | 'review' | 'finalized';

interface SMEProject {
  id: string;
  project_id: string; // SME-YYYY-XXXXX format
  company_name: string;
  industry: string;
  reporting_year: number;
  status: ProjectStatus;
  scope1_tonnes: number;
  scope2_tonnes: number;
  scope3_tonnes: number;
  total_co2e_tonnes: number;
  completeness_pct: number;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: <FileEdit className="w-3 h-3" /> },
  data_collection: { label: 'Data Collection', color: 'bg-brand-yellow/20 text-brand-yellow', icon: <Clock className="w-3 h-3" /> },
  calculation: { label: 'Calculation', color: 'bg-brand-blue/20 text-[#6060FF]', icon: <BarChart3 className="w-3 h-3" /> },
  review: { label: 'Review', color: 'bg-purple-500/20 text-purple-400', icon: <Send className="w-3 h-3" /> },
  finalized: { label: 'Finalized', color: 'bg-brand-green/20 text-brand-green', icon: <CheckCircle className="w-3 h-3" /> },
};

const DEMO_PROJECTS: SMEProject[] = [
  {
    id: '1', project_id: 'SME-2025-00001', company_name: 'TechnoVerde S.r.l.',
    industry: 'Technology', reporting_year: 2025, status: 'data_collection',
    scope1_tonnes: 120.5, scope2_tonnes: 340.2, scope3_tonnes: 890.7,
    total_co2e_tonnes: 1351.4, completeness_pct: 65,
    created_at: '2025-01-15', updated_at: '2025-02-20',
  },
  {
    id: '2', project_id: 'SME-2025-00002', company_name: 'Manifattura Sicilia S.p.A.',
    industry: 'Manufacturing', reporting_year: 2025, status: 'calculation',
    scope1_tonnes: 890.0, scope2_tonnes: 550.0, scope3_tonnes: 2100.0,
    total_co2e_tonnes: 3540.0, completeness_pct: 92,
    created_at: '2025-02-01', updated_at: '2025-02-25',
  },
  {
    id: '3', project_id: 'SME-2024-00003', company_name: 'Green Logistics Italia',
    industry: 'Transportation', reporting_year: 2024, status: 'finalized',
    scope1_tonnes: 2200.0, scope2_tonnes: 450.0, scope3_tonnes: 3800.0,
    total_co2e_tonnes: 6450.0, completeness_pct: 100,
    created_at: '2024-06-10', updated_at: '2024-12-15',
  },
];

export default function SMEProjectsPage() {
  const navigate = useNavigate();
  const [projects] = useState<SMEProject[]>(DEMO_PROJECTS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({
    company_name: '', industry: 'technology', reporting_year: 2025, base_year: '',
  });

  const filtered = projects.filter((p) => {
    const matchSearch = p.company_name.toLowerCase().includes(search.toLowerCase()) ||
      p.project_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleCreateProject = () => {
    // In a real app, this would call the API
    setShowModal(false);
    navigate('/sme-projects/new');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SME GHG Projects</h1>
          <p className="text-sm text-gray-400 mt-1">
            Scope 1, 2, 3 emissions inventory for SMEs - ISO 14064-1 compliant
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg hover:opacity-90 text-sm"
        >
          <Plus className="w-4 h-4" /><span>New SME Project</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by company or project ID..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-sm text-gray-300 focus:outline-none focus:border-brand-blue">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="data_collection">Data Collection</option>
          <option value="calculation">Calculation</option>
          <option value="review">Review</option>
          <option value="finalized">Finalized</option>
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((project) => {
          const statusCfg = STATUS_CONFIG[project.status];
          return (
            <div key={project.id} onClick={() => navigate(`/sme-projects/${project.id}`)}
              className="bg-surface-card rounded-xl border border-surface-border p-5 hover:border-brand-green/40 cursor-pointer transition-all group">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-brand-green" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{project.company_name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{project.project_id}</p>
                  </div>
                </div>
                <span className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusCfg.color}`}>
                  {statusCfg.icon}
                  <span>{statusCfg.label}</span>
                </span>
              </div>

              {/* Scope Breakdown */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1 text-gray-400">
                    <Flame className="w-3 h-3 text-brand-green" /><span>Scope 1</span>
                  </span>
                  <span className="text-brand-green font-medium">{formatTonnes(project.scope1_tonnes)} t</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1 text-gray-400">
                    <Zap className="w-3 h-3 text-brand-blue" /><span>Scope 2</span>
                  </span>
                  <span className="text-[#6060FF] font-medium">{formatTonnes(project.scope2_tonnes)} t</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1 text-gray-400">
                    <Link2 className="w-3 h-3 text-brand-yellow" /><span>Scope 3</span>
                  </span>
                  <span className="text-brand-yellow font-medium">{formatTonnes(project.scope3_tonnes)} t</span>
                </div>
              </div>

              {/* Completeness */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Completeness</span>
                  <span className="text-white font-medium">{project.completeness_pct}%</span>
                </div>
                <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${project.completeness_pct}%`,
                      background: project.completeness_pct >= 100 ? '#00FF80'
                        : project.completeness_pct > 70 ? 'linear-gradient(90deg, #0000FF, #4040FF)' : '#FEC500',
                    }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                <span className="text-sm font-bold text-white">{formatTonnes(project.total_co2e_tonnes)} tCO2e</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">{project.reporting_year}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-brand-green transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Create New SME Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                <input type="text" value={newProject.company_name}
                  onChange={(e) => setNewProject({ ...newProject, company_name: e.target.value })}
                  placeholder="e.g., Acme Corporation S.r.l."
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Industry Sector *</label>
                  <select value={newProject.industry}
                    onChange={(e) => setNewProject({ ...newProject, industry: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="technology">Technology</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="transportation">Transportation</option>
                    <option value="services">Services</option>
                    <option value="construction">Construction</option>
                    <option value="agriculture">Agriculture</option>
                    <option value="energy">Energy</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Reporting Year *</label>
                  <input type="number" value={newProject.reporting_year}
                    onChange={(e) => setNewProject({ ...newProject, reporting_year: parseInt(e.target.value) })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Base Year (optional)</label>
                <input type="number" value={newProject.base_year}
                  onChange={(e) => setNewProject({ ...newProject, base_year: e.target.value })}
                  placeholder="e.g., 2020"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <p className="text-xs text-gray-500">
                Project ID will be auto-generated: SME-{newProject.reporting_year}-XXXXX
              </p>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={handleCreateProject}
                disabled={!newProject.company_name}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
