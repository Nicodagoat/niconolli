import { useState } from 'react';
import { Factory, Plus, Trash2, X, CheckCircle } from 'lucide-react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export interface ConcessionaireEntry {
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

// ISPRA 2024 emission factors for concessionaire activities
const EF = {
  electricity: 0.000260,   // tCO2/kWh (ISPRA 2024 - grid average Italy)
  diesel: 0.00268,         // tCO2/litre (DEFRA 2024)
  lpg: 0.00156,            // tCO2/litre (DEFRA 2024)
  vehicles: 0.000171,      // tCO2/km (ISPRA 2024 - avg diesel vehicle)
};

function calculateConcessionaire(entry: Omit<ConcessionaireEntry, 'scope1_tco2' | 'scope2_tco2' | 'total_tco2'>): ConcessionaireEntry {
  const scope1 = entry.diesel_litres * EF.diesel + entry.lpg_litres * EF.lpg + entry.vehicles_km * EF.vehicles;
  const scope2 = entry.electricity_kwh * EF.electricity;
  return { ...entry, scope1_tco2: Math.round(scope1 * 100) / 100, scope2_tco2: Math.round(scope2 * 100) / 100, total_tco2: Math.round((scope1 + scope2) * 100) / 100 };
}

const STORAGE_KEY = 'deasp_concessionaires';

function loadData(): ConcessionaireEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveData(entries: ConcessionaireEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function ConcessionaireDataStep({ onNext, onBack }: Props) {
  const [entries, setEntries] = useState<ConcessionaireEntry[]>(loadData);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', port: 'Augusta', type: 'terminal',
    electricity_kwh: '', diesel_litres: '', lpg_litres: '', vehicles_km: '',
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const raw = {
      id: `conc_${Date.now()}`,
      name: form.name.trim(),
      port: form.port,
      type: form.type,
      electricity_kwh: parseFloat(form.electricity_kwh) || 0,
      diesel_litres: parseFloat(form.diesel_litres) || 0,
      lpg_litres: parseFloat(form.lpg_litres) || 0,
      vehicles_km: parseFloat(form.vehicles_km) || 0,
    };
    const entry = calculateConcessionaire(raw as any);
    const updated = [...entries, entry];
    setEntries(updated);
    saveData(updated);
    setShowModal(false);
    setForm({ name: '', port: 'Augusta', type: 'terminal', electricity_kwh: '', diesel_litres: '', lpg_litres: '', vehicles_km: '' });
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveData(updated);
  };

  const totalScope1 = entries.reduce((s, e) => s + e.scope1_tco2, 0);
  const totalScope2 = entries.reduce((s, e) => s + e.scope2_tco2, 0);
  const grandTotal = entries.reduce((s, e) => s + e.total_tco2, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Factory className="w-5 h-5 text-brand-yellow" />
          <span>Step 2: Dati Concessionari</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Inserisci i consumi energetici dei concessionari portuali (da questionari o dati diretti)
        </p>
      </div>

      {/* Summary Cards */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-hover rounded-lg p-4 text-center">
            <div className="text-lg font-bold text-red-400">{totalScope1.toFixed(1)}</div>
            <div className="text-xs text-gray-400 mt-1">Scope 1 (tCO2)</div>
          </div>
          <div className="bg-surface-hover rounded-lg p-4 text-center">
            <div className="text-lg font-bold text-amber-400">{totalScope2.toFixed(1)}</div>
            <div className="text-xs text-gray-400 mt-1">Scope 2 (tCO2)</div>
          </div>
          <div className="bg-surface-hover rounded-lg p-4 text-center">
            <div className="text-lg font-bold text-white">{grandTotal.toFixed(1)}</div>
            <div className="text-xs text-gray-400 mt-1">Totale (tCO2)</div>
          </div>
        </div>
      )}

      {/* Add Button */}
      <button onClick={() => setShowModal(true)}
        className="flex items-center space-x-2 px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
        <Plus className="w-4 h-4" /><span>Aggiungi Concessionario</span>
      </button>

      {/* Entries Table */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover border-b border-surface-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Concessionario</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Porto</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Elettricità (kWh)</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Gasolio (L)</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Scope 1 (tCO2)</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Scope 2 (tCO2)</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 font-bold">Totale (tCO2)</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-surface-hover/50">
                  <td className="px-3 py-2">
                    <div className="text-white text-xs font-medium">{e.name}</div>
                    <div className="text-[10px] text-gray-500 capitalize">{e.type.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue">{e.port}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{e.electricity_kwh.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{e.diesel_litres.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{e.scope1_tco2.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-400">{e.scope2_tco2.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{e.total_tco2.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleDelete(e.id)} className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-border">
                <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-300">Totale Concessionari</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-red-400">{totalScope1.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-amber-400">{totalScope2.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-white">{grandTotal.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-surface-border rounded-xl p-8 text-center">
          <Factory className="w-10 h-10 mx-auto text-gray-500 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Nessun concessionario aggiunto</p>
          <p className="text-xs text-gray-500">Aggiungi i dati dei concessionari dai questionari compilati</p>
        </div>
      )}

      {/* EF Reference */}
      <div className="bg-surface-hover rounded-lg p-3">
        <p className="text-xs text-gray-500">
          Fattori emissione: Elettricità {EF.electricity} tCO2/kWh (ISPRA 2024) | Gasolio {EF.diesel} tCO2/L (DEFRA 2024) | GPL {EF.lpg} tCO2/L (DEFRA 2024) | Veicoli {EF.vehicles} tCO2/km (ISPRA 2024)
        </p>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center space-x-2 p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-brand-green" />
          <span className="text-xs text-brand-green">{entries.length} concessionari inseriti — {grandTotal.toFixed(1)} tCO2 totali calcolati</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-surface-border">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-surface-border rounded-lg hover:bg-surface-hover text-gray-300">
          ← Indietro
        </button>
        <button onClick={onNext}
          className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
          Prosegui → Calcolo Emissioni
        </button>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl border border-surface-border w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Aggiungi Concessionario</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome Concessionario *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Terminal Container Augusta S.r.l."
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Porto</label>
                  <select value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="Augusta">Augusta</option>
                    <option value="Catania">Catania</option>
                    <option value="Siracusa">Siracusa</option>
                    <option value="Pozzallo">Pozzallo</option>
                    <option value="Gela">Gela</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue">
                    <option value="terminal">Terminal Container</option>
                    <option value="deposito">Deposito Costiero</option>
                    <option value="logistica">Logistica</option>
                    <option value="bunkeraggio">Bunkeraggio</option>
                    <option value="servizi">Servizi Portuali</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-surface-border pt-4">
                <p className="text-xs text-gray-400 mb-3">Consumi annuali (da questionario o dati diretti)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Elettricità (kWh/anno)</label>
                    <input type="number" value={form.electricity_kwh} onChange={(e) => setForm({ ...form, electricity_kwh: e.target.value })}
                      placeholder="e.g., 500000"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Gasolio (litri/anno)</label>
                    <input type="number" value={form.diesel_litres} onChange={(e) => setForm({ ...form, diesel_litres: e.target.value })}
                      placeholder="e.g., 15000"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">GPL (litri/anno)</label>
                    <input type="number" value={form.lpg_litres} onChange={(e) => setForm({ ...form, lpg_litres: e.target.value })}
                      placeholder="e.g., 2000"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Veicoli (km/anno)</label>
                    <input type="number" value={form.vehicles_km} onChange={(e) => setForm({ ...form, vehicles_km: e.target.value })}
                      placeholder="e.g., 50000"
                      className="w-full rounded-lg bg-brand-dark border border-surface-border p-2.5 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              {(form.electricity_kwh || form.diesel_litres || form.lpg_litres || form.vehicles_km) && (
                <div className="p-3 bg-brand-green/5 border border-brand-green/20 rounded-lg">
                  <p className="text-xs text-brand-green font-medium">Stima emissioni:</p>
                  <p className="text-xs text-brand-green">
                    Scope 1: {((parseFloat(form.diesel_litres) || 0) * EF.diesel + (parseFloat(form.lpg_litres) || 0) * EF.lpg + (parseFloat(form.vehicles_km) || 0) * EF.vehicles).toFixed(2)} tCO2 |
                    Scope 2: {((parseFloat(form.electricity_kwh) || 0) * EF.electricity).toFixed(2)} tCO2
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 border border-surface-border rounded-lg hover:bg-surface-hover">Annulla</button>
              <button onClick={handleAdd} disabled={!form.name.trim()}
                className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
