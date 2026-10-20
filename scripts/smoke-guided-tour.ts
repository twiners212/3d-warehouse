// Smoke test for Phase 43: Expanded 9-Step Interactive Spotlight Tour & Controls Overhaul
import { TOUR_STEPS, type TourStep } from '../src/components/editor/ui/GuidedTourOverlay';
import { id } from '../src/lib/i18n/id';
import { en } from '../src/lib/i18n/en';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('🧪 Starting Smoke Test: Expanded 9-Step Guided Spotlight Tour & Controls...\n');

  // Test 1: Verify exact number of steps (9 steps)
  assert(TOUR_STEPS.length === 9, `Tour contains exactly 9 steps (got ${TOUR_STEPS.length})`);

  // Test 2: Verify each step has valid properties and keys
  const expectedIds = [
    'step_navigation',
    'step_catalogue',
    'step_manipulation',
    'step_multi_floor',
    'step_mode_switcher',
    'step_inspector_outliner',
    'step_wms_hub',
    'step_fleet_picking',
    'step_save_export',
  ];

  TOUR_STEPS.forEach((step: TourStep, idx: number) => {
    assert(step.id === expectedIds[idx], `Step ${idx + 1} ID is "${expectedIds[idx]}"`);
    assert(
      step.badge === `LANGKAH ${idx + 1} DARI 9`,
      `Step ${idx + 1} badge is "LANGKAH ${idx + 1} DARI 9"`
    );
    assert(step.title.length > 5, `Step ${idx + 1} title is descriptive ("${step.title}")`);
    assert(
      step.description.length > 20,
      `Step ${idx + 1} description provides clear operational guidance`
    );
    assert(
      step.targetSelector.startsWith('[data-tour='),
      `Step ${idx + 1} has valid CSS attribute target selector "${step.targetSelector}"`
    );

    // Validate that i18n dictionaries contain localized step data for this stepKey
    const idStep = id.tour[step.stepKey];
    const enStep = en.tour[step.stepKey];
    assert(Boolean(idStep && idStep.title && idStep.desc), `ID dictionary has full content for ${step.stepKey}`);
    assert(Boolean(enStep && enStep.title && enStep.desc), `EN dictionary has full content for ${step.stepKey}`);
  });

  // Test 3: Verify specific step features & modern warehouse modules
  const catalogueStep = TOUR_STEPS.find((s) => s.id === 'step_catalogue');
  assert(
    catalogueStep?.sidebarTabRequired === 'catalogue',
    'Catalogue step requires "catalogue" tab activation'
  );

  const modeSwitcherStep = TOUR_STEPS.find((s) => s.id === 'step_mode_switcher');
  assert(
    modeSwitcherStep?.targetSelector === '[data-tour="mode-switcher"]',
    'Mode switcher step targets the mode-switcher pill in top nav'
  );
  assert(
    Boolean(modeSwitcherStep?.description.includes('Picking') && modeSwitcherStep?.title.includes('Picking')),
    'Step 5 explicitly explains Picking Route along with Layout Builder and WMS'
  );

  const inspectorStep = TOUR_STEPS.find((s) => s.id === 'step_inspector_outliner');
  assert(
    inspectorStep?.ensureInspectorOpen === true,
    'Inspector step ensures right sidebar is open'
  );

  const multiFloorStep = TOUR_STEPS.find((s) => s.id === 'step_multi_floor');
  assert(
    multiFloorStep?.targetSelector === '[data-tour="level-selector"]',
    'Multi-floor step targets the viewport level selector HUD'
  );

  const wmsHubStep = TOUR_STEPS.find((s) => s.id === 'step_wms_hub');
  assert(
    wmsHubStep?.targetSelector === '[data-tour="wms-hub-trigger"]',
    'WMS Hub step targets the toolbar Data Hub button'
  );
  assert(
    wmsHubStep?.modeRequired === 'WMS',
    'WMS Hub step operates within WMS mode'
  );

  const fleetStep = TOUR_STEPS.find((s) => s.id === 'step_fleet_picking');
  assert(
    fleetStep?.targetSelector === '[data-tour="picking-manifest"]',
    'Fleet step targets the picking manifest drawer'
  );
  assert(
    fleetStep?.modeRequired === 'PICKING',
    'Fleet step requires PICKING mode activation'
  );

  // Test 4: Mock Navigation sequence simulation across all 9 steps with mode transitions
  let currentIndex = 0;
  let simulatedMode: string = 'LAYOUT';
  const next = () => {
    if (currentIndex < TOUR_STEPS.length - 1) {
      currentIndex++;
      const nextStep = TOUR_STEPS[currentIndex];
      if (nextStep.modeRequired) {
        simulatedMode = nextStep.modeRequired;
      }
    }
  };
  const back = () => {
    if (currentIndex > 0) currentIndex--;
  };

  assert(currentIndex === 0, 'Initial step index is 0');
  next();
  assert(currentIndex === 1, 'Next advances to index 1');
  next();
  next();
  assert(currentIndex === 3, 'Advances to index 3 (Multi-Floor)');
  back();
  assert(currentIndex === 2, 'Back retreats to index 2 (Manipulation)');
  next(); // index 3
  next(); // index 4 (step 5: mode switcher)
  assert(currentIndex === 4, 'Reaches Step 5 (Mode Switcher)');
  next(); // index 5 (step 6: inspector)
  assert(currentIndex === 5, 'Reaches Step 6 (Inspector)');
  
  // Advance past Step 6 to Step 7 (WMS Data Hub - mode changes to WMS)
  next();
  assert(currentIndex === 6, 'Reaches Step 7 (WMS Data Hub) without looping back');
  assert(simulatedMode === 'WMS', 'Mode correctly switched to WMS at Step 7');
  
  // Advance to Step 8 (Fleet - mode changes to PICKING)
  next();
  assert(currentIndex === 7, 'Reaches Step 8 (Fleet Simulation) without looping back');
  assert(simulatedMode === 'PICKING', 'Mode correctly switched to PICKING at Step 8');
  
  // Advance to Step 9 (Save & Export)
  next();
  assert(currentIndex === 8, 'Can reach final Step 9 (Save & Export)');
  next();
  assert(currentIndex === 8, 'Next at last step stays clamped at index 8 and is ready to finish');

  // Test 5: Verify ControlsModal and QuickTips i18n completeness
  assert(Boolean(id.controlsGuide.title && en.controlsGuide.title), 'ControlsModal titles exist in ID and EN');
  assert(Boolean(id.controlsGuide.mouse.marquee && en.controlsGuide.mouse.marquee), 'ControlsModal marquee exists in ID and EN');
  assert(Boolean(id.controlsGuide.camera.levelSelect && en.controlsGuide.camera.levelSelect), 'ControlsModal levelSelect exists in ID and EN');
  assert(Boolean(id.controlsGuide.logistics.splitRoute && en.controlsGuide.logistics.splitRoute), 'ControlsModal splitRoute exists in ID and EN');
  assert(Boolean(id.quickTips.layout.marquee && en.quickTips.layout.marquee), 'QuickTips layout marquee exists in ID and EN');
  assert(Boolean(id.quickTips.wms.dataHub && en.quickTips.wms.dataHub), 'QuickTips WMS dataHub exists in ID and EN');
  assert(Boolean(id.quickTips.picking.splitRoute && en.quickTips.picking.splitRoute), 'QuickTips picking splitRoute exists in ID and EN');

  console.log('\n🎉 ALL GUIDED SPOTLIGHT TOUR & CONTROLS TESTS PASSED!');
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
