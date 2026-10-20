'use client';

// Fulfills ARCHITECTURE.md Section 2 (app/page.tsx Dashboard Client):
// High-tech industrial command center featuring:
// - Global warehouse telemetry metrics (Facilities, Racks, Bins Capacity, Footprint)
// - Interactive 4-template starter launcher + custom dimension builder
// - Real-time search filter and dynamic sorting
// - Dual View: Modern Interactive Grid Cards vs Dense Table List
// - Glassmorphic design system with micro-animations and delete protection

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteWarehouseLayout,
  persistWarehouseLayout,
} from '@/app/actions/layout-actions';
import { exportBlueprintJson, parseImportedBlueprint } from '@/lib/io/blueprint-io';
import type { BlueprintSummary } from '@/app/actions/layout-actions';
import { CreateBlueprintModal } from './CreateBlueprintModal';
import { SettingsModal } from '@/components/common/SettingsModal';
import { useTranslation, formatWeight } from '@/lib/i18n';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { logoutAction } from '@/app/actions/auth-actions';
import type { AuthUser } from '@/lib/auth/types';
import {
  Settings,
  Download,
  Plus,
  Building2,
  Boxes,
  PackageCheck,
  Scale,
  AlertTriangle,
  X,
  Search,
  LayoutGrid,
  List,
  Warehouse,
  Sparkles,
  Trash2,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Lock,
} from 'lucide-react';

type SortOption = 'updated_desc' | 'name_asc' | 'racks_desc' | 'bins_desc';
type ViewMode = 'grid' | 'list';

export function DashboardClient({
  summaries,
  currentUser,
}: {
  summaries: BlueprintSummary[];
  currentUser?: AuthUser | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlueprintSummary | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Aggregated Telemetry Metrics
  const telemetry = useMemo(() => {
    let totalRacks = 0;
    let totalBins = 0;
    for (const s of summaries) {
      totalRacks += s.rackCount;
      totalBins += s.binCount;
    }
    return {
      totalFacilities: summaries.length,
      totalRacks,
      totalBins,
      estimatedVolumeTons: Math.round(totalBins * 0.8), // ~800kg average per pallet bin
    };
  }, [summaries]);

  // Filtered and Sorted Summaries
  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      .sort((a, b) => {
        if (sortBy === 'updated_desc') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'racks_desc') {
          return b.rackCount - a.rackCount;
        }
        if (sortBy === 'bins_desc') {
          return b.binCount - a.binCount;
        }
        return 0;
      });
  }, [summaries, searchQuery, sortBy]);

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteWarehouseLayout(pendingDelete.id);
    if (result.success) {
      setPendingDelete(null);
      router.refresh();
    } else {
      setError(result.error ?? 'Failed to delete blueprint');
    }
    setBusy(false);
  }

  function handleImportClick(): void {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);

    const parsed = parseImportedBlueprint(await file.text());
    if (!parsed.success) {
      setError(parsed.error);
      setBusy(false);
      return;
    }

    const result = await persistWarehouseLayout(parsed.blueprint);
    if (result.success) {
      router.push(`/editor/${parsed.blueprint.id}`);
    } else {
      setError(result.error ?? 'Failed to save imported blueprint');
      setBusy(false);
    }
  }

  return (
    <div
      suppressHydrationWarning
      className={`min-h-screen transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#0a0e17] text-neutral-100'
      } antialiased selection:bg-sky-500/30`}
    >
      {/* Subtle Background Mesh Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-sky-600/20 blur-[128px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-blue-600/15 blur-[128px]" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-teal-600/15 blur-[128px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Branding & Hero Header */}
        <header
          suppressHydrationWarning
          className={`rounded-3xl border ${
            theme === 'light'
              ? 'border-slate-200 bg-white/80 shadow-xl shadow-slate-200/50'
              : 'border-neutral-800/80 bg-neutral-900/60 shadow-2xl shadow-black/40'
          } p-6 sm:p-8 backdrop-blur-xl space-y-6`}
        >
          {/* User Profile & Auth Banner */}
          {currentUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-neutral-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-200 dark:bg-neutral-800 font-bold text-xs uppercase text-slate-700 dark:text-neutral-200">
                  {currentUser.name.slice(0, 2)}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>{currentUser.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        currentUser.role === 'ADMIN'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/50'
                          : currentUser.role === 'EDITOR'
                          ? 'bg-sky-950 text-sky-300 border border-sky-700/50'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentUser.role === 'ADMIN' && (
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/40 transition"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Manajemen User (RBAC)</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await logoutAction();
                    router.push('/login');
                    router.refresh();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-300 hover:text-rose-500 hover:border-rose-500/30 transition"
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/50 px-3 py-1 text-[11px] font-mono font-semibold text-sky-700 dark:text-sky-300 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
                <span>{t.dashboard.badge}</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t.dashboard.title}
              </h1>
              <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed" suppressHydrationWarning>
                {t.dashboard.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleImportFile(event)}
              />

              {/* Settings Modal Launcher */}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100/90 dark:bg-neutral-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-sky-500 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50 shadow-sm"
                title={t.common.settings}
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">{t.common.settings}</span>
              </button>

              {currentUser?.role === 'VIEWER' ? (
                <div
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2.5 text-xs font-semibold text-amber-300 select-none cursor-not-allowed opacity-90"
                  title="Mode Baca (Viewer): Hanya Admin dan Editor yang dapat membuat fasilitas baru"
                >
                  <Lock className="h-4 w-4 text-amber-400" />
                  <span>Mode Baca (Viewer)</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleImportClick}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-100/90 dark:bg-neutral-800/80 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-sky-500 hover:bg-slate-200/80 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50 shadow-sm"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.75} />
                    <span>Import JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/30 hover:from-sky-500 hover:to-blue-500 transition disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    <span>{t.dashboard.newBlueprint}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Telemetry Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-100/70 dark:bg-neutral-950/60 p-4 transition hover:border-slate-300 dark:hover:border-neutral-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                <span className="text-xs font-medium">{t.dashboard.metrics.facilities}</span>
                <Building2 className="h-4 w-4 text-slate-500 dark:text-neutral-400" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-neutral-100">
                {telemetry.totalFacilities}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-1">{t.dashboard.metrics.facilitiesSub}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-100/70 dark:bg-neutral-950/60 p-4 transition hover:border-slate-300 dark:hover:border-neutral-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                <span className="text-xs font-medium">{t.dashboard.metrics.racks}</span>
                <Boxes className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
                {telemetry.totalRacks}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-1">{t.dashboard.metrics.racksSub}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-100/70 dark:bg-neutral-950/60 p-4 transition hover:border-slate-300 dark:hover:border-neutral-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                <span className="text-xs font-medium">{t.dashboard.metrics.bins}</span>
                <PackageCheck className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {telemetry.totalBins.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-1">{t.dashboard.metrics.binsSub}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-100/70 dark:bg-neutral-950/60 p-4 transition hover:border-slate-300 dark:hover:border-neutral-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                <span className="text-xs font-medium">{t.dashboard.metrics.payload}</span>
                <Scale className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatWeight(telemetry.totalBins * 800, unitSystem)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-1">{t.dashboard.metrics.payloadSub}</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-800/80 bg-red-950/60 p-4 text-xs text-red-300 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" strokeWidth={1.75} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Filter, Search & View Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400 dark:text-neutral-500">
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search facilities by name…"
              className="w-full rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 py-2.5 pl-9 pr-4 text-xs text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 backdrop-blur-md focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-neutral-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-slate-800 dark:text-neutral-200 focus:border-sky-500 focus:outline-none transition cursor-pointer shadow-sm"
              >
                <option value="updated_desc">Recently Modified</option>
                <option value="name_asc">Name (A–Z)</option>
                <option value="racks_desc">Most Racks</option>
                <option value="bins_desc">Highest Capacity (Bins)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 p-0.5 shadow-inner">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
                }`}
                title="List View"
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Blueprint List / Grid Section */}
        {filteredSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/30 p-12 text-center backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800/60 mb-4">
              <Warehouse className="h-8 w-8 text-slate-400 dark:text-neutral-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-neutral-200">
              {searchQuery ? 'No facilities match your search' : 'No warehouse blueprints found'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm">
              {searchQuery
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Get started instantly by deploying an industry template or importing a blueprint.'}
            </p>
            <div className="mt-6 flex items-center gap-3">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-xs text-slate-700 dark:text-neutral-200 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-md shadow-sky-600/30"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                  <span>Explore Starter Templates</span>
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSummaries.map((summary) => (
              <div
                key={summary.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/60 p-6 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/40 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10"
              >
                <div>
                  {/* Card Top Pill & Icon */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 group-hover:border-sky-500/40 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition">
                      <Warehouse className="h-5 w-5 text-sky-500" strokeWidth={1.75} />
                    </div>
                    <span className="rounded-full border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-300">
                      3D TWIN
                    </span>
                  </div>

                  <Link
                    href={`/editor/${summary.id}`}
                    className="block font-bold text-base text-slate-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition truncate"
                  >
                    {summary.name}
                  </Link>

                  <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                    Updated{' '}
                    <span suppressHydrationWarning>
                      {new Date(summary.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {summary.updatedByName && (
                      <span className="block text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
                        Oleh: {summary.updatedByName}
                      </span>
                    )}
                  </p>

                  {/* Telemetry Stats Badges */}
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-50 dark:bg-neutral-950/50 p-2.5">
                      <span className="text-[10px] text-slate-500 dark:text-neutral-500 block">Racks</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
                        {summary.rackCount}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 dark:border-neutral-800/90 bg-slate-50 dark:bg-neutral-950/50 p-2.5">
                      <span className="text-[10px] text-slate-500 dark:text-neutral-500 block">Storage Slots</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                        {summary.binCount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500 dark:text-neutral-400">bins</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                  {currentUser?.role === 'VIEWER' ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Read-only</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setPendingDelete(summary)}
                      disabled={busy}
                      className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                      title="Delete Blueprint"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}

                  <Link
                    href={`/editor/${summary.id}`}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-200 group-hover:bg-sky-600 group-hover:text-white transition shadow-sm"
                  >
                    <span>Launch 3D</span>
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/60 overflow-hidden backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 text-slate-500 dark:text-neutral-400 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Facility Name</th>
                  <th className="px-6 py-3.5">Aisle Racks</th>
                  <th className="px-6 py-3.5">Storage Bins</th>
                  <th className="px-6 py-3.5">Last Synchronized</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-800/60">
                {filteredSummaries.map((summary) => (
                  <tr
                    key={summary.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/30 transition group"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-neutral-100 flex items-center gap-3">
                      <Warehouse className="h-4 w-4 text-sky-500 shrink-0" strokeWidth={1.75} />
                      <Link
                        href={`/editor/${summary.id}`}
                        className="hover:text-sky-600 dark:hover:text-sky-400 transition"
                      >
                        {summary.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-sky-600 dark:text-sky-400 font-medium">
                      {summary.rackCount}
                    </td>
                    <td className="px-6 py-4 font-mono text-amber-600 dark:text-amber-400 font-medium">
                      {summary.binCount.toLocaleString()} slots
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-neutral-400" suppressHydrationWarning>
                      {new Date(summary.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/editor/${summary.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition"
                      >
                        <span>Launch 3D</span>
                        <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
                      </Link>
                      {currentUser?.role !== 'VIEWER' && (
                        <button
                          onClick={() => setPendingDelete(summary)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-300 transition"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Blueprint Template Selector Modal */}
      <CreateBlueprintModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Global Settings & Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-4 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl shadow-slate-900/20 dark:shadow-black/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100">Delete Facility Blueprint</h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">Irreversible operational action</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/60 p-4 text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-slate-900 dark:text-neutral-100">{pendingDelete.name}</span>? This will
              cascade remove all <span className="font-semibold text-sky-600 dark:text-sky-400">{pendingDelete.rackCount} rack(s)</span> and{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingDelete.binCount} bin slot(s)</span> from Neon Postgres.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
                className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {busy ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
