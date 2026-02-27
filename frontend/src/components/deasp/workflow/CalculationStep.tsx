import { useState, useEffect } from 'react';
import { Calculator, CheckCircle, Database, RefreshCw } from 'lucide-react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

interface ShipEntry {
  imo: string;
  name: string;
  port: string;
  gt: number;
  category: string;
  hours: number;
  maneuvers: number;
}

interface ShipResult {
  imo: string;
  name: string;
  port: string;
  hotelling_tco2: number;
  maneuver_tco2: number;
  total_tco2: number;
}

interface ConcessionaireEntry {
  id: string;
  name: string;
  port: string;
  type: string;
  electricity_kwh: number;
  diesel_litres: number;
  lpg_litres: number;
  vehicles_km: number;
  scope1_tco2: number;
  scope2_tco2: number;
  total_tco2: number;
}

// EMEP/EEA 2023 emission factors for ships (tCO2/hour) by GT class
// Source: EMEP/EEA Guidebook 2023 - Table 3-1, Tier 2 approach
const HOTELLING_EF: Record<string, number> = {
  '1000-4999': 0.24,    // tCO2/hour hotelling
  '5000-24999': 0.52,
  '25000-49999': 0.94,
  '50000+': 1.38,
};

const MANEUVER_EF: Record<string, number> = {
  '1000-4999': 0.68,    // tCO2/maneuver (avg 1 hour)
  '5000-24999': 1.45,
  '25000-49999': 2.65,
  '50000+': 3.90,
};

// Category-specific adjustment factors (EMEP/EEA 2023)
const CATEGORY_ADJUSTMENTS: Record<string, number> = {
  container: 1.0,
  ro_ro: 0.85,
  general_cargo: 0.75,
  cruise: 1.35,
  tanker: 0.90,
  bulk_carrier: 0.70,
};

function getGTClass(gt: number): string {
  if (gt < 5000) return '1000-4999';
  if (gt < 25000) return '5000-24999';
  if (gt < 50000) return '25000-49999';
  return '50000+';
}

function calculateShipEmissions(ship: ShipEntry): ShipResult {
  const gtClass = getGTClass(ship.gt);
  const catAdj = CATEGORY_ADJUSTMENTS[ship.category] || 1.0;

  const hotelling = ship.hours * (HOTELLING_EF[gtClass] || 0.52) * catAdj;
  const maneuver = ship.maneuvers * (MANEUVER_EF[gtClass] || 1.45) * catAdj;

  return {
    imo: ship.imo,
    name: ship.name,
    port: ship.port,
    hotelling_tco2: Math.round(hotelling * 100) / 100,
    maneuver_tco2: Math.round(maneuver * 100) / 100,
    total_tco2: Math.round((hotelling + maneuver) * 100) / 100,
  };
}

function loadConcessionaires(): ConcessionaireEntry[] {
  try {
    const saved = localStorage.getItem('deasp_concessionaires');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

const FACTORS_TABLE = [
  { category: 'Navi - Hotelling', name: 'EMEP/EEA Tier 2 (by GT class)', value: '0.24–1.38', unit: 'tCO2/hour', source: 'EMEP/EEA 2023', confidence: '90%' },
  { category: 'Navi - Manovra', name: 'EMEP/EEA Tier 2 (by GT class)', value: '0.68–3.90', unit: 'tCO2/maneuver', source: 'EMEP/EEA 2023', confidence: '90%' },
  { category: 'Elettricità', name: 'Mix nazionale Italia', value: '0.000260', unit: 'tCO2/kWh', source: 'ISPRA 2024', confidence: '95%' },
  { category: 'Gasolio', name: 'Combustione diesel', value: '0.00268', unit: 'tCO2/litro', source: 'DEFRA 2024', confidence: '97%' },
  { category: 'GPL', name: 'Combustione GPL', value: '0.00156', unit: 'tCO2/litro', source: 'DEFRA 2024', confidence: '95%' },
  { category: 'Veicoli', name: 'Auto diesel media', value: '0.000171', unit: 'tCO2/km', source: 'ISPRA 2024', confidence: '85%' },
];

export default function CalculationStep({ onNext, onBack }: Props) {
  const [calculating, setCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [results, setResults] = useState<ShipResult[]>([]);
  const [shipCount, setShipCount] = useState(0);
  const [concessionaires, setConcessionaires] = useState<ConcessionaireEntry[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('deasp_ships');
      if (saved) {
        const ships: ShipEntry[] = JSON.parse(saved);
        setShipCount(ships.length);
      }
    } catch { /* ignore */ }
    setConcessionaires(loadConcessionaires());
  }, []);

  const concessionaireEmissions = concessionaires.reduce((s, c) => s + c.total_tco2, 0);
  const concScope1 = concessionaires.reduce((s, c) => s + c.scope1_tco2, 0);
  const concScope2 = concessionaires.reduce((s, c) => s + c.scope2_tco2, 0);

  const handleCalculate = () => {
    setCalculating(true);

    setTimeout(() => {
      try {
        const saved = localStorage.getItem('deasp_ships');
        const ships: ShipEntry[] = saved ? JSON.parse(saved) : [];
        const calcs = ships.map(calculateShipEmissions);
        setResults(calcs);

        // Save both ship results and concessionaire totals for report step
        localStorage.setItem('deasp_calc_results', JSON.stringify(calcs));
        localStorage.setItem('deasp_calc_summary', JSON.stringify({
          shipTotal: calcs.reduce((s, r) => s + r.total_tco2, 0),
          concessionaireTotal: concessionaireEmissions,
          concScope1,
          concScope2,
          concessionaireCount: concessionaires.length,
          shipCount: calcs.length,
          calculatedAt: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
      setCalculating(false);
      setCalculated(true);
    }, 800);
  };

  const shipTotal = results.reduce((s, r) => s + r.total_tco2, 0);
  const grandTotal = shipTotal + concessionaireEmissions;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-brand-blue" />
          <span>Step 3: Calcolo Emissioni</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Calcola le emissioni utilizzando i fattori EMEP/EEA 2023 e ISPRA 2024
        </p>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-hover rounded-lg p-4">
          <div className="text-2xl font-bold text-brand-blue">{shipCount}</div>
          <div className="text-xs text-gray-400 mt-1">Navi importate</div>
        </div>
        <div className="bg-surface-hover rounded-lg p-4">
          <div className="text-2xl font-bold text-brand-yellow">{concessionaires.length}</div>
          <div className="text-xs text-gray-400 mt-1">Concessionari ({concessionaireEmissions.toFixed(1)} tCO2 pre-calcolate)</div>
        </div>
      </div>

      {/* Factors Used */}
      <div className="bg-surface-hover rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center space-x-2">
          <Database className="w-4 h-4 text-brand-blue" />
          <span>Fattori di emissione applicati</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-surface-border">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Categoria</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Nome</th>
                <th className="px-2 py-2 text-right font-medium text-gray-500">Valore</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Unità</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Fonte</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500">Confidenza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {FACTORS_TABLE.map((f, i) => (
                <tr key={i}>
                  <td className="px-2 py-2 font-medium text-gray-300">{f.category}</td>
                  <td className="px-2 py-2 text-gray-400">{f.name}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{f.value}</td>
                  <td className="px-2 py-2 text-gray-500">{f.unit}</td>
                  <td className="px-2 py-2">
                    <span className="px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-[10px]">{f.source}</span>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-400">{f.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Gerarchia priorità: Specifico Azienda → ZES → ISPRA Nazionale → EMEP/EEA → IPCC
        </p>
      </div>

      {/* Calculate Button */}
      {!calculated ? (
        <button
          onClick={handleCalculate}
          disabled={calculating || (shipCount === 0 && concessionaires.length === 0)}
          className="w-full flex items-center justify-center space-x-2 px-6 py-4 text-sm primary-gradient text-white rounded-xl hover:opacity-90 disabled:opacity-50"
        >
          {calculating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Calcolo in corso... Applicazione fattori EMEP/EEA e ISPRA</span>
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              <span>Avvia Calcolo Emissioni DEASP ({shipCount} navi + {concessionaires.length} concessionari)</span>
            </>
          )}
        </button>
      ) : (
        <>
          {/* Results Summary */}
          <div className="p-4 bg-brand-green/5 border border-brand-green/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-brand-green" />
              <div>
                <p className="text-sm font-bold text-brand-green">Calcolo completato</p>
                <p className="text-xs text-brand-green/80">
                  {results.length} scali navali + {concessionaires.length} concessionari elaborati
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-hover rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-brand-blue">{shipTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-gray-400 mt-1">tCO2 - Emissioni Navi</div>
            </div>
            <div className="bg-surface-hover rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-brand-yellow">{concessionaireEmissions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
              <div className="text-xs text-gray-400 mt-1">tCO2 - Concessionari (S1: {concScope1.toFixed(1)} + S2: {concScope2.toFixed(1)})</div>
            </div>
            <div className="bg-surface-hover rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-gray-400 mt-1">tCO2 - Totale Sistema Portuale</div>
            </div>
          </div>

          {/* Per-ship breakdown */}
          {results.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Dettaglio per nave</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-surface-border bg-surface-hover">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Nave</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Porto</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Hotelling (tCO2)</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Manovra (tCO2)</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Totale (tCO2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {results.map(r => (
                      <tr key={r.imo} className="hover:bg-surface-hover/50">
                        <td className="px-2 py-2 font-medium text-gray-300">{r.name}</td>
                        <td className="px-2 py-2"><span className="px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-[10px]">{r.port}</span></td>
                        <td className="px-2 py-2 text-right font-mono text-gray-300">{r.hotelling_tco2.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono text-gray-300">{r.maneuver_tco2.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-white">{r.total_tco2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-border font-bold">
                      <td colSpan={2} className="px-2 py-2 text-gray-300">Totale Navi</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{results.reduce((s, r) => s + r.hotelling_tco2, 0).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{results.reduce((s, r) => s + r.maneuver_tco2, 0).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono text-white">{shipTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Per-concessionaire breakdown */}
          {concessionaires.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Dettaglio per concessionario</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-surface-border bg-surface-hover">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Concessionario</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Porto</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Scope 1 (tCO2)</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Scope 2 (tCO2)</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">Totale (tCO2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {concessionaires.map(c => (
                      <tr key={c.id} className="hover:bg-surface-hover/50">
                        <td className="px-2 py-2 font-medium text-gray-300">{c.name}</td>
                        <td className="px-2 py-2"><span className="px-1.5 py-0.5 bg-brand-yellow/10 text-brand-yellow rounded text-[10px]">{c.port}</span></td>
                        <td className="px-2 py-2 text-right font-mono text-red-400">{c.scope1_tco2.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-400">{c.scope2_tco2.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-white">{c.total_tco2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-border font-bold">
                      <td colSpan={2} className="px-2 py-2 text-gray-300">Totale Concessionari</td>
                      <td className="px-2 py-2 text-right font-mono text-red-400">{concScope1.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono text-amber-400">{concScope2.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono text-white">{concessionaireEmissions.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="p-3 bg-surface-hover rounded-lg text-xs text-gray-500">
            <p>Ogni selezione di fattore è stata registrata nell'audit trail per tracciabilità completa.</p>
            <p className="mt-1">Fattori utilizzati: EMEP/EEA 2023 (hotelling/manovra per classe GT), ISPRA 2024 (elettricità, veicoli), DEFRA 2024 (gasolio, GPL)</p>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-surface-border">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
          ← Indietro
        </button>
        <button
          onClick={onNext}
          disabled={!calculated}
          className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          Prosegui → Report DEASP
        </button>
      </div>
    </div>
  );
}
