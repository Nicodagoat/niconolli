import { useState, useEffect } from 'react';
import { Flame, Zap, Globe, BarChart3, Users, DollarSign, Calculator } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import ScopePieChart from '../components/dashboard/ScopePieChart';
import TrendChart from '../components/dashboard/TrendChart';
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown';
import DataQualityChart from '../components/dashboard/DataQualityChart';
import SankeyDiagram from '../components/dashboard/SankeyDiagram';
import { calculationAPI } from '../services/api';
import { formatTonnes } from '../utils/formatters';
import { useStore } from '../store';
import type { InventorySummary, EmissionsTrend, ScopeBreakdown } from '../types';

// Demo data for display when no real data is loaded
const DEMO_SUMMARY: InventorySummary = {
  inventory_id: 'demo',
  reporting_year: 2024,
  total_co2e_tonnes: 4825.7,
  scope_1_tonnes: 1250.3,
  scope_2_tonnes: 890.4,
  scope_3_tonnes: 2685.0,
  scope_1_categories: {
    stationary_combustion: 720.5,
    mobile_combustion: 380.2,
    fugitive_emissions: 149.6,
  },
  scope_2_categories: {
    electricity: 810.4,
    heat_steam: 80.0,
  },
  scope_3_categories: {
    cat_6_business_travel: 620.3,
    cat_1_purchased_goods_services: 1180.5,
    cat_7_employee_commuting: 340.2,
    cat_5_waste_operations: 280.0,
    cat_4_upstream_transportation: 264.0,
  },
  intensity_per_employee: 9.65,
  intensity_per_revenue: 2.41,
  data_quality_breakdown: { high: 45, medium: 85, low: 20, default: 10 },
  activity_count: 160,
};

const DEMO_TRENDS: EmissionsTrend[] = [
  { period: '2024-01', scope_1: 105.2, scope_2: 78.3, scope_3: 220.1, total: 403.6 },
  { period: '2024-02', scope_1: 98.4, scope_2: 72.1, scope_3: 215.8, total: 386.3 },
  { period: '2024-03', scope_1: 112.7, scope_2: 82.5, scope_3: 240.3, total: 435.5 },
  { period: '2024-04', scope_1: 95.1, scope_2: 68.9, scope_3: 198.4, total: 362.4 },
  { period: '2024-05', scope_1: 101.3, scope_2: 74.2, scope_3: 225.7, total: 401.2 },
  { period: '2024-06', scope_1: 110.8, scope_2: 80.1, scope_3: 235.5, total: 426.4 },
  { period: '2024-07', scope_1: 118.5, scope_2: 85.3, scope_3: 250.2, total: 454.0 },
  { period: '2024-08', scope_1: 115.2, scope_2: 82.8, scope_3: 242.1, total: 440.1 },
  { period: '2024-09', scope_1: 102.4, scope_2: 73.5, scope_3: 218.6, total: 394.5 },
  { period: '2024-10', scope_1: 99.7, scope_2: 70.2, scope_3: 210.3, total: 380.2 },
  { period: '2024-11', scope_1: 96.8, scope_2: 68.1, scope_3: 205.7, total: 370.6 },
  { period: '2024-12', scope_1: 94.2, scope_2: 54.4, scope_3: 222.3, total: 370.9 },
];

const DEMO_BREAKDOWN: ScopeBreakdown[] = [
  { scope: 'scope_1', category: 'stationary_combustion', total_co2e_tonnes: 720.5, percentage: 14.9, activity_count: 24 },
  { scope: 'scope_1', category: 'mobile_combustion', total_co2e_tonnes: 380.2, percentage: 7.9, activity_count: 36 },
  { scope: 'scope_1', category: 'fugitive_emissions', total_co2e_tonnes: 149.6, percentage: 3.1, activity_count: 8 },
  { scope: 'scope_2', category: 'electricity', total_co2e_tonnes: 810.4, percentage: 16.8, activity_count: 12 },
  { scope: 'scope_2', category: 'heat_steam', total_co2e_tonnes: 80.0, percentage: 1.7, activity_count: 4 },
  { scope: 'scope_3', category: 'cat_1_purchased_goods_services', total_co2e_tonnes: 1180.5, percentage: 24.5, activity_count: 30 },
  { scope: 'scope_3', category: 'cat_6_business_travel', total_co2e_tonnes: 620.3, percentage: 12.9, activity_count: 22 },
  { scope: 'scope_3', category: 'cat_7_employee_commuting', total_co2e_tonnes: 340.2, percentage: 7.1, activity_count: 15 },
  { scope: 'scope_3', category: 'cat_5_waste_operations', total_co2e_tonnes: 280.0, percentage: 5.8, activity_count: 6 },
  { scope: 'scope_3', category: 'cat_4_upstream_transportation', total_co2e_tonnes: 264.0, percentage: 5.5, activity_count: 7 },
];

export default function DashboardPage() {
  const { currentInventory, setSummary } = useStore();
  const [summary, setSummaryLocal] = useState<InventorySummary>(DEMO_SUMMARY);
  const [trends, setTrends] = useState<EmissionsTrend[]>(DEMO_TRENDS);
  const [breakdown, setBreakdown] = useState<ScopeBreakdown[]>(DEMO_BREAKDOWN);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentInventory) {
      loadData(currentInventory.id);
    }
  }, [currentInventory]);

  const loadData = async (inventoryId: string) => {
    setLoading(true);
    try {
      const [summaryRes, trendsRes, breakdownRes] = await Promise.all([
        calculationAPI.getSummary(inventoryId),
        calculationAPI.getTrends(inventoryId),
        calculationAPI.getBreakdown(inventoryId),
      ]);
      setSummaryLocal(summaryRes.data);
      setSummary(summaryRes.data);
      setTrends(trendsRes.data);
      setBreakdown(breakdownRes.data);
    } catch {
      // Keep demo data on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emissions Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {summary.reporting_year} GHG Inventory Overview
            {!currentInventory && ' (Demo Data)'}
          </p>
        </div>
        {currentInventory && (
          <button
            onClick={() => loadData(currentInventory.id)}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            <span>Recalculate</span>
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Emissions"
          value={`${formatTonnes(summary.total_co2e_tonnes)} tCO2e`}
          subtitle={`${summary.activity_count} activities`}
          icon={<BarChart3 className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Scope 1 (Direct)"
          value={`${formatTonnes(summary.scope_1_tonnes)} tCO2e`}
          subtitle="Combustion, fugitive, process"
          icon={<Flame className="w-6 h-6" />}
          color="red"
        />
        <StatCard
          title="Scope 2 (Energy)"
          value={`${formatTonnes(summary.scope_2_tonnes)} tCO2e`}
          subtitle="Electricity, heat, steam"
          icon={<Zap className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Scope 3 (Value Chain)"
          value={`${formatTonnes(summary.scope_3_tonnes)} tCO2e`}
          subtitle="Travel, procurement, waste"
          icon={<Globe className="w-6 h-6" />}
          color="blue"
        />
      </div>

      {/* Intensity Metrics */}
      {(summary.intensity_per_employee || summary.intensity_per_revenue) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.intensity_per_employee && (
            <StatCard
              title="Emissions Intensity (per Employee)"
              value={`${summary.intensity_per_employee.toFixed(2)} tCO2e`}
              subtitle="Per full-time employee"
              icon={<Users className="w-6 h-6" />}
              color="purple"
            />
          )}
          {summary.intensity_per_revenue && (
            <StatCard
              title="Emissions Intensity (per $M Revenue)"
              value={`${summary.intensity_per_revenue.toFixed(2)} tCO2e`}
              subtitle="Per million USD revenue"
              icon={<DollarSign className="w-6 h-6" />}
              color="purple"
            />
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Emissions by Scope</h3>
          <ScopePieChart
            scope1={summary.scope_1_tonnes}
            scope2={summary.scope_2_tonnes}
            scope3={summary.scope_3_tonnes}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends</h3>
          <TrendChart data={trends} />
        </div>
      </div>

      {/* Sankey Flow */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emissions Flow</h3>
        <SankeyDiagram data={breakdown} total={summary.total_co2e_tonnes} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
          <CategoryBreakdown data={breakdown} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Quality Distribution</h3>
          <DataQualityChart data={summary.data_quality_breakdown} />
        </div>
      </div>
    </div>
  );
}
