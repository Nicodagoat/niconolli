import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { SCOPE_COLORS, scopeLabel, formatTonnes } from '../../utils/formatters';

interface ScopePieChartProps {
  scope1: number;
  scope2: number;
  scope3: number;
}

export default function ScopePieChart({ scope1, scope2, scope3 }: ScopePieChartProps) {
  const data = [
    { name: scopeLabel('scope_1'), value: scope1, key: 'scope_1' },
    { name: scopeLabel('scope_2'), value: scope2, key: 'scope_2' },
    { name: scopeLabel('scope_3'), value: scope3, key: 'scope_3' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No emission data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
          labelLine={true}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={SCOPE_COLORS[entry.key]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${formatTonnes(value)} tCO2e`, '']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
