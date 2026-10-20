// Smoke test for Warehouse Templates and Telemetry Bus
import { WAREHOUSE_TEMPLATES } from '../src/lib/templates/warehouse-templates';
import { WarehouseBlueprintSchema } from '../src/lib/validations/layout-schema';
import { telemetryBus } from '../src/lib/telemetry/telemetry-bus';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('🧪 Starting Smoke Test: Templates & Telemetry...\n');

  // Test 1: Verify all 4 templates exist
  assert(WAREHOUSE_TEMPLATES.length === 4, 'Exactly 4 templates are defined');

  // Test 2: Validate each template against Zod schema
  for (const tmpl of WAREHOUSE_TEMPLATES) {
    const bp = tmpl.createBlueprint(`test-${tmpl.id}`);
    const validation = WarehouseBlueprintSchema.safeParse(bp);
    assert(
      validation.success,
      `Template "${tmpl.name}" satisfies WarehouseBlueprintSchema (Zod)`
    );

    if (tmpl.id === 'ecommerce_hub') {
      assert(bp.racks.length === 6, 'E-Commerce Hub has 6 racks');
      assert(bp.zones.length === 3, 'E-Commerce Hub has 3 zones');
      assert(bp.structuralElements.length === 5, 'E-Commerce Hub has 5 structural elements');
      const totalBins = bp.racks.reduce((acc, r) => acc + r.bins.length, 0);
      assert(totalBins === 192, `E-Commerce Hub has 192 bins (got ${totalBins})`);
    }

    if (tmpl.id === 'cold_storage') {
      assert(bp.racks.length === 4, 'Cold Storage has 4 racks');
      assert(bp.zones.length === 2, 'Cold Storage has 2 zones');
    }

    if (tmpl.id === 'cantilever_depot') {
      assert(bp.racks.length === 4, 'Cantilever Depot has 4 racks (including Mezzanine)');
      assert(bp.structuralElements.length === 4, 'Cantilever Depot has 4 structural elements');
    }
  }

  // Test 3: Test Telemetry Bus
  let receivedPos: { x: number; z: number } | null = null;
  const unsub = telemetryBus.subscribe((pos) => {
    receivedPos = pos;
  });

  telemetryBus.setCursorPos(14.53, 28.18);
  const posAfterSet = receivedPos as { x: number; z: number } | null;
  assert(
    posAfterSet !== null && posAfterSet.x === 14.5 && posAfterSet.z === 28.2,
    `Telemetry bus dispatches rounded coordinates: X: ${posAfterSet?.x}, Z: ${posAfterSet?.z}`
  );

  telemetryBus.clearCursorPos();
  const posAfterClear = receivedPos as { x: number; z: number } | null;
  assert(posAfterClear === null, 'Telemetry bus clears cursor position on leave');

  unsub();

  console.log('\n🎉 ALL TEMPLATES & TELEMETRY TESTS PASSED!');
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
