import { useState } from 'react';
import { Upload, Download, Ship, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const DEMO_SHIPS = [
  { imo: '9876543', name: 'MSC AURORA', port: 'Augusta', gt: 45000, category: 'container', hours: 48, maneuvers: 2 },
  { imo: '1234567', name: 'FERRY SICILIA', port: 'Catania', gt: 28000, category: 'ro_ro', hours: 12, maneuvers: 2 },
  { imo: '5555555', name: 'BLUE STAR', port: 'Siracusa', gt: 8500, category: 'general_cargo', hours: 72, maneuvers: 2 },
  { imo: '7777777', name: 'COSTA BELLA', port: 'Catania', gt: 92000, category: 'cruise', hours: 10, maneuvers: 2 },
  { imo: '3333333', name: 'TANKER MARE', port: 'Augusta', gt: 55000, category: 'tanker', hours: 96, maneuvers: 2 },
];

export default function ShipImportStep({ onNext }: Props) {
  const [imported, setImported] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleImport = () => {
    setImported(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Ship className="w-5 h-5 text-blue-600" />
          <span>Step 1: Import Dati Navi</span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Carica il file con gli scali navali per il periodo di riferimento
        </p>
      </div>

      {!imported ? (
        <>
          {/* Upload Area */}
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleImport(); }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Trascina qui il file Excel/CSV con i dati navi
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Formati supportati: .xlsx, .csv | Colonne: IMO, Nave, Porto, GT, Categoria MEET, Manovre, Ore in porto
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Scegli File
              </button>
              <button className="flex items-center space-x-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" />
                <span>Scarica template DEASP navi.xlsx</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Import Result */}
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Importazione completata: {DEMO_SHIPS.length} navi caricate
              </p>
              <p className="text-xs text-green-600">
                0 errori | Porte riconosciute: Augusta, Catania, Siracusa | GT classificato automaticamente
              </p>
            </div>
          </div>

          {/* Data Preview */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Anteprima dati importati</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">IMO</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nave</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Porto</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">GT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Classe GT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Categoria</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Ore</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Manovre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DEMO_SHIPS.map((ship) => (
                    <tr key={ship.imo} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-600">{ship.imo}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{ship.name}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                          {ship.port}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{ship.gt.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
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

      {/* Actions */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={onNext}
          disabled={!imported}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prosegui → Questionari Concessionari
        </button>
      </div>
    </div>
  );
}
