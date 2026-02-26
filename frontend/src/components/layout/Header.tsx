import { Bell, User } from 'lucide-react';

export default function Header() {
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
        <button className="relative p-2 text-gray-400 hover:text-brand-yellow rounded-lg hover:bg-surface-hover transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-brand-yellow rounded-full"></span>
        </button>
        <div className="flex items-center space-x-2 pl-4 border-l border-surface-border">
          <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-300">Admin</span>
        </div>
      </div>
    </header>
  );
}
