import { useState, useEffect } from 'react';
import { Search, Database, RefreshCw, Plus, History } from 'lucide-react';
import { factorAPI } from '../services/api';
import type { EmissionFactor } from '../types';

// Demo emission factors
const DEMO_FACTORS: EmissionFactor[] = [
  { id: '1', source: 'epa', category: 'stationary_combustion', name: 'Natural Gas', co2_factor: 53.06, ch4_factor: 0.001, n2o_factor: 0.0001, co2e_factor: 53.11, input_unit: 'mmbtu', output_unit: 'kg_co2e', region: 'US', year: 2024, gwp_version: 'ar6', fuel_type: 'natural_gas', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '2', source: 'epa', category: 'mobile_combustion', name: 'Gasoline - Passenger Cars', co2_factor: 8.78, ch4_factor: 0, n2o_factor: 0, co2e_factor: 8.78, input_unit: 'gallons_us', output_unit: 'kg_co2e', region: 'US', year: 2024, gwp_version: 'ar6', fuel_type: 'gasoline', vehicle_type: 'passenger_car', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '3', source: 'egrid', category: 'electricity', name: 'US National Average Grid', co2_factor: 0.3716, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.3716, input_unit: 'kwh', output_unit: 'kg_co2e', region: 'US', year: 2024, gwp_version: 'ar6', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '4', source: 'defra', category: 'electricity', name: 'UK National Grid', co2_factor: 0.20705, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.20705, input_unit: 'kwh', output_unit: 'kg_co2e', region: 'GB', year: 2024, gwp_version: 'ar6', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '5', source: 'defra', category: 'transport_passenger', name: 'Short-haul Flight (Economy)', co2_factor: 0.15102, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.15102, input_unit: 'passenger_km', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', fuel_type: 'flight_short_economy', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '6', source: 'defra', category: 'transport_passenger', name: 'Long-haul Flight (Economy)', co2_factor: 0.14615, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.14615, input_unit: 'passenger_km', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', fuel_type: 'flight_long_economy', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '7', source: 'epa', category: 'fugitive', name: 'R-410A Refrigerant', co2_factor: 0, ch4_factor: 0, n2o_factor: 0, co2e_factor: 2088, input_unit: 'kg', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', fuel_type: 'r410a', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '8', source: 'defra', category: 'waste', name: 'Landfill - Mixed Municipal Waste', co2_factor: 0, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.58693, input_unit: 'tonnes', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '9', source: 'defra', category: 'transport_freight', name: 'Road Freight (Average HGV)', co2_factor: 0.10448, ch4_factor: 0, n2o_factor: 0, co2e_factor: 0.10448, input_unit: 'tonne_km', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', fuel_type: 'road_freight_hgv', is_active: true, is_custom: false, created_at: '', updated_at: '' },
  { id: '10', source: 'defra', category: 'hotel_stays', name: 'Hotel Stay (Average)', co2_factor: 14.68, ch4_factor: 0, n2o_factor: 0, co2e_factor: 14.68, input_unit: 'nights', output_unit: 'kg_co2e', region: 'GLOBAL', year: 2024, gwp_version: 'ar6', fuel_type: 'hotel_average', is_active: true, is_custom: false, created_at: '', updated_at: '' },
];

export default function EmissionFactorsPage() {
  const [factors, setFactors] = useState<EmissionFactor[]>(DEMO_FACTORS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (searchTerm) params.search = searchTerm;
      if (filterCategory) params.category = filterCategory;
      if (filterSource) params.source = filterSource;
      const res = await factorAPI.list(params);
      if (res.data.length > 0) setFactors(res.data);
    } catch {
      // Keep demo data
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await factorAPI.seedDefaults();
      alert(`Loaded ${res.data.seeded} default emission factors`);
      loadFactors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  const filtered = factors.filter((f) => {
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    if (filterSource && f.source !== filterSource) return false;
    return true;
  });

  const categories = [...new Set(factors.map((f) => f.category))].sort();
  const sources = [...new Set(factors.map((f) => f.source))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emission Factors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage conversion factors from EPA, DEFRA, IEA, and custom sources
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="flex items-center space-x-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            <span>{seeding ? 'Loading...' : 'Load Defaults'}</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" />
            <span>Custom Factor</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center flex-1 space-x-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search factors..."
            className="flex-1 text-sm border-0 focus:ring-0 outline-none"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Factors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CO2e Factor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Input Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GWP</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((factor) => (
              <tr key={factor.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{factor.name}</div>
                  {factor.fuel_type && (
                    <div className="text-xs text-gray-500">{factor.fuel_type.replace(/_/g, ' ')}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{factor.category.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {factor.source.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono font-medium">
                  {factor.co2e_factor}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{factor.input_unit.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{factor.region || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{factor.year}</td>
                <td className="px-4 py-3 text-sm text-gray-500 uppercase">{factor.gwp_version}</td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1 text-gray-400 hover:text-blue-600" title="View history">
                    <History className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Showing {filtered.length} of {factors.length} emission factors
        </div>
      </div>
    </div>
  );
}
