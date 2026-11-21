'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

/**
 * Catches WebGL context losses or Three.js runtime render errors
 * preventing the entire warehouse editor and session from crashing.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[CanvasErrorBoundary] Three.js / WebGL render failure:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="relative h-full w-full flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl select-none z-20">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon Badge */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-semibold text-white tracking-tight mb-2">
              Gangguan Rendering Canvas 3D
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Konteks grafis WebGL terputus atau terjadi kesalahan runtime rendering 3D.
              Data tata letak gudang Anda tetap aman di state editor.
            </p>

            {this.state.error?.message && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 mb-5 text-left font-mono text-[11px] text-amber-300/90 break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-lg shadow-sky-600/30 transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Muat Ulang Canvas 3D
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Halaman
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
