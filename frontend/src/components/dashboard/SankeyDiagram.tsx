import type { ScopeBreakdown } from '../../types';
import { scopeLabel, categoryLabel, SCOPE_COLORS, formatTonnes } from '../../utils/formatters';

interface SankeyDiagramProps {
  data: ScopeBreakdown[];
  total: number;
}

export default function SankeyDiagram({ data, total }: SankeyDiagramProps) {
  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No emission flow data available
      </div>
    );
  }

  // Group by scope
  const scopeGroups: Record<string, ScopeBreakdown[]> = {};
  data.forEach((item) => {
    if (!scopeGroups[item.scope]) scopeGroups[item.scope] = [];
    scopeGroups[item.scope].push(item);
  });

  const scopes = Object.entries(scopeGroups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {/* Total bar */}
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">{formatTonnes(total)} tCO2e</div>
        <div className="text-sm text-gray-500">Total Emissions</div>
      </div>

      {/* Scope bars */}
      <div className="flex h-8 rounded-lg overflow-hidden">
        {scopes.map(([scope, items]) => {
          const scopeTotal = items.reduce((sum, i) => sum + i.total_co2e_tonnes, 0);
          const pct = (scopeTotal / total) * 100;
          return (
            <div
              key={scope}
              className="flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${pct}%`,
                backgroundColor: SCOPE_COLORS[scope] || '#6b7280',
                minWidth: pct > 3 ? undefined : '24px',
              }}
              title={`${scopeLabel(scope)}: ${formatTonnes(scopeTotal)} tCO2e (${pct.toFixed(1)}%)`}
            >
              {pct > 8 ? `${pct.toFixed(0)}%` : ''}
            </div>
          );
        })}
      </div>

      {/* Legend and breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {scopes.map(([scope, items]) => {
          const scopeTotal = items.reduce((sum, i) => sum + i.total_co2e_tonnes, 0);
          return (
            <div key={scope} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: SCOPE_COLORS[scope] }}
                />
                <span className="text-sm font-semibold text-gray-700">{scopeLabel(scope)}</span>
              </div>
              <div className="text-lg font-bold text-gray-900">{formatTonnes(scopeTotal)} tCO2e</div>
              <div className="mt-2 space-y-1">
                {items
                  .sort((a, b) => b.total_co2e_tonnes - a.total_co2e_tonnes)
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.category} className="flex justify-between text-xs text-gray-600">
                      <span className="truncate">{categoryLabel(item.category)}</span>
                      <span className="font-medium ml-2">{formatTonnes(item.total_co2e_tonnes)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
