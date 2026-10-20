'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/actions/auth-actions';
import {
  Boxes,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await loginAction({ email, password });
      if (res.success) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setErrorMessage(res.error ?? 'Gagal masuk. Periksa kembali email dan password.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-neutral-900/90 p-8 shadow-2xl backdrop-blur-xl">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 shadow-lg shadow-sky-500/25">
          <Boxes className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          3D Warehouse Manager
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Masuk untuk mengelola layout gudang dan inventaris
        </p>
      </div>

      {/* Error Callout */}
      {errorMessage && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Email Akun
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@warehouse.local"
              className="w-full rounded-xl border border-slate-700/80 bg-neutral-950/80 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700/80 bg-neutral-950/80 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>Masuk ke Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Credentials Switcher */}
      <div className="mt-6 border-t border-slate-800/80 pt-5">
        <div className="mb-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-medium">
            <UserCheck className="h-3.5 w-3.5 text-sky-400" />
            Pilih Akun Demo (RBAC)
          </span>
          <span className="text-[10px] text-slate-500">Klik untuk isi otomatis</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickFill('admin@warehouse.local', 'admin12345')}
            className="flex flex-col items-center rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-2 text-center transition hover:bg-indigo-900/40 hover:border-indigo-400"
          >
            <span className="text-[10px] font-bold text-indigo-300">ADMIN</span>
            <span className="text-[9px] text-slate-400">Full Access</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('editor@warehouse.local', 'editor12345')}
            className="flex flex-col items-center rounded-xl border border-sky-500/30 bg-sky-950/30 p-2 text-center transition hover:bg-sky-900/40 hover:border-sky-400"
          >
            <span className="text-[10px] font-bold text-sky-300">EDITOR</span>
            <span className="text-[9px] text-slate-400">Save Layout</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('viewer@warehouse.local', 'viewer12345')}
            className="flex flex-col items-center rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2 text-center transition hover:bg-emerald-900/40 hover:border-emerald-400"
          >
            <span className="text-[10px] font-bold text-emerald-300">VIEWER</span>
            <span className="text-[9px] text-slate-400">Read Only</span>
          </button>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
        <ShieldCheck className="h-3 w-3 text-emerald-400" />
        <span>Sesi login aktif selama 24 jam dengan cookie HTTP-Only</span>
      </div>
    </div>
  );
}
