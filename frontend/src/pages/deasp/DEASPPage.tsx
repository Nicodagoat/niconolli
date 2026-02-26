import { useState } from 'react';
import { Anchor, Ship, FileText, Calculator, BarChart3, Download, Bell } from 'lucide-react';
import DEASPDashboard from '../../components/deasp/dashboard/DEASPDashboard';
import ShipImportStep from '../../components/deasp/workflow/ShipImportStep';
import QuestionnaireStep from '../../components/deasp/workflow/QuestionnaireStep';
import CalculationStep from '../../components/deasp/workflow/CalculationStep';
import ReportStep from '../../components/deasp/workflow/ReportStep';
import FactorNotifications from '../../components/deasp/dashboard/FactorNotifications';

type Tab = 'dashboard' | 'workflow';
type WorkflowStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { num: 1, label: 'Import Navi', icon: Ship, desc: 'Carica dati navi dal file Excel/CSV' },
  { num: 2, label: 'Questionari', icon: FileText, desc: 'Gestisci questionari concessionari' },
  { num: 3, label: 'Calcolo', icon: Calculator, desc: 'Calcola emissioni con fattori auto-aggiornanti' },
  { num: 4, label: 'Dashboard', icon: BarChart3, desc: 'Visualizza risultati e indicatori' },
  { num: 5, label: 'Report DEASP', icon: Download, desc: 'Genera output conformi al DEASP' },
];

export default function DEASPPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Anchor className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DEASP Italia</h1>
            <p className="text-sm text-gray-500">
              Direttiva Europea Ambiente Sistema Portuale - Rendicontazione emissioni
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>
        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <FactorNotifications onClose={() => setShowNotifications(false)} />
      )}

      {/* Tab Switcher */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Dashboard DEASP
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'workflow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Workflow (5 Step)
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && <DEASPDashboard />}

      {/* Workflow Tab */}
      {activeTab === 'workflow' && (
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.num as WorkflowStep)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                      currentStep === step.num
                        ? 'bg-blue-100 text-blue-700'
                        : currentStep > step.num
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      currentStep === step.num
                        ? 'bg-blue-600 text-white'
                        : currentStep > step.num
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {currentStep > step.num ? '✓' : step.num}
                    </div>
                    <div className="hidden lg:block text-left">
                      <div className="text-xs font-semibold">{step.label}</div>
                      <div className="text-xs opacity-70">{step.desc}</div>
                    </div>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={`hidden md:block w-8 h-0.5 mx-1 ${
                      currentStep > step.num ? 'bg-green-400' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {currentStep === 1 && <ShipImportStep onNext={() => setCurrentStep(2)} />}
            {currentStep === 2 && (
              <QuestionnaireStep
                onNext={() => setCurrentStep(3)}
                onBack={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <CalculationStep
                onNext={() => setCurrentStep(4)}
                onBack={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 4 && (
              <DEASPDashboard embedded />
            )}
            {currentStep === 5 && (
              <ReportStep onBack={() => setCurrentStep(4)} />
            )}
          </div>

          {/* Navigation */}
          {currentStep === 4 && (
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Indietro
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Genera Report DEASP
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
