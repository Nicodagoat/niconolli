import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, Folder, Calculator, AlertTriangle, UserPlus, Settings, FileText } from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useStore } from '../../store';

interface Notification {
  id: string;
  notification_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  module?: string;
  action_url?: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  project_created: <Folder className="w-4 h-4" />,
  project_assigned: <Folder className="w-4 h-4" />,
  calculation_completed: <Calculator className="w-4 h-4" />,
  calculation_error: <AlertTriangle className="w-4 h-4" />,
  data_validation_error: <AlertTriangle className="w-4 h-4" />,
  review_required: <FileText className="w-4 h-4" />,
  questionnaire_received: <FileText className="w-4 h-4" />,
  factor_updated: <Settings className="w-4 h-4" />,
  user_invited: <UserPlus className="w-4 h-4" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-brand-blue bg-brand-blue/10',
  warning: 'text-brand-yellow bg-brand-yellow/10',
  error: 'text-red-400 bg-red-400/10',
  success: 'text-brand-green bg-brand-green/10',
};

// Demo notifications when no backend
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: '1', notification_type: 'project_created', severity: 'success',
    title: 'New SME Project Created', message: 'Acme Corp - 2025 GHG Inventory has been created.',
    is_read: false, module: 'sme', created_at: new Date().toISOString(),
  },
  {
    id: '2', notification_type: 'calculation_completed', severity: 'info',
    title: 'Calculations Complete', message: 'DEASP Augusta 2024 ship emissions calculated: 29,500 tCO2.',
    is_read: false, module: 'deasp', created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3', notification_type: 'factor_updated', severity: 'warning',
    title: 'ISPRA Factor Updated', message: 'Electricity emission factor updated: 0.00028 → 0.00026 tCO2/kWh (-7.1%).',
    is_read: false, module: 'deasp', created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '4', notification_type: 'questionnaire_received', severity: 'success',
    title: 'Questionnaire Completed', message: 'Terminal Container Augusta S.r.l. has submitted their questionnaire.',
    is_read: true, module: 'deasp', created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length);
  }, [notifications]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.list();
      if (res.data && res.data.length > 0) {
        setNotifications(res.data);
      }
    } catch {
      // Keep demo data
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationAPI.markRead(id);
    } catch { /* ignore */ }
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-brand-yellow rounded-lg hover:bg-surface-hover transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center space-x-1 text-xs text-brand-blue hover:text-brand-blue/80"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start space-x-3 p-4 border-b border-surface-border hover:bg-surface-hover transition-colors cursor-pointer ${
                    !notif.is_read ? 'bg-brand-blue/5' : ''
                  }`}
                  onClick={() => markRead(notif.id)}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${SEVERITY_COLORS[notif.severity] || SEVERITY_COLORS.info}`}>
                    {TYPE_ICONS[notif.notification_type] || <Bell className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-gray-400' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-brand-blue rounded-full flex-shrink-0 mt-1.5 ml-2" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] text-gray-600">{timeAgo(notif.created_at)}</span>
                      {notif.module && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          notif.module === 'sme' ? 'bg-brand-green/10 text-brand-green' :
                          notif.module === 'deasp' ? 'bg-brand-blue/10 text-brand-blue' :
                          'bg-gray-500/10 text-gray-500'
                        }`}>
                          {notif.module.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-surface-border">
            <button
              onClick={() => { setOpen(false); navigate('/dashboard'); }}
              className="w-full text-center text-xs text-brand-blue hover:text-brand-blue/80 py-1"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
