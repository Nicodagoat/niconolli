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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your organization, facilities, and methodology preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Organization Settings */}
      {activeTab === 'organization' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Organization Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                type="text"
                defaultValue={currentOrg?.name || 'Acme Corp'}
                className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select className="w-full rounded-lg border-gray-300 border p-2.5 text-sm" defaultValue="technology">
                <option value="manufacturing">Manufacturing</option>
                <option value="technology">Technology</option>
                <option value="retail">Retail</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance</option>
                <option value="construction">Construction</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                defaultValue={currentOrg?.country || 'USA'}
                className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Employees</label>
              <input
                type="number"
                defaultValue={currentOrg?.employee_count || 500}
                className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Revenue</label>
              <input
                type="number"
                defaultValue={currentOrg?.annual_revenue || 2000000}
                className="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Currency</label>
              <select className="w-full rounded-lg border-gray-300 border p-2.5 text-sm" defaultValue="USD">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Methodology Settings */}
      {activeTab === 'methodology' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Methodology Preferences</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organizational Boundary</label>
              <select className="w-full max-w-md rounded-lg border-gray-300 border p-2.5 text-sm">
                <option value="operational_control">Operational Control</option>
                <option value="financial_control">Financial Control</option>
                <option value="equity_share">Equity Share</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">As defined by the GHG Protocol Corporate Standard</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Global Warming Potential (GWP)</label>
              <select className="w-full max-w-md rounded-lg border-gray-300 border p-2.5 text-sm">
                <option value="ar6">IPCC AR6 (2021) - Recommended</option>
                <option value="ar5">IPCC AR5 (2014)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">100-year GWP values used for CO2-equivalent calculations</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope 2 Reporting</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Location-based method</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Market-based method</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factor Update Notifications</label>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Alert when factors change by more than</span>
                <input type="number" defaultValue={5} className="w-20 rounded-lg border-gray-300 border p-2 text-sm" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Facilities */}
      {activeTab === 'facilities' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Facilities</h3>
          <p className="text-sm text-gray-500 mb-6">Manage your organization's physical locations for accurate emissions allocation.</p>
          <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
            <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Add facilities to track location-specific emissions.</p>
            <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              Add Facility
            </button>
          </div>
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Users & Roles</h3>
          <p className="text-sm text-gray-500 mb-6">Manage team access and permissions.</p>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-3 text-sm">admin@company.com</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Admin</span></td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
