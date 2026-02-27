import { User, LogOut } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleBadge: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-brand-blue/10 text-[#6060FF]' },
    sme_user: { label: 'SME', color: 'bg-brand-green/10 text-brand-green' },
    deasp_user: { label: 'DEASP', color: 'bg-brand-yellow/10 text-brand-yellow' },
    auditor: { label: 'Auditor', color: 'bg-purple-500/10 text-purple-400' },
  };

  const role = user?.role || 'admin';
  const badge = roleBadge[role] || roleBadge.admin;

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            GHG Emissions Platform
          </h2>
          <p className="text-sm text-gray-400">
            Environmental Management Console
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Notification Bell */}
        <NotificationDropdown />

        {/* User */}
        <div className="flex items-center space-x-3 pl-4 border-l border-surface-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-medium text-gray-300">{user?.full_name || 'Admin'}</div>
              <div className="flex items-center space-x-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-surface-hover transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
