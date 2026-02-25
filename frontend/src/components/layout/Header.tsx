import { useStore } from '../../store';
import { Bell, User } from 'lucide-react';

export default function Header() {
  const currentOrg = useStore((s) => s.currentOrg);
  const currentInventory = useStore((s) => s.currentInventory);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {currentOrg?.name || 'GHG Emissions Platform'}
          </h2>
          {currentInventory && (
            <p className="text-sm text-gray-500">
              Inventory: {currentInventory.name} ({currentInventory.reporting_year})
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <User className="w-4 h-4 text-green-600" />
          </div>
          <span className="text-sm font-medium text-gray-700">Admin</span>
        </div>
      </div>
    </header>
  );
}
