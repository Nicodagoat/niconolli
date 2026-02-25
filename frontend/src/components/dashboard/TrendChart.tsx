import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { EmissionsTrend } from '../../types';
import { SCOPE_COLORS } from '../../utils/formatters';

interface TrendChartProps {
  data: EmissionsTrend[];
}

export default function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          formatter={(value: number) => [`${value.toFixed(2)} tCO2e`, '']}
        />
        <Legend />
        <Line type="monotone" dataKey="scope_1" stroke={SCOPE_COLORS.scope_1} name="Scope 1" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="scope_2" stroke={SCOPE_COLORS.scope_2} name="Scope 2" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="scope_3" stroke={SCOPE_COLORS.scope_3} name="Scope 3" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="total" stroke="#1e293b" name="Total" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
