import { Ship, Factory, Zap, TrendingDown, Database, Bell, MapPin, BarChart3 } from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';

interface Props {
  embedded?: boolean;
}

// Demo data
const DEMO_PORT_DATA = [
  { port: 'Augusta', navi_co2: 12500, concessionari_co2: 3200, total: 15700 },
  { port: 'Catania', navi_co2: 8900, concessionari_co2: 2800, total: 11700 },
  { port: 'Siracusa', navi_co2: 4200, concessionari_co2: 1500, total: 5700 },
  { port: 'Pozzallo', navi_co2: 2100, concessionari_co2: 800, total: 2900 },
  { port: 'Gela', navi_co2: 1800, concessionari_co2: 600, total: 2400 },
];

const DEMO_SOURCE_DIST = [
  { name: 'ISPRA', value: 60, color: '#3b82f6' },
  { name: 'EMEP/EEA', value: 25, color: '#f59e0b' },
  { name: 'IPCC', value: 15, color: '#6b7280' },
];

const DEMO_FACTOR_HISTORY = [
  { anno: '2020', elettricita: 0.000340, gasolio: 3.155 },
  { anno: '2021', elettricita: 0.000320, gasolio: 3.155 },
  { anno: '2022', elettricita: 0.000310, gasolio: 3.155 },
  { anno: '2023', elettricita: 0.000280, gasolio: 3.155 },
  { anno: '2024', elettricita: 0.000260, gasolio: 3.155 },
];

const DEMO_CATEGORY_SPLIT = [
  { name: 'Navi (hotelling)', value: 22400, color: '#3b82f6' },
  { name: 'Navi (manovra)', value: 5600, color: '#60a5fa' },
  { name: 'Concessionari Scope 1', value: 5800, color: '#ef4444' },
  { name: 'Concessionari Scope 2', value: 3200, color: '#f59e0b' },
  { name: 'Macchinari', value: 1400, color: '#8b5cf6' },
];

export default function DEASPDashboard({ embedded = false }: Props) {
  const total = DEMO_PORT_DATA.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard DEASP</h2>
          <p className="text-sm text-gray-500">
            Panoramica emissioni sistema portuale - Anno 2024 (Dati demo)
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Emissioni Totali Sistema"
          value={`${(total / 1000).toFixed(1)}k tCO2`}
          subtitle="5 porti, 38 concessionari"
          icon={<BarChart3 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Emissioni Navi"
          value={`${(DEMO_PORT_DATA.reduce((s, p) => s + p.navi_co2, 0) / 1000).toFixed(1)}k tCO2`}
          subtitle="1,247 scali registrati"
          icon={<Ship className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Emissioni Concessionari"
          value={`${(DEMO_PORT_DATA.reduce((s, p) => s + p.concessionari_co2, 0) / 1000).toFixed(1)}k tCO2`}
          subtitle="67% questionari completati"
          icon={<Factory className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Fattori Attivi"
          value="32"
          subtitle="3 aggiornati questo mese"
          icon={<Database className="w-6 h-6" />}
          color="green"
        />
      </div>

      {/* Novità normative */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center space-x-2">
          <Bell className="w-4 h-4" />
          <span>Novità Normative</span>
        </h3>
        <div className="space-y-1 text-sm text-blue-700">
          <p>ISPRA ha pubblicato nuovi fattori emissione 2024 (15/06/2024)</p>
          <p>EMEP/EEA Guidebook 2024 disponibile per revisione</p>
          <p>MIT Circolare n.123/2024: nuove linee guida DEASP</p>
        </div>
      </div>

      {/* Charts Row 1: Port comparison and category split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Emissioni per Porto</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={DEMO_PORT_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="port" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO2`, '']} />
              <Legend />
              <Bar dataKey="navi_co2" name="Navi" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="concessionari_co2" name="Concessionari" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ripartizione Emissioni</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={DEMO_CATEGORY_SPLIT}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {DEMO_CATEGORY_SPLIT.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO2`, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Factor sources and factor evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fonti Fattori di Emissione</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={DEMO_SOURCE_DIST}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {DEMO_SOURCE_DIST.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evoluzione Fattore Elettricità</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={DEMO_FACTOR_HISTORY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="anno" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="elettricita"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Elettricità (tCO2/kWh)"
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">
            Trend: -7,1% dal 2023 al 2024 (fonte ISPRA)
          </p>
        </div>
      </div>
    </div>
  );
}
