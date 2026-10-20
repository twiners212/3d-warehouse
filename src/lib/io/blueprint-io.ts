// Fulfills PRD.md Section 6 Phase 5: Export/Import handlers for JSON
// blueprints and CSV bin lists. Import re-validates through the same Zod
// contract used by server actions (single payload-boundary truth).

import { WarehouseBlueprintSchema } from '@/lib/validations/layout-schema';
import type { RackEntity, WarehouseLayoutBlueprint } from '@/types/layout';

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Downloads the full blueprint as a JSON file. */
export function exportBlueprintJson(blueprint: WarehouseLayoutBlueprint): void {
  const filename = `${blueprint.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-layout.json`;
  triggerDownload(JSON.stringify(blueprint, null, 2), filename, 'application/json');
}

const CSV_HEADER = [
  'bin_id',
  'rack_name',
  'rack_id',
  'bay_index',
  'level_index',
  'local_x',
  'local_y',
  'local_z',
  'width',
  'height',
  'depth',
  'max_weight_kg',
  'is_occupied',
  'sku',
  'product_name',
  'quantity',
  'unit',
  'lot_number',
  'weight_kg',
  'velocity_class',
] as const;

function csvEscape(value: string | number | boolean): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Downloads all bins across racks as a flat CSV (WMS import format). */
export function exportBinsCsv(blueprint: WarehouseLayoutBlueprint): void {
  const rows: string[] = [CSV_HEADER.join(',')];

  for (const rack of blueprint.racks) {
    for (const bin of rack.bins) {
      const sku = bin.skuData;
      rows.push(
        [
          bin.id,
          rack.name,
          bin.rackId,
          bin.bayIndex,
          bin.levelIndex,
          bin.relativePosition.x,
          bin.relativePosition.y,
          bin.relativePosition.z,
          bin.dimension.width,
          bin.dimension.height,
          bin.dimension.depth,
          bin.maxWeightKg,
          bin.isOccupied,
          sku?.sku ?? '',
          sku?.productName ?? '',
          sku?.quantity ?? 0,
          sku?.unit ?? '',
          sku?.lotNumber ?? '',
          sku?.weightKg ?? 0,
          sku?.velocityClass ?? '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }

  const filename = `${blueprint.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-bins.csv`;
  triggerDownload(rows.join('\n'), filename, 'text/csv');
}

export type ImportResult =
  | { success: true; blueprint: WarehouseLayoutBlueprint }
  | { success: false; error: string };

/**
 * Parses and validates an imported JSON blueprint. Fills in timestamps when
 * missing; spatial data is trusted only after the Zod gate passes.
 */
export function parseImportedBlueprint(rawJson: string): ImportResult {
  let unknown: unknown;
  try {
    unknown = JSON.parse(rawJson);
  } catch {
    return { success: false, error: 'File is not valid JSON.' };
  }

  const parsed = WarehouseBlueprintSchema.safeParse(unknown);
  if (!parsed.success) {
    return { success: false, error: `Blueprint failed validation: ${parsed.error.message}` };
  }

  const valid = parsed.data;
  const now = new Date().toISOString();
  const withTimestamps = unknown as { createdAt?: unknown };

  return {
    success: true,
    blueprint: {
      id: valid.id,
      name: valid.name,
      gridSnapStep: valid.gridSnapStep,
      floorDimensions: valid.floorDimensions,
      zones: valid.zones,
      structuralElements: valid.structuralElements,
      racks: valid.racks as RackEntity[],
      buildingLevels: valid.buildingLevels ?? [],
      verticalConnectors: valid.verticalConnectors ?? [],
      pickingConfig: valid.pickingConfig,
      createdAt:
        typeof withTimestamps.createdAt === 'string' ? withTimestamps.createdAt : now,
      updatedAt: now,
    },
  };
}
