import { useState, useEffect } from 'react';
import { Plus, Upload, Download, Trash2, Edit, Filter } from 'lucide-react';
import ActivityForm from '../components/forms/ActivityForm';
import CSVUpload from '../components/forms/CSVUpload';
import { activityAPI } from '../services/api';
import { scopeLabel, categoryLabel } from '../utils/formatters';
import type { Activity, ActivityCreate, Scope } from '../types';
import { useStore } from '../store';

export default function ActivitiesPage() {
  const currentInventory = useStore((s) => s.currentInventory);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [filterScope, setFilterScope] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const inventoryId = currentInventory?.id || 'demo';

  useEffect(() => {
    if (currentInventory) loadActivities();
  }, [currentInventory, filterScope]);

  const loadActivities = async () => {
    if (!currentInventory) return;
    setLoading(true);
    try {
      const res = await activityAPI.list(currentInventory.id, filterScope || undefined);
      setActivities(res.data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: ActivityCreate) => {
    if (!currentInventory) return;
    try {
      await activityAPI.create(currentInventory.id, data);
      setShowForm(false);
      loadActivities();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create activity');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this activity?')) return;
    try {
      await activityAPI.delete(id);
      loadActivities();
    } catch {
      alert('Failed to delete activity');
    }
  };

  const handleCSVUpload = async (file: File) => {
    if (!currentInventory) return;
    await activityAPI.uploadCSV(currentInventory.id, file);
    loadActivities();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await activityAPI.getTemplate();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download template');
    }
  };

  // Demo data
  const demoActivities: Activity[] = [
    { id: '1', inventory_id: 'demo', scope: 'scope_1', category: 'stationary_combustion', activity_value: 5000, activity_unit: 'therms', fuel_type: 'natural_gas', activity_date: '2024-01-15', data_quality: 'high', is_biogenic: false, created_at: '2024-01-15', description: 'Office heating Q1' },
    { id: '2', inventory_id: 'demo', scope: 'scope_1', category: 'mobile_combustion', activity_value: 12000, activity_unit: 'gallons_us', fuel_type: 'gasoline', activity_date: '2024-03-31', data_quality: 'high', is_biogenic: false, created_at: '2024-03-31', description: 'Fleet vehicles Q1' },
    { id: '3', inventory_id: 'demo', scope: 'scope_2', category: 'electricity', activity_value: 450000, activity_unit: 'kwh', activity_date: '2024-06-30', data_quality: 'high', is_biogenic: false, created_at: '2024-06-30', description: 'Annual electricity - HQ', scope2_method: 'location_based' },
    { id: '4', inventory_id: 'demo', scope: 'scope_3', category: 'cat_6_business_travel', activity_value: 280000, activity_unit: 'passenger_km', fuel_type: 'flight_long_economy', activity_date: '2024-12-31', data_quality: 'medium', is_biogenic: false, created_at: '2024-12-31', description: 'Employee flights 2024' },
    { id: '5', inventory_id: 'demo', scope: 'scope_3', category: 'cat_5_waste_operations', activity_value: 45, activity_unit: 'tonnes', activity_date: '2024-12-31', data_quality: 'medium', is_biogenic: false, created_at: '2024-12-31', description: 'Annual office waste - landfill' },
    { id: '6', inventory_id: 'demo', scope: 'scope_3', category: 'cat_7_employee_commuting', activity_value: 500000, activity_unit: 'km', fuel_type: 'car_commuting', activity_date: '2024-12-31', data_quality: 'low', is_biogenic: false, created_at: '2024-12-31', description: 'Employee commuting estimate' },
  ] as Activity[];

  const displayActivities = currentInventory ? activities : demoActivities;
  const filteredActivities = filterScope
    ? displayActivities.filter((a) => a.scope === filterScope)
    : displayActivities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Data</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage emission source activities {!currentInventory && '(Demo Data)'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center space-x-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            <span>Upload CSV</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* CSV Upload */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Bulk Upload Activities</h3>
          <CSVUpload onUpload={handleCSVUpload} onDownloadTemplate={handleDownloadTemplate} />
        </div>
      )}

      {/* Activity Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Activity</h3>
          <ActivityForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="">All Scopes</option>
          <option value="scope_1">Scope 1</option>
          <option value="scope_2">Scope 2</option>
          <option value="scope_3">Scope 3</option>
        </select>
        <span className="text-sm text-gray-500">{filteredActivities.length} activities</span>
      </div>

      {/* Activities Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredActivities.map((activity) => (
              <tr key={activity.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    activity.scope === 'scope_1' ? 'bg-red-100 text-red-700' :
                    activity.scope === 'scope_2' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {activity.scope.replace('_', ' ').replace('scope', 'S')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{categoryLabel(activity.category)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{activity.description || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                  {activity.activity_value.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{activity.activity_unit.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{activity.fuel_type || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    activity.data_quality === 'high' ? 'bg-green-100 text-green-700' :
                    activity.data_quality === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {activity.data_quality}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{activity.activity_date}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <button className="p-1 text-gray-400 hover:text-blue-600">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(activity.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredActivities.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No activities found. Add your first activity to get started.
          </div>
        )}
      </div>
    </div>
  );
}
