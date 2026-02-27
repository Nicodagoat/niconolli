import { useState, useRef } from 'react';
import { Upload, Download, Ship, CheckCircle, AlertTriangle } from 'lucide-react';

interface ShipEntry {
  imo: string;
  name: string;
  port: string;
  gt: number;
  category: string;
  hours: number;
  maneuvers: number;
}

interface Props {
  onNext: () => void;
}

const DEMO_SHIPS: ShipEntry[] = [
  { imo: '9876543', name: 'MSC AURORA', port: 'Augusta', gt: 45000, category: 'container', hours: 48, maneuvers: 2 },
  { imo: '1234567', name: 'FERRY SICILIA', port: 'Catania', gt: 28000, category: 'ro_ro', hours: 12, maneuvers: 2 },
  { imo: '5555555', name: 'BLUE STAR', port: 'Siracusa', gt: 8500, category: 'general_cargo', hours: 72, maneuvers: 2 },
  { imo: '7777777', name: 'COSTA BELLA', port: 'Catania', gt: 92000, category: 'cruise', hours: 10, maneuvers: 2 },
  { imo: '3333333', name: 'TANKER MARE', port: 'Augusta', gt: 55000, category: 'tanker', hours: 96, maneuvers: 2 },
];

function parseCSV(text: string): ShipEntry[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const ships: ShipEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 7) {
      ships.push({
        imo: cols[0] || '',
        name: cols[1] || '',
        port: cols[2] || '',
        gt: parseInt(cols[3]) || 0,
        category: cols[4] || 'general_cargo',
        hours: parseFloat(cols[5]) || 0,
        maneuvers: parseInt(cols[6]) || 2,
      });
    }
  }
  return ships;
}

function generateTemplateCSV(): string {
  return ['IMO,Nave,Porto,GT,Categoria,Ore_Porto,Manovre',
    '9876543,MSC AURORA,Augusta,45000,container,48,2',
    '1234567,FERRY SICILIA,Catania,28000,ro_ro,12,2'].join('\n');
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ShipImportStep({ onNext }: Props) {
  const [ships, setShips] = useState<ShipEntry[]>([]);
  const [imported, setImported] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setShips(parsed);
        localStorage.setItem('deasp_ships', JSON.stringify(parsed));
        setImported(true);
        setImportError('');
      } else {
        setImportError('Nessun dato trovato. Controlla il formato (7 colonne CSV).');
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleUseDemoData = () => {
    setShips(DEMO_SHIPS);
    localStorage.setItem('deasp_ships', JSON.stringify(DEMO_SHIPS));
    setImported(true);
    setImportError('');
  };

  const ports = [...new Set(ships.map(s => s.port))];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Ship className="w-5 h-5 text-[#6060FF]" />
          <span>Step 1: Import Dati Navi</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Carica il file con gli scali navali per il periodo di riferimento
        </p>
      </div>

      {!imported ? (
        <>
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragActive ? 'border-brand-blue bg-brand-blue/10' : 'border-surface-border bg-surface-hover'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-400 mb-2">Trascina qui il file CSV con i dati navi</p>
            <p className="text-xs text-gray-400 mb-4">
              Formato: .csv | Colonne: IMO, Nave, Porto, GT, Categoria, Ore in porto, Manovre
            </p>
            <div className="flex items-center justify-center space-x-3">
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90">
                Scegli File
              </button>
              <button onClick={() => downloadFile(generateTemplateCSV(), 'DEASP_navi_template.csv')}
                className="flex items-center space-x-1 px-4 py-2 text-sm border border-surface-border text-gray-300 rounded-lg hover:bg-surface-hover">
                <Download className="w-4 h-4" /><span>Scarica template DEASP navi.csv</span>
              </button>
            </div>
          </div>
          <div className="text-center">
            <button onClick={handleUseDemoData} className="text-xs text-gray-500 hover:text-[#6060FF] underline">
              Oppure carica dati demo (5 navi di esempio)
            </button>
          </div>
          {importError && (
            <div className="flex items-center space-x-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">{importError}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center space-x-3 p-4 bg-brand-green/5 border border-brand-green/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-brand-green/80" />
            <div>
              <p className="text-sm font-medium text-brand-green">
                Importazione completata: {ships.length} navi caricate
              </p>
              <p className="text-xs text-brand-green/80">
                0 errori | Porte: {ports.join(', ')} | GT classificato automaticamente
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Anteprima dati importati</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-hover border-b border-surface-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">IMO</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nave</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Porto</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">GT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Classe GT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Categoria</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Ore</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Manovre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {ships.map((ship) => (
                    <tr key={ship.imo} className="hover:bg-surface-hover">
                      <td className="px-3 py-2 font-mono text-gray-400">{ship.imo}</td>
                      <td className="px-3 py-2 font-medium text-white">{ship.name}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue">{ship.port}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{ship.gt.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {ship.gt < 5000 ? '1000-4999' : ship.gt < 25000 ? '5000-24999' : ship.gt < 50000 ? '25000-49999' : '50000+'}
                      </td>
                      <td className="px-3 py-2 capitalize">{ship.category.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-right">{ship.hours}</td>
                      <td className="px-3 py-2 text-right">{ship.maneuvers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end pt-4 border-t border-surface-border">
        <button onClick={onNext} disabled={!imported}
          className="px-6 py-2 text-sm primary-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
          Prosegui → Questionari Concessionari
        </button>
      </div>
    </div>
  );
}
