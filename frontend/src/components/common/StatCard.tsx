import { type ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  color?: 'green' | 'red' | 'amber' | 'blue' | 'purple';
  trend?: { value: number; label: string };
}

const colorMap = {
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
};

export default function StatCard({ title, value, subtitle, icon, color = 'green', trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend && (
            <p className={clsx('mt-2 text-sm font-medium', trend.value >= 0 ? 'text-red-600' : 'text-green-600')}>
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('p-3 rounded-lg', colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
