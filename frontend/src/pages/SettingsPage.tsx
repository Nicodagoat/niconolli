import { useState } from 'react';
import { Building2, MapPin, Sliders, Shield } from 'lucide-react';
import { useStore } from '../store';

export default function SettingsPage() {
  const { currentOrg } = useStore();
  const [activeTab, setActiveTab] = useState('organization');

  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'facilities', label: 'Facilities', icon: MapPin },
    { id: 'methodology', label: 'Methodology', icon: Sliders },
    { id: 'users', label: 'Users & Roles', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your organization, facilities, and methodology preferences</p>
      </div>

      <div className="border-b border-surface-border">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-blue text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}>
              <tab.icon className="w-4 h-4" /><span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'organization' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Organization Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Organization Name', type: 'text', value: currentOrg?.name || 'Acme Corp' },
              { label: 'Country', type: 'text', value: currentOrg?.country || 'ITA' },
              { label: 'Number of Employees', type: 'number', value: currentOrg?.employee_count || 500 },
              { label: 'Annual Revenue', type: 'number', value: currentOrg?.annual_revenue || 2000000 },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-gray-300 mb-1">{f.label}</label>
                <input type={f.type} defaultValue={f.value}
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Industry</label>
              <select className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" defaultValue="technology">
                <option value="manufacturing">Manufacturing</option>
                <option value="technology">Technology</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Revenue Currency</label>
              <select className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" defaultValue="EUR">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="px-6 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">Save Changes</button>
          </div>
        </div>
      )}

      {activeTab === 'methodology' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Methodology Preferences</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Organizational Boundary</label>
              <select className="w-full max-w-md rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="operational_control">Operational Control</option>
                <option value="financial_control">Financial Control</option>
                <option value="equity_share">Equity Share</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">As defined by the GHG Protocol Corporate Standard</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Global Warming Potential (GWP)</label>
              <select className="w-full max-w-md rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="ar6">IPCC AR6 (2021) - Recommended</option>
                <option value="ar5">IPCC AR5 (2014)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Factor Update Notifications</label>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">Alert when factors change by more than</span>
                <input type="number" defaultValue={5}
                  className="w-20 rounded-lg bg-brand-dark border border-surface-border p-2 text-sm text-white focus:outline-none focus:border-brand-blue" />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="px-6 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">Save Preferences</button>
          </div>
        </div>
      )}

      {activeTab === 'facilities' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Facilities</h3>
          <p className="text-sm text-gray-400 mb-6">Manage your organization's physical locations for accurate emissions allocation.</p>
          <div className="border border-dashed border-surface-border rounded-xl p-8 text-center">
            <MapPin className="w-12 h-12 mx-auto text-gray-500 mb-3" />
            <p className="text-sm text-gray-400">Add facilities to track location-specific emissions.</p>
            <button className="mt-3 px-4 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">Add Facility</button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Users & Roles</h3>
          <p className="text-sm text-gray-400 mb-6">Manage team access and permissions.</p>
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-surface-border">
                <td className="px-4 py-3 text-sm text-gray-300">admin@company.com</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-brand-blue/10 text-[#6060FF] rounded">Admin</span></td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-brand-green/10 text-brand-green rounded">Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
