import { useState } from 'react';
import { FileText, Send, CheckCircle, Clock, AlertTriangle, XCircle, Mail } from 'lucide-react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const DEMO_QUESTIONNAIRES = [
  { id: '1', name: 'Terminal Container Augusta S.r.l.', port: 'Augusta', status: 'completed', pct: 100, email: 'tca@example.com' },
  { id: '2', name: 'Servizi Portuali Catania S.p.A.', port: 'Catania', status: 'completed', pct: 100, email: 'spc@example.com' },
  { id: '3', name: 'Depositi Costieri Augusta', port: 'Augusta', status: 'in_progress', pct: 65, email: 'dca@example.com' },
  { id: '4', name: 'Logistica Mare Siracusa', port: 'Siracusa', status: 'sent', pct: 0, email: 'lms@example.com' },
  { id: '5', name: 'Bunkeraggio Sicilia S.r.l.', port: 'Augusta', status: 'expired', pct: 0, email: 'bs@example.com' },
  { id: '6', name: 'Porto Cargo Catania', port: 'Catania', status: 'not_responded', pct: 0, email: 'pcc@example.com' },
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  completed: { icon: <CheckCircle className="w-4 h-4" />, label: 'Compilato', color: 'text-green-600 bg-green-50' },
  in_progress: { icon: <Clock className="w-4 h-4" />, label: 'In corso', color: 'text-blue-600 bg-blue-50' },
  sent: { icon: <Clock className="w-4 h-4" />, label: 'In attesa', color: 'text-amber-600 bg-amber-50' },
  expired: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Scaduto', color: 'text-orange-600 bg-orange-50' },
  not_responded: { icon: <XCircle className="w-4 h-4" />, label: 'Non risposto', color: 'text-red-600 bg-red-50' },
};

export default function QuestionnaireStep({ onNext, onBack }: Props) {
  const [sending, setSending] = useState(false);

  const completed = DEMO_QUESTIONNAIRES.filter(q => q.status === 'completed').length;
  const total = DEMO_QUESTIONNAIRES.length;
  const pct = Math.round(completed / total * 100);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>Step 2: Questionari Concessionari</span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Gestisci l'invio e la raccolta dei questionari per i concessionari portuali
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Stato risposte</span>
          <span className="text-sm font-bold text-gray-900">{completed}/{total} ({pct}%)</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={() => setSending(true)}
        className="flex items-center space-x-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Send className="w-4 h-4" />
        <span>Invia questionari a concessionari mancanti</span>
      </button>

      {/* Questionnaire Status Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concessionario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Porto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completamento</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DEMO_QUESTIONNAIRES.map((q) => {
              const statusCfg = STATUS_CONFIG[q.status];
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{q.name}</div>
                    <div className="text-xs text-gray-400">{q.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      {q.port}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.icon}
                      <span>{statusCfg.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${q.pct === 100 ? 'bg-green-500' : q.pct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                          style={{ width: `${q.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{q.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {q.status === 'completed' ? (
                      <button className="text-xs text-blue-600 hover:text-blue-700">Visualizza</button>
                    ) : (
                      <button className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-600">
                        <Mail className="w-3 h-3" />
                        <span>Sollecita</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ← Indietro
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Prosegui → Calcolo Emissioni
        </button>
      </div>
    </div>
  );
}
