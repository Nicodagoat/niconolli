import { NavLink } from 'react-router-dom';
import { useStore } from '../../store';
import {
  LayoutDashboard, ClipboardList, Database, FileBarChart,
  Settings, Leaf, ChevronLeft, ChevronRight, Anchor,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/activities', icon: ClipboardList, label: 'Activities' },
  { to: '/emission-factors', icon: Database, label: 'Emission Factors' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/deasp', icon: Anchor, label: 'DEASP Italia', separator: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 h-full bg-gray-900 text-white transition-all duration-300 z-30 flex flex-col',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-700">
        <Leaf className="w-8 h-8 text-green-400 flex-shrink-0" />
        {sidebarOpen && (
          <span className="ml-3 text-lg font-bold tracking-tight">GHG Platform</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <div key={item.to}>
            {'separator' in item && item.separator && (
              <div className="my-2 mx-4 border-t border-gray-700" />
            )}
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center px-4 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-green-600/20 text-green-400 border-r-2 border-green-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="ml-3">{item.label}</span>}
          </NavLink>
          </div>
        ))}
      </nav>

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-gray-700 text-gray-400 hover:text-white"
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
    </aside>
  );
}
