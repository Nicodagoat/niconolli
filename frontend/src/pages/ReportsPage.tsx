import { useState } from 'react';
import { FileText, Download, Globe, BarChart3, Table, FileSpreadsheet } from 'lucide-react';
import { reportAPI, calculationAPI } from '../services/api';
import { useStore } from '../store';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  format: string;
  standard?: string;
}

const REPORTS: ReportCard[] = [
  {
    id: 'ghg-protocol',
    title: 'GHG Protocol Inventory',
    description: 'Complete GHG Protocol Corporate Standard-compliant inventory report with scope breakdowns.',
    icon: <Globe className="w-8 h-8" />,
    format: 'JSON / PDF',
    standard: 'GHG Protocol Corporate Standard',
  },
  {
    id: 'cdp',
    title: 'CDP Response Format',
    description: 'Data formatted for Carbon Disclosure Project climate change questionnaire.',
    icon: <FileText className="w-8 h-8" />,
    format: 'JSON',
    standard: 'CDP Climate Change',
  },
  {
    id: 'calculations-csv',
    title: 'Calculations Export',
    description: 'Export all calculation results including gas breakdowns and emission factors used.',
    icon: <Table className="w-8 h-8" />,
    format: 'CSV',
  },
  {
    id: 'activities-csv',
    title: 'Activity Data Export',
    description: 'Export all raw activity data entries for external analysis or auditing.',
    icon: <FileSpreadsheet className="w-8 h-8" />,
    format: 'CSV',
  },
];

export default function ReportsPage() {
  const currentInventory = useStore((s) => s.currentInventory);
  const summary = useStore((s) => s.summary);
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const handleGenerate = async (reportId: string) => {
    if (!currentInventory) {
      alert('Please select an inventory first');
      return;
    }
    setGenerating(reportId);
    try {
      switch (reportId) {
        case 'ghg-protocol': {
          const res = await reportAPI.ghgProtocol(currentInventory.id);
          setReportData(res.data);
          break;
        }
        case 'cdp': {
          const res = await reportAPI.cdp(currentInventory.id);
          setReportData(res.data);
          break;
        }
        case 'calculations-csv': {
          const res = await reportAPI.exportCalculationsCSV(currentInventory.id);
          downloadBlob(res.data, `emissions_${currentInventory.reporting_year}.csv`);
          break;
        }
        case 'activities-csv': {
          const res = await reportAPI.exportActivitiesCSV(currentInventory.id);
          downloadBlob(res.data, `activities_${currentInventory.reporting_year}.csv`);
          break;
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const downloadBlob = (data: Blob, filename: string) => {
    const url = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCalculateFirst = async () => {
    if (!currentInventory) return;
    try {
      const res = await calculationAPI.calculate(currentInventory.id);
      alert(`Calculated ${res.data.calculated} activities. Total: ${res.data.total_co2e_tonnes.toFixed(2)} tCO2e`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Calculation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Exports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate GHG Protocol-compliant reports and export data
          </p>
        </div>
        {currentInventory && (
          <button
            onClick={handleCalculateFirst}
            className="flex items-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Run Calculations</span>
          </button>
        )}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORTS.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                {report.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                <div className="flex items-center space-x-4 mt-3">
                  <span className="text-xs text-gray-400">Format: {report.format}</span>
                  {report.standard && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      {report.standard}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating === report.id}
                  className="mt-4 flex items-center space-x-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{generating === report.id ? 'Generating...' : 'Generate'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Preview */}
      {reportData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Preview</h3>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-96">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}

      {/* Standards Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Standards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'GHG Protocol', desc: 'Corporate Standard & Scope 3', status: 'Full' },
            { name: 'ISO 14064-1', desc: 'Org-level GHG quantification', status: 'Aligned' },
            { name: 'CDP', desc: 'Climate Change Disclosure', status: 'Export' },
            { name: 'GRI Standards', desc: 'Sustainability Reporting', status: 'Aligned' },
          ].map((std) => (
            <div key={std.name} className="border border-gray-100 rounded-lg p-3">
              <div className="text-sm font-semibold text-gray-900">{std.name}</div>
              <div className="text-xs text-gray-500 mt-1">{std.desc}</div>
              <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded">
                {std.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
