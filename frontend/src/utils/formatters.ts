export function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  return value.toFixed(2);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function scopeLabel(scope: string): string {
  const labels: Record<string, string> = {
    scope_1: 'Scope 1 (Direct)',
    scope_2: 'Scope 2 (Energy)',
    scope_3: 'Scope 3 (Value Chain)',
  };
  return labels[scope] || scope;
}

export function categoryLabel(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/cat (\d+)/, 'Cat. $1:')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SCOPE_COLORS: Record<string, string> = {
  scope_1: '#ef4444',
  scope_2: '#f59e0b',
  scope_3: '#3b82f6',
};

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];
