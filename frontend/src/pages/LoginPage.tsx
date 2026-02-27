import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useStore } from '../store';

// Default credentials - client-side auth (no backend needed)
const DEFAULT_USERS = [
  {
    email: 'admin@ghgplatform.local',
    password: 'admin123!',
    user: {
      id: '1',
      email: 'admin@ghgplatform.local',
      full_name: 'Platform Administrator',
      role: 'admin',
    },
  },
  {
    email: 'demo@ghgplatform.local',
    password: 'demo123!',
    user: {
      id: '2',
      email: 'demo@ghgplatform.local',
      full_name: 'Demo User',
      role: 'sme_user',
    },
  },
];

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

    // Small delay to feel natural
    await new Promise((r) => setTimeout(r, 300));

    const match = DEFAULT_USERS.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password
    );

    if (match) {
      // Generate a simple token (client-side only)
      const token = btoa(JSON.stringify({ sub: match.user.id, email: match.user.email, role: match.user.role, iat: Date.now() }));
      setToken(token);
      setUser(match.user);
      navigate('/dashboard');
    } else {
      setError('Invalid email or password.');
    }

    setLoading(false);
  };

  const fillCredentials = (idx: number) => {
    setEmail(DEFAULT_USERS[idx].email);
    setPassword(DEFAULT_USERS[idx].password);
    setError('');
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

          {/* Quick login buttons */}
          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-xs text-gray-500 text-center mb-3">Quick access</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fillCredentials(0)}
                className="py-2 text-xs text-gray-400 hover:text-white border border-surface-border rounded-lg hover:border-brand-blue/50 transition-colors"
              >
                Admin Account
              </button>
              <button
                onClick={() => fillCredentials(1)}
                className="py-2 text-xs text-gray-400 hover:text-white border border-surface-border rounded-lg hover:border-brand-blue/50 transition-colors"
              >
                Demo User
              </button>
            </div>
          </div>
        </div>

        {/* Credentials hint */}
        <div className="mt-4 p-3 bg-surface-card/50 rounded-xl border border-surface-border">
          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            <span className="text-gray-400 font-medium">Admin:</span> admin@ghgplatform.local / admin123!
            <br />
            <span className="text-gray-400 font-medium">Demo:</span> demo@ghgplatform.local / demo123!
          </p>
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
