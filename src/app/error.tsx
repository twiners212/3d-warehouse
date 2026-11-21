'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[GlobalError] Application runtime error captured:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 shadow-[0_0_24px_rgba(245,158,11,0.2)]">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          Terjadi Kesalahan Sistem
        </h1>

        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Aplikasi mendeteksi gangguan tak terduga saat memproses permintaan Anda.
          Silakan coba ulangi operasi atau kembali ke Dashboard utama.
        </p>

        {error.message && (
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 mb-6 text-left font-mono text-xs text-amber-300/90 break-words max-h-32 overflow-y-auto">
            <span className="text-slate-500 select-none">$ </span>
            {error.message}
            {error.digest && (
              <div className="mt-1 text-[10px] text-slate-500 font-sans">
                Digest ID: {error.digest}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium shadow-lg shadow-sky-600/30 transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Coba Lagi
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-medium transition active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
