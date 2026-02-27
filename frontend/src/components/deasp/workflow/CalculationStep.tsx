import { useState } from 'react';
import { Calculator, CheckCircle, Database, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const DEMO_FACTORS_USED = [
  { category: 'Elettricità', name: 'Mix nazionale', value: '0,00026', unit: 'tCO₂/kWh', source: 'ISPRA 2024', confidence: '95%' },
  { category: 'Gasolio', name: 'Autotrazione', value: '3,155', unit: 'tCO₂/tep', source: 'ISPRA 2024', confidence: '97%' },
  { category: 'Navi', name: 'Fuel oil (HFO)', value: '3,114', unit: 'tCO₂/t', source: 'EMEP/EEA 2023', confidence: '90%' },
  { category: 'Navi', name: 'Marine diesel', value: '3,206', unit: 'tCO₂/t', source: 'EMEP/EEA 2023', confidence: '90%' },
  { category: 'Macchinari', name: 'Carrello diesel', value: '0,00265', unit: 'tCO₂/litro', source: 'ISPRA 2024', confidence: '80%' },
  { category: 'Veicoli', name: 'Auto diesel', value: '0,000171', unit: 'tCO₂/km', source: 'ISPRA 2024', confidence: '85%' },
];

export default function CalculationStep({ onNext, onBack }: Props) {
  const [calculating, setCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const handleCalculate = () => {
    setCalculating(true);
    setTimeout(() => {
      setCalculating(false);
      setCalculated(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <span>Step 3: Calcolo Emissioni</span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Calcola le emissioni utilizzando i fattori auto-aggiornanti più recenti
        </p>
      </div>

      {/* Factors Used */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Fattori di emissione selezionati automaticamente</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Categoria</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Nome</th>
                <th className="px-2 py-2 text-right font-medium text-gray-500">Valore</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Unità</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Fonte</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500">Confidenza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {DEMO_FACTORS_USED.map((f, i) => (
                <tr key={i}>
                  <td className="px-2 py-2 font-medium text-gray-800">{f.category}</td>
                  <td className="px-2 py-2 text-gray-600">{f.name}</td>
                  <td className="px-2 py-2 text-right font-mono">{f.value}</td>
                  <td className="px-2 py-2 text-gray-500">{f.unit}</td>
                  <td className="px-2 py-2">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{f.source}</span>
                  </td>
                  <td className="px-2 py-2 text-center">{f.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Gerarchia priorità: Specifico Azienda → ZES → ISPRA Nazionale → EMEP/EEA → IPCC
        </p>
      </div>

      {/* Calculate Button */}
      {!calculated ? (
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="w-full flex items-center justify-center space-x-2 px-6 py-4 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {calculating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Calcolo in corso... Applicazione fattori ISPRA/EMEP più recenti</span>
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              <span>Avvia Calcolo Emissioni DEASP</span>
            </>
          )}
        </button>
      ) : (
        <>
          {/* Results Summary */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-bold text-green-800">Calcolo completato</p>
                <p className="text-xs text-green-600">
                  1,247 scali navali + 6 questionari concessionari elaborati
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">29.500</div>
              <div className="text-xs text-gray-500 mt-1">tCO₂ - Emissioni Navi</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">8.900</div>
              <div className="text-xs text-gray-500 mt-1">tCO₂ - Concessionari</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">38.400</div>
              <div className="text-xs text-gray-500 mt-1">tCO₂ - Totale Sistema</div>
            </div>
          </div>

          {/* Audit info */}
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p>Ogni selezione di fattore è stata registrata nell'audit trail per tracciabilità completa.</p>
            <p className="mt-1">Fattori utilizzati: ISPRA 2024 (60%), EMEP/EEA 2023 (25%), IPCC 2006 (15%)</p>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ← Indietro
        </button>
        <button
          onClick={onNext}
          disabled={!calculated}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Prosegui → Dashboard Risultati
        </button>
      </div>
    </div>
  );
}
