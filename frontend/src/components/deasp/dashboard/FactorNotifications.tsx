import { X, Bell, RefreshCw, FileText, BarChart3 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const DEMO_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Aggiornamento fattore ELETTRICITÀ',
    message: 'Il fattore di emissione per il mix elettrico nazionale è stato aggiornato da ISPRA:\n- Valore precedente: 0,00028 tCO₂/kWh (ISPRA 2023)\n- Nuovo valore: 0,00026 tCO₂/kWh (ISPRA 2024)\n- Variazione: -7,1%',
    severity: 'warning' as const,
    sent_at: '2024-06-15T10:00:00',
    is_read: false,
  },
  {
    id: '2',
    title: 'Nuova pubblicazione EMEP/EEA 2024',
    message: 'I fattori di emissione navali EMEP/EEA 2024 sono disponibili per revisione. I fattori per fuel oil e marine diesel sono confermati.',
    severity: 'info' as const,
    sent_at: '2024-07-01T08:00:00',
    is_read: false,
  },
  {
    id: '3',
    title: 'MIT Circolare n.123/2024',
    message: 'Nuove linee guida per la rendicontazione DEASP. Si raccomanda di verificare la conformità dei report.',
    severity: 'info' as const,
    sent_at: '2024-08-10T14:30:00',
    is_read: true,
  },
];

const SEVERITY_STYLES = {
  info: 'border-blue-500 bg-blue-50',
  warning: 'border-amber-500 bg-amber-50',
  critical: 'border-red-500 bg-red-50',
};

export default function FactorNotifications({ onClose }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <span>Notifiche Aggiornamenti Fattori</span>
        </h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {DEMO_NOTIFICATIONS.map((notif) => (
          <div
            key={notif.id}
            className={`border-l-4 rounded-r-lg p-4 ${SEVERITY_STYLES[notif.severity]} ${
              notif.is_read ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">{notif.title}</h4>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notif.sent_at).toLocaleDateString('it-IT', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
              {!notif.is_read && (
                <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />
              )}
            </div>

            {!notif.is_read && (
              <div className="mt-3 flex space-x-2">
                <button className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <RefreshCw className="w-3 h-3" />
                  <span>Ricalcola inventario</span>
                </button>
                <button className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <FileText className="w-3 h-3" />
                  <span>Dettagli</span>
                </button>
                <button className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <BarChart3 className="w-3 h-3" />
                  <span>Impatto</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Audit Trail Link */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Visualizza cronologia completa modifiche fattori →
        </button>
      </div>
    </div>
  );
}
