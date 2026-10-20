'use client';

// Fulfills Phase 43: Expanded 9-Step Interactive Spotlight Tutorial in Blueprint Editor
// Highlights all modern warehouse capabilities (Multi-Floor, Fleet, WMS Data Hub, Aisle Gen)
// with auto-mode transitions, localized strings, and initial state restoration.

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface TourStep {
  id: string;
  targetSelector: string;
  fallbackPosition?: 'center' | 'bottom-center' | 'top-right';
  badge: string;
  title: string;
  description: string;
  tips?: string[];
  stepKey: 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' | 'step8' | 'step9';
  sidebarTabRequired?: 'catalogue' | 'outliner';
  ensureInspectorOpen?: boolean;
  modeRequired?: 'LAYOUT' | 'WMS' | 'PICKING';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'step_navigation',
    targetSelector: '[data-tour="viewport-controls"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 1 DARI 9',
    title: 'Navigasi Kamera & Viewport 3D',
    description:
      'Gunakan mouse untuk mengontrol sudut pandang 3D secara bebas: Drag Klik Kiri untuk Orbit (memutar), Drag Klik Kanan untuk Pan (menggeser), dan Scroll Roda Mouse untuk Zoom. Beralih antara tampilan Perspektif 3D dan Top-Down 2D kapan saja.',
    tips: [
      'WASD / Tombol Panah: Geser kamera dengan keyboard',
      'Tombol F: Auto-fokus membidik objek yang dipilih',
      'Spasi / Tombol Home: Reset sudut pandang kamera',
    ],
    stepKey: 'step1',
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_catalogue',
    targetSelector: '[data-tour="asset-catalogue"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 2 DARI 9',
    title: 'Katalog Aset Industri & Generator Lorong',
    description:
      'Pilih dari berbagai jenis aset standar industri: Racks (Selective, Cantilever, Drive-In, Mezzanine), Structural (Columns, Walls, Dock Doors), dan Zones. Gunakan juga Generator Array Lorong otomatis untuk menyusun barisan rak dalam hitungan detik.',
    tips: [
      'Klik "+ Tambah" atau Drag-and-Drop langsung ke lantai 3D',
      'Filter dan cari cepat menggunakan kolom pencarian katalog',
      'Gunakan Generator Array Lorong untuk penataan lorong forklift otomatis',
    ],
    stepKey: 'step2',
    sidebarTabRequired: 'catalogue',
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_manipulation',
    targetSelector: '[data-tour="3d-canvas"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 3 DARI 9',
    title: 'Seleksi, Manipulasi Objek & Multi-Seleksi',
    description:
      'Klik objek apa saja di canvas untuk memilihnya. Geser objek secara langsung dengan snapping otomatis ke grid dan magnetik batas lorong, atau gunakan panah Gizmo. Gunakan Shift + Klik atau Marquee Box Drag untuk multi-seleksi banyak objek sekaligus.',
    tips: [
      'Tombol R: Putar objek 90° searah jarum jam',
      'Tombol Delete / Backspace: Hapus objek terpilih (didukung Undo)',
      'Shift + Drag di canvas: Seleksi kotak marquee multi-objek',
    ],
    stepKey: 'step3',
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_multi_floor',
    targetSelector: '[data-tour="level-selector"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 4 DARI 9',
    title: 'Multi-Floor Mezzanines & Konektor Vertikal',
    description:
      'Rancang fasilitas bertingkat hingga 4 lantai (Ground + Mezzanines). Hubungkan lantai dengan Lift Kargo, Tanjakan Ramp, atau Tangga Industri. Gunakan selektor lantai di HUD viewport untuk beralih lantai aktif dan aktifkan mode Isolate atau Ghosting.',
    tips: [
      'Tombol L1-L4 di toolbar viewport: Pilih lantai aktif yang sedang diedit',
      'Mode Isolate / Ghost: Sembunyikan atau buat lantai atas transparan',
      'Konektor Lift & Ramp: Membuka navigasi vertikal bagi armada & personil',
    ],
    stepKey: 'step4',
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_mode_switcher',
    targetSelector: '[data-tour="mode-switcher"]',
    fallbackPosition: 'top-right',
    badge: 'LANGKAH 5 DARI 9',
    title: 'Tiga Mode Kerja: Layout, WMS & Picking Route',
    description:
      'Bilah tengah ini memungkinkan Anda beralih instan di antara 3 mode kerja utama: (1) "Layout Builder" untuk merancang tata letak fisik fasilitas; (2) "WMS Inventory" untuk manajemen inventaris & analitik heatmap; serta (3) "Picking Route" untuk simulasi pergerakan armada dan optimasi rute pengambilan barang.',
    tips: [
      'Layout Builder: Rancang struktur fisik, penataan rak, dan zona fasilitas',
      'WMS Inventory: Kelola stok kargo, isi palet/bin, dan visualisasi Heatmap beban',
      'Picking Route: Simulasikan pesanan picking, rute optimal TSP 2-Opt, dan armada',
    ],
    stepKey: 'step5',
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_inspector_outliner',
    targetSelector: '[data-tour="properties-inspector"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 6 DARI 9',
    title: 'Properties Inspector & Outliner Pohon Scene',
    description:
      'Panel kanan memungkinkan Anda mengubah dimensi rak, jumlah bay & level, dimensi slot kargo, warna zona, hingga luas lantai fasilitas. Tab Outliner di sidebar kiri menampilkan seluruh pohon objek scene yang terpasang.',
    tips: [
      'Pilih objek di Outliner untuk auto-framing kamera seketika',
      'Tab Fasilitas & Grid: Ubah dimensi lantai dan tinggi plafon ruangan',
      'Semua konfigurasi terlindungi validasi batas keamanan struktural',
    ],
    stepKey: 'step6',
    ensureInspectorOpen: true,
    modeRequired: 'LAYOUT',
  },
  {
    id: 'step_wms_hub',
    targetSelector: '[data-tour="wms-hub-trigger"]',
    fallbackPosition: 'top-right',
    badge: 'LANGKAH 7 DARI 9',
    title: 'Enterprise WMS Data Hub & Slotting Optimizer',
    description:
      'Sinkronisasi inventaris massal dengan parser spreadsheet cerdas (CSV/TSV/JSON/Excel), pemetaan kolom otomatis, dan Dynamic Slotting Optimizer berbasis kecepatan ABC, Golden Zone ergonomis, serta klem beban berat dasar.',
    tips: [
      'Tab Impor/Ekspor: Tempel langsung dari Excel (Ctrl+V) atau unduh CSV/TSV',
      'Dynamic Slotting Optimizer: Hemat hingga 30%+ jarak tempuh picking rute',
      'Tab ERP Webhook: Simulasi integrasi SAP S/4HANA & Odoo via REST API',
    ],
    stepKey: 'step7',
    modeRequired: 'WMS',
  },
  {
    id: 'step_fleet_picking',
    targetSelector: '[data-tour="picking-manifest"]',
    fallbackPosition: 'center',
    badge: 'LANGKAH 8 DARI 9',
    title: 'Simulasi Multi-Agent Fleet & Optimalisasi Rute TSP',
    description:
      'Beralih ke mode "Picking Route" untuk menjalankan simulasi armada multi-kendaraan (Forklift, AGV Robot, Picking Trolley). Algoritma TSP 2-Opt & A* menghitung urutan perhentian paling efisien, didukung pelacakan kamera Follow-Cam dan status baterai.',
    tips: [
      'Tombol Putar / Spasi: Mulai dan jeda animasi navigasi armada',
      'Klik Garis Rute: Tambah waypoint transit kustom secara interaktif (Click-to-Split)',
      'Ikon Kamera di Roster Armada: Kunci sudut pandang kamera mengikuti kendaraan',
    ],
    stepKey: 'step8',
    modeRequired: 'PICKING',
  },
  {
    id: 'step_save_export',
    targetSelector: '[data-tour="save-export"]',
    fallbackPosition: 'top-right',
    badge: 'LANGKAH 9 DARI 9',
    title: 'Simpan Cloud Neon, Ekspor File & Proteksi Data',
    description:
      'Simpan blueprint Anda langsung ke database cloud Neon dengan menekan tombol "Save". Anda juga dapat mengekspor denah gudang ke format JSON standar industri atau mengunduh manifes inventaris bins dalam file CSV.',
    tips: [
      'Tombol Ctrl+Z / Ctrl+Y: Riwayat Undo & Redo hingga 30 langkah',
      'Proteksi Otomatis: Peringatan jika ingin keluar dengan perubahan belum tersimpan',
      'Klik nama fasilitas di header untuk mengganti nama secara instan',
    ],
    stepKey: 'step9',
  },
];

const STORAGE_KEY = 'warehouse_tour_dismissed';

interface GuidedTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChangeRequired?: (tab: 'catalogue' | 'outliner') => void;
  onEnsureInspectorOpen?: () => void;
  onModeChangeRequired?: (mode: 'LAYOUT' | 'WMS' | 'PICKING') => void;
  currentMode?: 'LAYOUT' | 'WMS' | 'PICKING';
}

export function GuidedTourOverlay(props: GuidedTourOverlayProps) {
  if (!props.isOpen) return null;
  return <GuidedTourOverlayContent {...props} />;
}

function GuidedTourOverlayContent({
  isOpen,
  onClose,
  onTabChangeRequired,
  onEnsureInspectorOpen,
  onModeChangeRequired,
  currentMode,
}: GuidedTourOverlayProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { t } = useTranslation();

  // Store the user's initial mode when the tour starts
  const [initialMode] = useState<'LAYOUT' | 'WMS' | 'PICKING' | undefined>(currentMode);

  const step = TOUR_STEPS[currentStepIndex];

  // Measure target DOM element coordinates and trigger required UI states
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !step) return;

    // Trigger mode transition if step requires a specific mode
    if (step.modeRequired && onModeChangeRequired && currentMode !== step.modeRequired) {
      onModeChangeRequired(step.modeRequired);
    }

    // Trigger sidebar tab or inspector expansion if required
    if (step.sidebarTabRequired && onTabChangeRequired) {
      onTabChangeRequired(step.sidebarTabRequired);
    }
    if (step.ensureInspectorOpen && onEnsureInspectorOpen) {
      onEnsureInspectorOpen();
    }

    // Allow slight delay for DOM to layout after mode/tab switch
    setTimeout(() => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Ensure element is visible on screen
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          return;
        }
      }
      setTargetRect(null);
    }, 100);
  }, [isOpen, step, onTabChangeRequired, onEnsureInspectorOpen, onModeChangeRequired, currentMode]);

  // Recalculate on step change or window resize
  useEffect(() => {
    if (!isOpen) return;
    updateTargetRect();

    const handleResize = () => updateTargetRect();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, currentStepIndex, updateTargetRect]);

  if (!isOpen || !step) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const restoreInitialMode = () => {
    if (initialMode && onModeChangeRequired && currentMode !== initialMode) {
      onModeChangeRequired(initialMode);
    }
  };

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Ignore localStorage quota errors
      }
    }
    restoreInitialMode();
    onClose();
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
    restoreInitialMode();
    onClose();
  };

  // Localized string resolution
  const stepData = t.tour ? t.tour[step.stepKey] : null;
  const title = stepData?.title ?? step.title;
  const description = stepData?.desc ?? step.description;
  const tips = stepData
    ? [stepData.tip1, stepData.tip2, stepData.tip3]
    : (step.tips ?? []);
  const badge = t.tour?.badge
    ? t.tour.badge
        .replace('{current}', String(currentStepIndex + 1))
        .replace('{total}', String(TOUR_STEPS.length))
    : step.badge;

  // Calculate position for the floating guide card
  const padding = 12;
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 60,
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - (targetRect.bottom + padding);
    const spaceAbove = targetRect.top - padding;
    const spaceRight = window.innerWidth - (targetRect.right + padding);
    const spaceLeft = targetRect.left - padding;

    // Prefer positioning next to the element
    if (spaceRight >= 420 && targetRect.left <= 450) {
      // Target is on left sidebar -> place card to right
      cardStyle = {
        ...cardStyle,
        top: Math.max(20, Math.min(targetRect.top, window.innerHeight - 380)),
        left: targetRect.right + padding + 10,
      };
    } else if (spaceLeft >= 420 && targetRect.right >= window.innerWidth - 450) {
      // Target is on right sidebar -> place card to left
      cardStyle = {
        ...cardStyle,
        top: Math.max(20, Math.min(targetRect.top, window.innerHeight - 380)),
        right: window.innerWidth - targetRect.left + padding + 10,
      };
    } else if (spaceBelow >= 320) {
      // Below target
      cardStyle = {
        ...cardStyle,
        top: targetRect.bottom + padding + 8,
        left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 450)),
      };
    } else if (spaceAbove >= 320) {
      // Above target
      cardStyle = {
        ...cardStyle,
        bottom: window.innerHeight - targetRect.top + padding + 8,
        left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 450)),
      };
    } else {
      // Center fallback
      cardStyle = {
        ...cardStyle,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
  } else {
    // Default center placement if target DOM element is not found
    cardStyle = {
      ...cardStyle,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Spotlight coordinates with safety padding
  const cutPad = 8;
  const cutX = targetRect ? Math.max(0, targetRect.left - cutPad) : 0;
  const cutY = targetRect ? Math.max(0, targetRect.top - cutPad) : 0;
  const cutW = targetRect ? targetRect.width + cutPad * 2 : 0;
  const cutH = targetRect ? targetRect.height + cutPad * 2 : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fade-in pointer-events-auto">
      {/* SVG Spotlight Mask */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none transition-all duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White covers entire viewport */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout reveals target */}
            {targetRect && (
              <rect
                x={cutX}
                y={cutY}
                width={cutW}
                height={cutH}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Semi-transparent dark overlay through the mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 8, 15, 0.72)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Glowing Pulsing Target Border */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-sky-400/90 shadow-[0_0_25px_rgba(56,189,248,0.45)] transition-all duration-300 animate-pulse"
          style={{
            left: cutX,
            top: cutY,
            width: cutW,
            height: cutH,
          }}
        />
      )}

      {/* Floating Glassmorphic Guide Card */}
      <div
        style={cardStyle}
        className="w-[430px] max-w-[94vw] rounded-2xl border border-sky-500/40 bg-white/95 dark:bg-neutral-950/95 p-5 shadow-2xl backdrop-blur-xl transition-all duration-200 text-slate-800 dark:text-neutral-100"
      >
        {/* Card Header with Step Badge and Close Button */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800/80 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-ping" />
            <span className="rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300 tracking-wider">
              {badge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
            title={t.tour?.close ?? 'Tutup'}
          >
            <span>{t.tour?.close ?? 'Tutup'}</span>
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Step Title & Description */}
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Keyboard Tips / Quick Highlights */}
        {tips && tips.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-neutral-800/70 bg-slate-50 dark:bg-neutral-900/60 p-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3 w-3 text-amber-500" strokeWidth={1.75} />
              <span>Tips & Shortcut</span>
            </span>
            <ul className="space-y-1 text-[11px] text-slate-700 dark:text-neutral-300">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-sky-500 dark:text-sky-400 font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step Navigation Dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {TOUR_STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStepIndex
                  ? 'w-6 bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                  : 'w-2 bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-500'
              }`}
              title={`Lompat ke langkah ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-neutral-800/80 pt-3">
          {/* Checkbox Don't show again */}
          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5"
            />
            <span>{t.tour?.dontShowAgain ?? 'Jangan tampilkan lagi'}</span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{t.tour?.back ?? 'Kembali'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 active:scale-95 transition flex items-center gap-1"
            >
              {isLastStep ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>{t.tour?.finish ?? 'Selesai'}</span>
                </>
              ) : (
                <>
                  <span>{t.tour?.next ?? 'Lanjut'}</span>
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
