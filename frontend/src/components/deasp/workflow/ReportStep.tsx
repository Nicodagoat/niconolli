import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, QrCode, CheckCircle, Globe } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const REPORT_TYPES = [
  {
    id: 'excel',
    title: 'Report Excel DEASP',
    desc: 'Include fogli: Riepilogo, Dettaglio Navi, Concessionari, Fattori_Applicati, Cronologia_Aggiornamenti',
    icon: <FileSpreadsheet className="w-8 h-8" />,
    format: 'XLSX',
    sheets: ['Riepilogo', 'Navi', 'Concessionari', 'Fattori_Applicati', 'Cronologia_Aggiornamenti'],
  },
  {
    id: 'pdf',
    title: 'Report PDF Esecutivo',
    desc: 'Report completo con grafici, metodologia, fonti normative, e QR code per documentazione online',
    icon: <FileText className="w-8 h-8" />,
    format: 'PDF',
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
    setTimeout(() => {
      setGenerating(null);
      setGenerated((prev) => new Set([...prev, id]));
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Download className="w-5 h-5 text-blue-600" />
          <span>Step 5: Generazione Report DEASP</span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Genera output conformi alla Direttiva Europea Ambiente Sistema Portuale con tracciabilità fattori
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TYPES.map((report) => (
          <div key={report.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">{report.icon}</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">{report.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{report.desc}</p>

                {'sheets' in report && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {report.sheets.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{s}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs text-gray-400">Formato: {report.format}</span>
                  {generated.has(report.id) && (
                    <span className="flex items-center space-x-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span>Generato</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating === report.id}
                  className="mt-3 flex items-center space-x-2 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  <Download className="w-3 h-3" />
                  <span>{generating === report.id ? 'Generazione...' : generated.has(report.id) ? 'Rigenera' : 'Genera'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conformity Section */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-green-800 flex items-center space-x-2 mb-3">
          <Globe className="w-4 h-4" />
          <span>Conformità e Tracciabilità</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-green-700">
          <div>
            <div className="font-semibold">Standard conformità</div>
            <p>DEASP - Direttiva Europea Ambiente Sistema Portuale</p>
          </div>
          <div>
            <div className="font-semibold">Fonti normative</div>
            <p>ISPRA 2024, EMEP/EEA 2023, IPCC AR6</p>
          </div>
          <div>
            <div className="font-semibold">Audit trail</div>
            <p>Ogni fattore utilizzato è registrato con fonte, anno e motivazione</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ← Indietro
        </button>
      </div>
    </div>
  );
}
