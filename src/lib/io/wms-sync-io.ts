// Fulfills Phase 42: External WMS / ERP Connector & Bulk Inventory Data Sync.
// Provides universal spreadsheet text parsing (CSV, TSV, Excel copy-paste),
// smart column mapping, validation, and full inventory export across racks and zones.

import type { BinSkuData, WarehouseLayoutBlueprint } from '@/types/layout';

export interface ColumnMapping {
  binIdCol?: number;
  skuCol?: number;
  productNameCol?: number;
  quantityCol?: number;
  unitCol?: number;
  lotNumberCol?: number;
  weightKgCol?: number;
  velocityClassCol?: number;
  expiryDateCol?: number;
}

export interface ParsedSpreadsheetRow {
  rowIndex: number;
  raw: string[];
}

export interface NormalizedInventoryItem {
  binId?: string; // If present, intended for direct location mapping
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  lotNumber: string;
  weightKg: number;
  velocityClass: 'A' | 'B' | 'C';
  expiryDate?: string;
  sourceRow: number;
}

export interface ParseAndValidateResult {
  headers: string[];
  mapping: ColumnMapping;
  directItems: NormalizedInventoryItem[]; // Has binId
  unallocatedItems: NormalizedInventoryItem[]; // No binId, ready for Slotting Optimizer
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
}

/**
 * Universal delimiter-aware spreadsheet parser.
 * Handles quoted fields, tabs (\t from Excel/Sheets clipboard), commas, and semicolons.
 */
export function parseSpreadsheetText(rawText: string): { headers: string[]; rows: ParsedSpreadsheetRow[] } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: prioritize Tab (\t), then Comma (,), then Semicolon (;)
  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (!firstLine.includes(',') && firstLine.includes(';')) {
    delimiter = ';';
  }

  const rawLines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rawLines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parsedMatrix = rawLines.map((line) => parseDelimitedLine(line, delimiter));
  const headers = parsedMatrix[0].map((h) => h.trim());
  const rows: ParsedSpreadsheetRow[] = parsedMatrix.slice(1).map((cells, idx) => ({
    rowIndex: idx + 2, // 1-indexed line in file (accounting for header)
    raw: cells.map((c) => c.trim()),
  }));

  return { headers, rows };
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const ALIASES: Record<keyof ColumnMapping, string[]> = {
  binIdCol: ['bin_id', 'bin', 'binid', 'location', 'lokasi', 'slot', 'slot_id', 'bin_slot', 'address', 'pallet_id', 'kode_bin'],
  skuCol: ['sku', 'item', 'item_code', 'item_id', 'product_code', 'kode_barang', 'part_number', 'sku_code', 'article'],
  productNameCol: ['name', 'product_name', 'product', 'item_name', 'nama_barang', 'nama', 'deskripsi', 'description', 'title'],
  quantityCol: ['quantity', 'qty', 'count', 'jumlah', 'kuantitas', 'stock', 'stok', 'total_qty'],
  unitCol: ['unit', 'uom', 'satuan', 'pack', 'pcs', 'box', 'karton'],
  lotNumberCol: ['lot', 'lot_number', 'lot_no', 'batch', 'batch_no', 'nomor_lot', 'no_lot', 'lot_id'],
  weightKgCol: ['weight', 'weight_kg', 'berat', 'berat_kg', 'gross_weight', 'kg', 'weightkg'],
  velocityClassCol: ['velocity', 'velocity_class', 'abc', 'kelas', 'kelas_abc', 'abc_class', 'velocity_abc', 'speed'],
  expiryDateCol: ['expiry', 'expiry_date', 'exp_date', 'kadaluarsa', 'expired', 'expiration'],
};

/**
 * Automatically detects column mapping based on standard enterprise WMS column naming aliases.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim());

  (Object.keys(ALIASES) as Array<keyof ColumnMapping>).forEach((field) => {
    const targetAliases = ALIASES[field];
    const foundIdx = normalizedHeaders.findIndex((hdr) =>
      targetAliases.some((alias) => hdr === alias || hdr.includes(alias))
    );
    if (foundIdx !== -1) {
      mapping[field] = foundIdx;
    }
  });

  return mapping;
}

/**
 * Validates parsed rows using the detected or configured column mapping.
 * Segregates into direct items (with bin_id) and unallocated items (without bin_id).
 */
export function validateAndTransformRows(
  rows: ParsedSpreadsheetRow[],
  mapping: ColumnMapping,
  headers: string[] = []
): ParseAndValidateResult {
  const directItems: NormalizedInventoryItem[] = [];
  const unallocatedItems: NormalizedInventoryItem[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rows.forEach((r) => {
    const getVal = (colIdx?: number) => (colIdx !== undefined && colIdx < r.raw.length ? r.raw[colIdx] : '');

    const rawBinId = getVal(mapping.binIdCol).trim();
    const rawSku = getVal(mapping.skuCol).trim();
    const rawName = getVal(mapping.productNameCol).trim();
    const rawQty = getVal(mapping.quantityCol).trim();
    const rawUnit = getVal(mapping.unitCol).trim() || 'pcs';
    const rawLot = getVal(mapping.lotNumberCol).trim();
    const rawWeight = getVal(mapping.weightKgCol).trim();
    const rawVelocity = getVal(mapping.velocityClassCol).trim().toUpperCase();
    const rawExpiry = getVal(mapping.expiryDateCol).trim();

    // Skip entirely empty row
    if (!rawBinId && !rawSku && !rawName && !rawQty) {
      return;
    }

    // Must have SKU or Product Name
    if (!rawSku && !rawName) {
      errors.push({ row: r.rowIndex, message: 'Baris wajib memiliki SKU atau Nama Barang.' });
      return;
    }

    const effectiveSku = rawSku || `SKU-${rawName.slice(0, 8).toUpperCase().replace(/\s+/g, '')}`;
    const effectiveName = rawName || effectiveSku;

    // Parse Quantity
    let qty = 1;
    if (rawQty) {
      const parsedQty = parseInt(rawQty, 10);
      if (isNaN(parsedQty) || parsedQty < 0) {
        errors.push({ row: r.rowIndex, message: `Kuantitas tidak valid: "${rawQty}". Harus angka >= 0.` });
        return;
      }
      qty = parsedQty;
    }

    // Parse Weight
    let weightKg = 10;
    if (rawWeight) {
      const parsedWeight = parseFloat(rawWeight.replace(/,/g, '.'));
      if (!isNaN(parsedWeight) && parsedWeight >= 0) {
        weightKg = parsedWeight;
      }
    }

    // Parse Velocity
    let velocityClass: 'A' | 'B' | 'C' = 'B';
    if (rawVelocity === 'A' || rawVelocity === 'B' || rawVelocity === 'C') {
      velocityClass = rawVelocity;
    } else if (rawVelocity.includes('FAST') || rawVelocity.includes('TINGGI')) {
      velocityClass = 'A';
    } else if (rawVelocity.includes('SLOW') || rawVelocity.includes('RENDAH')) {
      velocityClass = 'C';
    }

    const lotNumber = rawLot || `LOT-${new Date().toISOString().slice(2, 7).replace('-', '')}-${r.rowIndex}`;

    const normalizedItem: NormalizedInventoryItem = {
      binId: rawBinId || undefined,
      sku: effectiveSku,
      productName: effectiveName,
      quantity: qty,
      unit: rawUnit,
      lotNumber,
      weightKg,
      velocityClass,
      expiryDate: rawExpiry || undefined,
      sourceRow: r.rowIndex,
    };

    if (rawBinId) {
      directItems.push(normalizedItem);
    } else {
      unallocatedItems.push(normalizedItem);
    }
  });

  return {
    headers,
    mapping,
    directItems,
    unallocatedItems,
    errors,
    totalRows: rows.length,
  };
}

/**
 * Converts a normalized inventory item into standard BinSkuData.
 */
export function toBinSkuData(item: NormalizedInventoryItem): BinSkuData {
  return {
    sku: item.sku,
    productName: item.productName,
    quantity: item.quantity,
    unit: item.unit,
    lotNumber: item.lotNumber,
    weightKg: item.weightKg,
    velocityClass: item.velocityClass,
    expiryDate: item.expiryDate,
  };
}

// ==========================================
// Exporters: CSV, TSV, JSON (Racks + Zones)
// ==========================================

function csvEscape(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return /[",\t\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export const WMS_EXPORT_HEADERS = [
  'location_type',
  'location_id',
  'parent_entity',
  'floor_level',
  'status',
  'sku',
  'product_name',
  'quantity',
  'unit',
  'lot_number',
  'weight_kg',
  'velocity_class',
  'expiry_date',
] as const;

export interface FlatWmsInventoryRow {
  locationType: 'RACK_BIN' | 'ZONE_PALLET';
  locationId: string;
  parentEntity: string;
  floorLevel: string;
  status: 'OCCUPIED' | 'AVAILABLE';
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  lotNumber: string;
  weightKg: number;
  velocityClass: string;
  expiryDate: string;
}

export function extractAllWmsInventoryRows(blueprint: WarehouseLayoutBlueprint): FlatWmsInventoryRow[] {
  const result: FlatWmsInventoryRow[] = [];

  // 1. Rack Bins
  for (const rack of blueprint.racks) {
    const floor = rack.levelId ?? 'level-1';
    for (const bin of rack.bins) {
      const sku = bin.skuData;
      result.push({
        locationType: 'RACK_BIN',
        locationId: bin.id,
        parentEntity: rack.name,
        floorLevel: floor,
        status: bin.isOccupied ? 'OCCUPIED' : 'AVAILABLE',
        sku: sku?.sku ?? '',
        productName: sku?.productName ?? '',
        quantity: sku?.quantity ?? 0,
        unit: sku?.unit ?? 'pcs',
        lotNumber: sku?.lotNumber ?? '',
        weightKg: sku?.weightKg ?? 0,
        velocityClass: sku?.velocityClass ?? '',
        expiryDate: sku?.expiryDate ?? '',
      });
    }
  }

  // 2. Operational Zone Pallet Slots
  for (const zone of blueprint.zones) {
    const slots = zone.stagingConfig?.slots ?? [];
    const floor = zone.levelId ?? 'level-1';
    for (const slot of slots) {
      const sku = slot.skuData;
      result.push({
        locationType: 'ZONE_PALLET',
        locationId: slot.id,
        parentEntity: zone.name,
        floorLevel: floor,
        status: slot.isOccupied ? 'OCCUPIED' : 'AVAILABLE',
        sku: sku?.sku ?? '',
        productName: sku?.productName ?? '',
        quantity: sku?.quantity ?? 0,
        unit: sku?.unit ?? 'pcs',
        lotNumber: sku?.lotNumber ?? '',
        weightKg: sku?.weightKg ?? 0,
        velocityClass: sku?.velocityClass ?? '',
        expiryDate: sku?.expiryDate ?? '',
      });
    }
  }

  return result;
}

export function exportFullWmsInventoryCsv(blueprint: WarehouseLayoutBlueprint): string {
  const rows = extractAllWmsInventoryRows(blueprint);
  const csvLines: string[] = [WMS_EXPORT_HEADERS.join(',')];

  for (const r of rows) {
    csvLines.push(
      [
        r.locationType,
        r.locationId,
        r.parentEntity,
        r.floorLevel,
        r.status,
        r.sku,
        r.productName,
        r.quantity,
        r.unit,
        r.lotNumber,
        r.weightKg,
        r.velocityClass,
        r.expiryDate,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return csvLines.join('\n');
}

export function exportFullWmsInventoryTsv(blueprint: WarehouseLayoutBlueprint): string {
  const rows = extractAllWmsInventoryRows(blueprint);
  const tsvLines: string[] = [WMS_EXPORT_HEADERS.join('\t')];

  for (const r of rows) {
    tsvLines.push(
      [
        r.locationType,
        r.locationId,
        r.parentEntity,
        r.floorLevel,
        r.status,
        r.sku,
        r.productName,
        r.quantity,
        r.unit,
        r.lotNumber,
        r.weightKg,
        r.velocityClass,
        r.expiryDate,
      ]
        .map(csvEscape)
        .join('\t')
    );
  }

  return tsvLines.join('\n');
}

export function exportFullWmsInventoryJson(blueprint: WarehouseLayoutBlueprint): string {
  const rows = extractAllWmsInventoryRows(blueprint);
  return JSON.stringify(
    {
      blueprintId: blueprint.id,
      facilityName: blueprint.name,
      exportedAt: new Date().toISOString(),
      totalLocations: rows.length,
      occupiedLocations: rows.filter((r) => r.status === 'OCCUPIED').length,
      items: rows,
    },
    null,
    2
  );
}

/** Client-side helper to trigger file download */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
