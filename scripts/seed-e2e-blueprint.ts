// Seeds an empty blueprint for the E2E editor test.
// Usage: npx tsx scripts/seed-e2e-blueprint.ts

import 'dotenv/config';
import { persistWarehouseLayout } from '../src/app/actions/layout-actions';

const BLUEPRINT_ID = process.env.E2E_BLUEPRINT_ID ?? 'e2e-seed-blueprint';

async function main(): Promise<void> {
  const result = await persistWarehouseLayout({
    id: BLUEPRINT_ID,
    name: 'E2E Warehouse',
    gridSnapStep: 0.5,
    floorDimensions: { width: 60, height: 10, depth: 40 },
    zones: [],
    structuralElements: [],
    racks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!result.success) {
    throw new Error(result.error ?? 'seed failed');
  }
  console.log(`seeded blueprint ${BLUEPRINT_ID}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
