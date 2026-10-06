import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { authService } from '@/services/authService';

interface LoginPageProps {
  notice?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ notice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const displayedError = error ?? (noticeDismissed ? null : notice ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNoticeDismissed(true);
    setLoading(true);

    try {
      await authService.signIn(email.trim(), password);
      // onAuthStateChange in useAuth will pick up the session automatically
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Surface friendly messages for common Supabase auth errors
        if (err.message.includes('Invalid login credentials')) {
          setError('Incorrect email or password. Please try again.');
        } else if (err.message.includes('Email not confirmed')) {
          setError('This account has not been confirmed. Contact your administrator.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center px-4">
      {/* Logo / Brand */}
      <div className="mb-8 flex flex-col items-center">
        <img
          src="/brownie-point-logo.png"
          alt="Brownie Point logo"
          className="mb-4 h-16 w-24 object-contain"
        />
        <h1 className="text-3xl font-bold text-white tracking-tight">BROWNIE POINT</h1>
        <p className="text-brand-300 text-sm mt-1">Operations System</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-brand-900 px-6 py-5 border-b border-brand-800">
          <h2 className="text-lg font-semibold text-white">Sign in to your account</h2>
          <p className="text-xs text-brand-300 mt-0.5">Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {/* Error Banner */}
          {displayedError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-60 disabled:bg-slate-50"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-60 disabled:bg-slate-50"
              placeholder="••••••••"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="px-6 pb-5 text-center text-xs text-slate-400">
          Access is managed by your administrator.
        </div>
      </div>

      <p className="mt-8 text-xs text-brand-600">
        &copy; {new Date().getFullYear()} Brownie Point Operations System
      </p>
    </div>
  );
};
