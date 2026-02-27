import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DataQualityChartProps {
  data: Record<string, number>;
}

const QUALITY_COLORS: Record<string, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
  default: '#94a3b8',
};

const QUALITY_LABELS: Record<string, string> = {
  high: 'High (Measured)',
  medium: 'Medium (Calculated)',
  low: 'Low (Estimated)',
  default: 'Default',
};

export default function DataQualityChart({ data }: DataQualityChartProps) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: QUALITY_LABELS[key] || key,
    value,
    key,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No data quality information
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={80}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={QUALITY_COLORS[entry.key] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
