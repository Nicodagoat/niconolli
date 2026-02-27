import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(email, password);
      setToken(res.data.access_token);
      if (res.data.refresh_token) {
        localStorage.setItem('refresh_token', res.data.refresh_token);
      }
      if (res.data.user) {
        setUser(res.data.user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async () => {
    try {
      const res = await authAPI.setupAdmin();
      setEmail(res.data.email);
      setPassword(res.data.password);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Admin already exists');
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl primary-gradient flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">GHG Emissions Platform</h1>
          <p className="text-sm text-gray-400 mt-2">
            SME & Port Authority Carbon Accounting
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-card rounded-2xl border border-surface-border p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Sign In</h2>

          {error && (
            <div className="flex items-center space-x-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full rounded-lg bg-brand-dark border border-surface-border p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-lg bg-brand-dark border border-surface-border p-3 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 primary-gradient text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-xs text-gray-500 text-center mb-3">
              No account? Contact your platform administrator for an invitation.
            </p>
            <button
              onClick={handleSetupAdmin}
              className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 border border-surface-border rounded-lg hover:border-surface-hover transition-colors"
            >
              First time? Initialize Admin Account
            </button>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex items-center justify-center space-x-4 mt-6">
          <span className="text-xs text-gray-500 px-2 py-1 rounded bg-surface-card border border-surface-border">
            ISO 14064-1
          </span>
          <span className="text-xs text-gray-500 px-2 py-1 rounded bg-surface-card border border-surface-border">
            GHG Protocol
          </span>
          <span className="text-xs text-gray-500 px-2 py-1 rounded bg-surface-card border border-surface-border">
            DEASP Compliant
          </span>
        </div>
      </div>
    </div>
  );
}
