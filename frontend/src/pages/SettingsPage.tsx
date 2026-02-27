import { useState, useEffect } from 'react';
import { Building2, MapPin, Sliders, Shield, UserPlus, Copy, Check, RefreshCw, Plus, CheckCircle } from 'lucide-react';
import { useStore } from '../store';
import { userAPI } from '../services/api';

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login?: string;
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-brand-blue/10 text-[#6060FF]' },
  sme_user: { label: 'SME User', color: 'bg-brand-green/10 text-brand-green' },
  deasp_user: { label: 'DEASP User', color: 'bg-brand-yellow/10 text-brand-yellow' },
  auditor: { label: 'Auditor', color: 'bg-purple-500/10 text-purple-400' },
};

export default function SettingsPage() {
  const { currentOrg, user } = useStore();
  const [activeTab, setActiveTab] = useState('organization');
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'sme_user' });
  const [inviteResult, setInviteResult] = useState<{ password?: string; email?: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ password?: string; email?: string } | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'facilities', label: 'Facilities', icon: MapPin },
    { id: 'methodology', label: 'Methodology', icon: Sliders },
    { id: 'users', label: 'Users & Credentials', icon: Shield },
  ];

  const isAdmin = user?.role === 'admin';
  const [orgSaved, setOrgSaved] = useState(false);
  const [methSaved, setMethSaved] = useState(false);
  const [orgSettings, setOrgSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('org_settings');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      name: currentOrg?.name || 'My Organization',
      country: currentOrg?.country || 'ITA',
      employees: currentOrg?.employee_count || 500,
      revenue: currentOrg?.annual_revenue || 2000000,
      industry: 'technology',
      currency: 'EUR',
    };
  });
  const [methSettings, setMethSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('meth_settings');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { boundary: 'operational_control', gwp: 'ar6', threshold: 5 };
  });
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; address: string; type: string }>>(() => {
    try {
      const saved = localStorage.getItem('facilities');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [newFacility, setNewFacility] = useState({ name: '', address: '', type: 'office' });

  const handleSaveOrg = () => {
    localStorage.setItem('org_settings', JSON.stringify(orgSettings));
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2000);
  };

  const handleSaveMeth = () => {
    localStorage.setItem('meth_settings', JSON.stringify(methSettings));
    setMethSaved(true);
    setTimeout(() => setMethSaved(false), 2000);
  };

  const handleAddFacility = () => {
    if (!newFacility.name.trim()) return;
    const updated = [...facilities, { id: `fac_${Date.now()}`, ...newFacility }];
    setFacilities(updated);
    localStorage.setItem('facilities', JSON.stringify(updated));
    setShowFacilityModal(false);
    setNewFacility({ name: '', address: '', type: 'office' });
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const res = await userAPI.list();
      setUsers(res.data);
    } catch {
      setUsers([
        { id: '1', email: 'admin@ghgplatform.local', full_name: 'Platform Administrator',
          role: 'admin', is_active: true, must_change_password: false, created_at: '2025-01-01' },
      ]);
    }
  };

  const handleInvite = async () => {
    try {
      const res = await userAPI.invite(inviteForm);
      setInviteResult({ password: res.data.temporary_password, email: inviteForm.email });
      setInviteForm({ email: '', full_name: '', role: 'sme_user' });
      setShowInvite(false);
      loadUsers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to invite user');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    try {
      const res = await userAPI.resetPassword(userId);
      setResetResult({ password: res.data.temporary_password, email });
    } catch {
      alert('Failed to reset password');
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await userAPI.update(userId, { is_active: !currentActive });
      loadUsers();
    } catch {
      alert('Failed to update user');
    }
  };

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw);
    setCopiedPw(true);
    setTimeout(() => setCopiedPw(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage organization, methodology, and user access</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Organization Name</label>
              <input type="text" value={orgSettings.name} onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
              <input type="text" value={orgSettings.country} onChange={(e) => setOrgSettings({ ...orgSettings, country: e.target.value })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Number of Employees</label>
              <input type="number" value={orgSettings.employees} onChange={(e) => setOrgSettings({ ...orgSettings, employees: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Annual Revenue</label>
              <input type="number" value={orgSettings.revenue} onChange={(e) => setOrgSettings({ ...orgSettings, revenue: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Industry</label>
              <select value={orgSettings.industry} onChange={(e) => setOrgSettings({ ...orgSettings, industry: e.target.value })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="manufacturing">Manufacturing</option>
                <option value="technology">Technology</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Revenue Currency</label>
              <select value={orgSettings.currency} onChange={(e) => setOrgSettings({ ...orgSettings, currency: e.target.value })}
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleSaveOrg} className="flex items-center space-x-2 px-6 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">
              {orgSaved ? <><CheckCircle className="w-4 h-4" /><span>Saved!</span></> : <span>Save Changes</span>}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'methodology' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Methodology Preferences</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Organizational Boundary</label>
              <select value={methSettings.boundary} onChange={(e) => setMethSettings({ ...methSettings, boundary: e.target.value })}
                className="w-full max-w-md rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="operational_control">Operational Control</option>
                <option value="financial_control">Financial Control</option>
                <option value="equity_share">Equity Share</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">As defined by the GHG Protocol Corporate Standard</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Global Warming Potential (GWP)</label>
              <select value={methSettings.gwp} onChange={(e) => setMethSettings({ ...methSettings, gwp: e.target.value })}
                className="w-full max-w-md rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                <option value="ar6">IPCC AR6 (2021) - Recommended</option>
                <option value="ar5">IPCC AR5 (2014)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Factor Update Notifications</label>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">Alert when factors change by more than</span>
                <input type="number" value={methSettings.threshold}
                  onChange={(e) => setMethSettings({ ...methSettings, threshold: parseInt(e.target.value) || 0 })}
                  className="w-20 rounded-lg bg-brand-dark border border-surface-border p-2 text-sm text-white focus:outline-none focus:border-brand-blue" />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleSaveMeth} className="flex items-center space-x-2 px-6 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">
              {methSaved ? <><CheckCircle className="w-4 h-4" /><span>Saved!</span></> : <span>Save Preferences</span>}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'facilities' && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Facilities</h3>
              <p className="text-sm text-gray-400">Manage your organization's physical locations.</p>
            </div>
            <button onClick={() => setShowFacilityModal(true)}
              className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">
              <Plus className="w-4 h-4" /><span>Add Facility</span>
            </button>
          </div>
          {facilities.length > 0 ? (
            <div className="space-y-3">
              {facilities.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-brand-blue" />
                    <div>
                      <p className="text-sm font-medium text-white">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.address} - {f.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-surface-border rounded-xl p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-sm text-gray-400">No facilities added yet. Add your first facility.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Facility Modal */}
      {showFacilityModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add Facility</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Facility Name *</label>
                <input type="text" value={newFacility.name} onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })}
                  placeholder="e.g., Main Office"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input type="text" value={newFacility.address} onChange={(e) => setNewFacility({ ...newFacility, address: e.target.value })}
                  placeholder="e.g., Via Roma 1, Milano"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <select value={newFacility.type} onChange={(e) => setNewFacility({ ...newFacility, type: e.target.value })}
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                  <option value="office">Office</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="factory">Factory</option>
                  <option value="port">Port Terminal</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowFacilityModal(false)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Cancel</button>
              <button onClick={handleAddFacility} disabled={!newFacility.name.trim()}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Add Facility</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Users & Credentials</h3>
              <p className="text-sm text-gray-400">Manage platform access by inviting users with email-based credentials</p>
            </div>
            {isAdmin && (
              <button onClick={() => setShowInvite(true)}
                className="flex items-center space-x-2 px-4 py-2 primary-gradient text-white rounded-lg text-sm hover:opacity-90">
                <UserPlus className="w-4 h-4" /><span>Invite User</span>
              </button>
            )}
          </div>

          {inviteResult && (
            <div className="p-4 bg-brand-green/10 border border-brand-green/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-green">User invited successfully!</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Email: <span className="text-white">{inviteResult.email}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Temporary password: <span className="text-white font-mono">{inviteResult.password}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Share this password securely. The user must change it on first login.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => copyPassword(inviteResult.password!)}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs border border-surface-border rounded-lg hover:bg-surface-hover text-gray-300">
                    {copiedPw ? <Check className="w-3 h-3 text-brand-green" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPw ? 'Copied!' : 'Copy Password'}</span>
                  </button>
                  <button onClick={() => setInviteResult(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          {resetResult && (
            <div className="p-4 bg-brand-yellow/10 border border-brand-yellow/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-yellow">Password reset successfully!</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Email: <span className="text-white">{resetResult.email}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    New temporary password: <span className="text-white font-mono">{resetResult.password}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Share this password securely. The user must change it on next login.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => copyPassword(resetResult.password!)}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs border border-surface-border rounded-lg hover:bg-surface-hover text-gray-300">
                    {copiedPw ? <Check className="w-3 h-3 text-brand-green" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPw ? 'Copied!' : 'Copy Password'}</span>
                  </button>
                  <button onClick={() => setResetResult(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Last Login</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {users.map((u) => {
                  const badge = ROLE_BADGES[u.role] || ROLE_BADGES.admin;
                  return (
                    <tr key={u.id} className="hover:bg-surface-hover/50">
                      <td className="px-4 py-3">
                        <div className="text-sm text-white">{u.full_name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          u.is_active ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {u.must_change_password && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-brand-yellow/10 text-brand-yellow rounded">
                            PW change required
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleResetPassword(u.id, u.email)}
                              className="text-xs text-gray-400 hover:text-brand-yellow flex items-center space-x-1">
                              <RefreshCw className="w-3 h-3" /><span>Reset PW</span>
                            </button>
                            <button onClick={() => handleToggleActive(u.id, u.is_active)}
                              className={`text-xs ${u.is_active ? 'text-red-400 hover:text-red-300' : 'text-brand-green hover:text-brand-green/80'}`}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showInvite && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-md p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-brand-blue" />
                  <span>Invite New User</span>
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Address *</label>
                    <input type="email" value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="user@company.com"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                    <input type="text" value={inviteForm.full_name}
                      onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                      placeholder="First Last"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Role *</label>
                    <select value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                      <option value="sme_user">SME User - Full access to SME projects</option>
                      <option value="deasp_user">DEASP User - Full access to port authority projects</option>
                      <option value="admin">Admin - Full platform access</option>
                      <option value="auditor">Auditor - Read-only access to all projects</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500">
                    A temporary password will be generated. Share it securely with the user.
                    They will be required to change it on first login.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button onClick={() => setShowInvite(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">
                    Cancel
                  </button>
                  <button onClick={handleInvite}
                    disabled={!inviteForm.email || !inviteForm.full_name}
                    className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                    Send Invitation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
