import { type ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  color?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'yellow';
  trend?: { value: number; label: string };
}

const colorMap = {
  green: 'bg-brand-green/10 text-brand-green',
  red: 'bg-red-500/10 text-red-400',
  amber: 'bg-amber-500/10 text-amber-400',
  blue: 'bg-brand-blue/10 text-[#6060FF]',
  purple: 'bg-purple-500/10 text-purple-400',
  yellow: 'bg-brand-yellow/10 text-brand-yellow',
};

export default function StatCard({ title, value, subtitle, icon, color = 'green', trend }: StatCardProps) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-6 hover:border-surface-hover transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend && (
            <p className={clsx('mt-2 text-sm font-medium', trend.value >= 0 ? 'text-red-400' : 'text-brand-green')}>
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
