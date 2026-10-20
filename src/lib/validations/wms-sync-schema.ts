// Fulfills Phase 42: Zod contracts for External WMS / ERP Connector API payloads.

import { z } from 'zod';

export const WmsSyncItemSchema = z.object({
  binId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  productName: z.string().default('Product Item'),
  quantity: z.number().int().nonnegative().default(1),
  unit: z.string().default('pcs'),
  lotNumber: z.string().optional(),
  weightKg: z.number().nonnegative().default(10),
  velocityClass: z.enum(['A', 'B', 'C']).default('B'),
  expiryDate: z.string().optional(),
});

export type WmsSyncItem = z.infer<typeof WmsSyncItemSchema>;

export const WmsSyncPayloadSchema = z.object({
  blueprintId: z.string().min(1, 'blueprintId is required'),
  syncMode: z.enum(['DIRECT', 'UNALLOCATED', 'SLOTTING']).default('DIRECT'),
  conflictStrategy: z.enum(['OVERWRITE', 'SKIP']).default('OVERWRITE'),
  items: z.array(WmsSyncItemSchema).min(1, 'items array cannot be empty'),
});

export type WmsSyncPayload = z.infer<typeof WmsSyncPayloadSchema>;

export const WmsSyncResponseSchema = z.object({
  success: z.boolean(),
  blueprintId: z.string(),
  processedCount: z.number(),
  directMatchedCount: z.number(),
  unallocatedCount: z.number(),
  errors: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export type WmsSyncResponse = z.infer<typeof WmsSyncResponseSchema>;
