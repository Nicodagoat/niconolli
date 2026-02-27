import { NavLink } from 'react-router-dom';
import { useStore } from '../../store';
import {
  LayoutDashboard, Building2, Users, Anchor, FolderKanban,
  FileBarChart, Settings, Leaf, ChevronLeft, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sme-projects', icon: Building2, label: 'SME Projects', separator: true, group: 'SME GHG' },
  { to: '/clients', icon: Users, label: 'Port Clients', separator: true, group: 'DEASP' },
  { to: '/deasp-projects', icon: FolderKanban, label: 'DEASP Projects' },
  { to: '/deasp', icon: Anchor, label: 'DEASP Workflow' },
  { to: '/reports', icon: FileBarChart, label: 'Reports', separator: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, user } = useStore();

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 h-full bg-[#111111] text-white transition-all duration-300 z-30 flex flex-col border-r border-surface-border',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-surface-border">
        <div className="w-8 h-8 rounded-lg primary-gradient flex items-center justify-center flex-shrink-0">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <span className="ml-3 text-lg font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            GHG Platform
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          // Role-based visibility
          if (item.to === '/sme-projects' && user?.role === 'deasp_user') return null;
          if ((item.to === '/clients' || item.to === '/deasp-projects' || item.to === '/deasp') && user?.role === 'sme_user') return null;

          return (
            <div key={item.to}>
              {'separator' in item && item.separator && (
                <div className="my-2 mx-4 border-t border-surface-border">
                  {sidebarOpen && 'group' in item && item.group && (
                    <div className="pt-2 pb-1 px-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                      {item.group}
                    </div>
                  )}
                </div>
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'bg-brand-blue/20 text-[#6060FF] border-r-2 border-brand-blue'
                      : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-surface-border text-gray-400 hover:text-white"
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
    </aside>
  );
}
