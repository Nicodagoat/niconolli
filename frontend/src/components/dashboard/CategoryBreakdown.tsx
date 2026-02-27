import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { ScopeBreakdown } from '../../types';
import { categoryLabel, CATEGORY_COLORS } from '../../utils/formatters';

interface CategoryBreakdownProps {
  data: ScopeBreakdown[];
}

export default function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No breakdown data available
      </div>
    );
  }

  const chartData = data
    .sort((a, b) => b.total_co2e_tonnes - a.total_co2e_tonnes)
    .slice(0, 10)
    .map((item) => ({
      name: categoryLabel(item.category),
      value: item.total_co2e_tonnes,
      scope: item.scope,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(2)} tCO2e`, 'Emissions']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
