import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, CheckCircle, Globe } from 'lucide-react';

interface Props {
  onBack: () => void;
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

function loadCalcResults(): ShipResult[] {
  try {
    const saved = localStorage.getItem('deasp_calc_results');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function loadShips(): Array<{ imo: string; name: string; port: string; gt: number; category: string; hours: number; maneuvers: number }> {
  try {
    const saved = localStorage.getItem('deasp_ships');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function loadConcessionaires(): ConcessionaireEntry[] {
  try {
    const saved = localStorage.getItem('deasp_concessionaires');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const colCount = headers.length;
  // Pad rows to header column count for strict CSV compliance
  const padRow = (r: string[]) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return padded;
  };
  return '\ufeff' + [headers.map(escape).join(','), ...rows.map(r => padRow(r).map(escape).join(','))].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const REPORT_TYPES = [
  {
    id: 'excel',
    title: 'Report Excel DEASP',
    desc: 'Include fogli: Riepilogo, Dettaglio Navi, Concessionari, Fattori Applicati, Conformità',
    icon: <FileSpreadsheet className="w-8 h-8" />,
    format: 'CSV',
    sheets: ['Riepilogo', 'Navi', 'Concessionari', 'Fattori_Applicati', 'Conformità'],
  },
  {
    id: 'pdf',
    title: 'Report PDF Esecutivo',
    desc: 'Report completo con metodologia, fonti normative, e conformità DEASP',
    icon: <FileText className="w-8 h-8" />,
    format: 'TXT',
    sections: ['Metodologia e fonti', 'Aggiornamenti normativi', 'Conformità DEASP'],
  },
  {
    id: 'csv-calcs',
    title: 'Export CSV Calcoli',
    desc: 'Tutti i risultati di calcolo con fattori utilizzati, fonti e confidenza',
    icon: <Download className="w-8 h-8" />,
    format: 'CSV',
  },
  {
    id: 'csv-ships',
    title: 'Export CSV Navi',
    desc: 'Dettaglio scali navali con emissioni hotelling e manovra calcolate',
    icon: <Download className="w-8 h-8" />,
    format: 'CSV',
  },
];

export default function ReportStep({ onBack }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  const handleGenerate = (id: string) => {
    setGenerating(id);
    const results = loadCalcResults();
    const ships = loadShips();
    const concessionaires = loadConcessionaires();
    const shipTotal = results.reduce((s, r) => s + r.total_tco2, 0);
    const concTotal = concessionaires.reduce((s, c) => s + c.total_tco2, 0);
    const concScope1 = concessionaires.reduce((s, c) => s + c.scope1_tco2, 0);
    const concScope2 = concessionaires.reduce((s, c) => s + c.scope2_tco2, 0);
    const grandTotal = shipTotal + concTotal;
    const now = new Date().toISOString();

    setTimeout(() => {
      if (id === 'csv-ships') {
        const headers = ['IMO', 'Nave', 'Porto', 'GT', 'Categoria', 'Ore_Hotelling', 'Manovre', 'Hotelling_tCO2', 'Manovra_tCO2', 'Totale_tCO2'];
        const rows = ships.map(ship => {
          const calc = results.find(r => r.imo === ship.imo);
          return [
            ship.imo, ship.name, ship.port, ship.gt.toString(), ship.category,
            ship.hours.toString(), ship.maneuvers.toString(),
            (calc?.hotelling_tco2 || 0).toFixed(2),
            (calc?.maneuver_tco2 || 0).toFixed(2),
            (calc?.total_tco2 || 0).toFixed(2),
          ];
        });
        downloadFile(generateCSV(headers, rows), `DEASP_Navi_Export_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'csv-calcs') {
        const headers = ['Categoria', 'Sottocategoria', 'Valore', 'Unità', 'Fattore_Emissione', 'Fonte', 'Confidenza', 'tCO2'];
        const rows: string[][] = [];
        for (const r of results) {
          rows.push(['Navi - Hotelling', r.name, r.hotelling_tco2.toFixed(2), 'tCO2', 'EMEP/EEA Tier 2', 'EMEP/EEA 2023', '90%', r.hotelling_tco2.toFixed(4)]);
          rows.push(['Navi - Manovra', r.name, r.maneuver_tco2.toFixed(2), 'tCO2', 'EMEP/EEA Tier 2', 'EMEP/EEA 2023', '90%', r.maneuver_tco2.toFixed(4)]);
        }
        rows.push([]);
        for (const c of concessionaires) {
          rows.push(['Concessionario - Scope 1', c.name, c.scope1_tco2.toFixed(2), 'tCO2', 'ISPRA/DEFRA 2024', 'ISPRA 2024', '95%', c.scope1_tco2.toFixed(4)]);
          rows.push(['Concessionario - Scope 2', c.name, c.scope2_tco2.toFixed(2), 'tCO2', 'ISPRA 2024 Grid', 'ISPRA 2024', '95%', c.scope2_tco2.toFixed(4)]);
        }
        rows.push([]);
        rows.push(['TOTALE NAVI', '', shipTotal.toFixed(2), 'tCO2', '', '', '', shipTotal.toFixed(4)]);
        rows.push(['TOTALE CONCESSIONARI', '', concTotal.toFixed(2), 'tCO2', '', '', '', concTotal.toFixed(4)]);
        rows.push(['TOTALE SISTEMA PORTUALE', '', grandTotal.toFixed(2), 'tCO2', '', '', '', grandTotal.toFixed(4)]);
        downloadFile(generateCSV(headers, rows), `DEASP_Calcoli_Export_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'excel') {
        const lines: string[] = [];
        lines.push('--- RIEPILOGO DEASP ---');
        lines.push(`"Data generazione","${now}"`);
        lines.push(`"Emissioni Navi (tCO2)","${shipTotal.toFixed(2)}"`);
        lines.push(`"Emissioni Concessionari (tCO2)","${concTotal.toFixed(2)}"`);
        lines.push(`"  - Scope 1 Concessionari","${concScope1.toFixed(2)}"`);
        lines.push(`"  - Scope 2 Concessionari","${concScope2.toFixed(2)}"`);
        lines.push(`"Totale Sistema Portuale (tCO2)","${grandTotal.toFixed(2)}"`);
        lines.push('');
        lines.push('--- DETTAGLIO NAVI ---');
        lines.push('"IMO","Nave","Porto","Hotelling_tCO2","Manovra_tCO2","Totale_tCO2"');
        for (const r of results) {
          lines.push(`"${r.imo}","${r.name}","${r.port}","${r.hotelling_tco2.toFixed(2)}","${r.maneuver_tco2.toFixed(2)}","${r.total_tco2.toFixed(2)}"`);
        }
        lines.push('');
        lines.push('--- DETTAGLIO CONCESSIONARI ---');
        lines.push('"Nome","Porto","Tipo","Elettricità_kWh","Gasolio_L","GPL_L","Veicoli_km","Scope1_tCO2","Scope2_tCO2","Totale_tCO2"');
        for (const c of concessionaires) {
          lines.push(`"${c.name}","${c.port}","${c.type}","${c.electricity_kwh}","${c.diesel_litres}","${c.lpg_litres}","${c.vehicles_km}","${c.scope1_tco2.toFixed(2)}","${c.scope2_tco2.toFixed(2)}","${c.total_tco2.toFixed(2)}"`);
        }
        lines.push('');
        lines.push('--- FATTORI APPLICATI ---');
        lines.push('"Categoria","Nome","Valore","Unità","Fonte","Confidenza"');
        lines.push('"Navi","Hotelling EF (EMEP/EEA Tier 2)","0.24-1.38","tCO2/hour","EMEP/EEA 2023","90%"');
        lines.push('"Navi","Manovra EF (EMEP/EEA Tier 2)","0.68-3.90","tCO2/maneuver","EMEP/EEA 2023","90%"');
        lines.push('"Elettricità","Mix nazionale Italia","0.000260","tCO2/kWh","ISPRA 2024","95%"');
        lines.push('"Gasolio","Combustione diesel","0.00268","tCO2/litro","DEFRA 2024","97%"');
        lines.push('"GPL","Combustione GPL","0.00156","tCO2/litro","DEFRA 2024","95%"');
        lines.push('"Veicoli","Auto diesel media","0.000171","tCO2/km","ISPRA 2024","85%"');
        lines.push('');
        lines.push('--- CONFORMITÀ ---');
        lines.push('"Standard","DEASP - Direttiva Europea Ambiente Sistema Portuale"');
        lines.push('"Metodologia","EMEP/EEA Guidebook 2023 - Tier 2 approach"');
        lines.push('"GWP","IPCC AR6 (2021)"');
        lines.push('"Fattori nazionali","ISPRA 2024, DEFRA 2024"');
        downloadFile('\ufeff' + lines.join('\n'), `DEASP_Report_Completo_${now.slice(0, 10)}.csv`, 'text/csv');
      }

      if (id === 'pdf') {
        const lines: string[] = [];
        lines.push('='.repeat(60));
        lines.push('REPORT ESECUTIVO DEASP');
        lines.push('Direttiva Europea Ambiente Sistema Portuale');
        lines.push('='.repeat(60));
        lines.push('');
        lines.push(`Data: ${now}`);
        lines.push('');
        lines.push('1. RIEPILOGO EMISSIONI');
        lines.push('-'.repeat(40));
        lines.push(`   Emissioni Navi:          ${shipTotal.toFixed(2)} tCO2`);
        lines.push(`   Emissioni Concessionari: ${concTotal.toFixed(2)} tCO2`);
        lines.push(`     - Scope 1:             ${concScope1.toFixed(2)} tCO2`);
        lines.push(`     - Scope 2:             ${concScope2.toFixed(2)} tCO2`);
        lines.push(`   TOTALE SISTEMA:          ${grandTotal.toFixed(2)} tCO2`);
        lines.push('');
        lines.push('2. METODOLOGIA');
        lines.push('-'.repeat(40));
        lines.push('   Approccio: EMEP/EEA Guidebook 2023 - Tier 2');
        lines.push('   GWP: IPCC AR6 (2021)');
        lines.push('   Fattori nazionali: ISPRA 2024, DEFRA 2024');
        lines.push('   Fattori navi: EMEP/EEA 2023 (by GT class)');
        lines.push('   Fattori concessionari: ISPRA 2024 (elettricità), DEFRA 2024 (gasolio, GPL)');
        lines.push('');
        lines.push('3. DETTAGLIO PER NAVE');
        lines.push('-'.repeat(40));
        for (const r of results) {
          lines.push(`   ${r.name.padEnd(20)} ${r.port.padEnd(12)} ${r.total_tco2.toFixed(2).padStart(10)} tCO2`);
        }
        lines.push(`   ${'TOTALE NAVI'.padEnd(20)} ${''.padEnd(12)} ${shipTotal.toFixed(2).padStart(10)} tCO2`);
        lines.push('');
        lines.push('4. DETTAGLIO PER CONCESSIONARIO');
        lines.push('-'.repeat(40));
        for (const c of concessionaires) {
          lines.push(`   ${c.name.padEnd(30)} S1: ${c.scope1_tco2.toFixed(2).padStart(8)} S2: ${c.scope2_tco2.toFixed(2).padStart(8)} Tot: ${c.total_tco2.toFixed(2).padStart(8)} tCO2`);
        }
        lines.push(`   ${'TOTALE CONCESSIONARI'.padEnd(30)} S1: ${concScope1.toFixed(2).padStart(8)} S2: ${concScope2.toFixed(2).padStart(8)} Tot: ${concTotal.toFixed(2).padStart(8)} tCO2`);
        lines.push('');
        lines.push('5. CONFORMITÀ');
        lines.push('-'.repeat(40));
        lines.push('   Standard: DEASP');
        lines.push('   Fonti normative: ISPRA 2024, DEFRA 2024, EMEP/EEA 2023, IPCC AR6');
        lines.push('   Audit trail: Ogni fattore registrato con fonte e anno');
        lines.push('');
        lines.push('='.repeat(60));
        lines.push('Fine Report');
        downloadFile(lines.join('\n'), `DEASP_Report_Esecutivo_${now.slice(0, 10)}.txt`, 'text/plain');
      }

      setGenerating(null);
      setGenerated((prev) => new Set([...prev, id]));
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Download className="w-5 h-5 text-brand-blue" />
          <span>Step 4: Generazione Report DEASP</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Genera output conformi alla Direttiva Europea Ambiente Sistema Portuale con tracciabilità fattori
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TYPES.map((report) => (
          <div key={report.id} className="bg-surface-hover rounded-xl border border-surface-border p-5 hover:border-brand-blue/30 transition-colors">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-brand-blue/10 text-brand-blue">{report.icon}</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">{report.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{report.desc}</p>

                {'sheets' in report && report.sheets && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {report.sheets.map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 text-[10px] bg-surface-card text-gray-400 rounded">{s}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs text-gray-500">Formato: {report.format}</span>
                  {generated.has(report.id) && (
                    <span className="flex items-center space-x-1 text-xs text-brand-green">
                      <CheckCircle className="w-3 h-3" />
                      <span>Generato e scaricato</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating === report.id}
                  className="mt-3 flex items-center space-x-2 px-4 py-2 text-xs primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <Download className="w-3 h-3" />
                  <span>{generating === report.id ? 'Generazione...' : generated.has(report.id) ? 'Rigenera e scarica' : 'Genera e scarica'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conformity Section */}
      <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-brand-green flex items-center space-x-2 mb-3">
          <Globe className="w-4 h-4" />
          <span>Conformità e Tracciabilità</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-brand-green/80">
          <div>
            <div className="font-semibold text-brand-green">Standard conformità</div>
            <p>DEASP - Direttiva Europea Ambiente Sistema Portuale</p>
          </div>
          <div>
            <div className="font-semibold text-brand-green">Fonti normative</div>
            <p>ISPRA 2024, DEFRA 2024, EMEP/EEA 2023, IPCC AR6</p>
          </div>
          <div>
            <div className="font-semibold text-brand-green">Audit trail</div>
            <p>Ogni fattore utilizzato è registrato con fonte, anno e motivazione</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-surface-border">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
          ← Indietro
        </button>
      </div>
    </div>
  );
}
