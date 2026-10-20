'use server';

// Fulfills PRD.md Section 5 Persistence & Batching and ARCHITECTURE.md
// Section 2 (actions/layout-actions.ts). Every payload boundary validates
// through Zod before touching the database.
//
// Transaction note (PROGRESS.md): the neon-http driver does not support
// interactive transactions, so persistence uses chunked batch statements;
// node-postgres (local dev DB) runs inside a real transaction.

import { count, eq, asc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { db, supportsTransactions } from '@/db';
import * as schema from '@/db/schema';
import { BIN_BATCH_CHUNK_SIZE, generateMockSkuData } from '@/lib/constants/warehouse-defaults';
import { generateBinId } from '@/engine/procedural/bin-generator';
import { WarehouseBlueprintSchema } from '@/lib/validations/layout-schema';
import type { WarehouseLayoutBlueprint } from '@/types/layout';
import { getAuthSession } from '@/lib/auth/session';
import type { SessionData } from '@/lib/auth/types';

type Database = typeof db;
type Executor = Database | NodePgDatabase<typeof schema>;

/**
 * Resolves the authenticated session.
 * Inside Next.js runtime, uses getAuthSession() (reading HTTP cookies).
 * Outside Next.js (CLI scripts / testing), uses internalSession or falls back to seeded admin.
 */
async function resolveActionSession(
  internalSession?: SessionData
): Promise<SessionData | null> {
  // If an explicit server-side internal session was provided (API route or background task), prioritize it
  if (internalSession) {
    return internalSession;
  }

  let isNextJsContext = false;
  try {
    await cookies();
    isNextJsContext = true;
  } catch {
    isNextJsContext = false;
  }

  if (isNextJsContext) {
    return getAuthSession();
  }

  const adminUsers = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'ADMIN'))
    .limit(1);

  if (adminUsers.length > 0) {
    const admin = adminUsers[0];
    return {
      session: {
        id: 'cli-system-session',
        userId: admin.id,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        createdAt: new Date(),
      },
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  return null;
}

/**
 * Runs fn in a real transaction when the driver supports it (node-postgres).
 * neon-http throws on db.transaction(), so it falls back to sequential
 * batched statements — each statement is idempotent under the cascade-replace
 * strategy, so a mid-flight failure is healed by the next save.
 */
async function withTransaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  if (supportsTransactions) {
    return (db as unknown as NodePgDatabase<typeof schema>).transaction(fn);
  }
  return fn(db);
}

export interface ActionResult {
  success: boolean;
  error?: string;
  blueprintId?: string;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Validates and persists a full blueprint atomically (upsert + cascade replace). */
export async function persistWarehouseLayout(
  blueprint: WarehouseLayoutBlueprint,
  internalSession?: SessionData
): Promise<ActionResult> {
  const sessionData = await resolveActionSession(internalSession);
  if (!sessionData) {
    return {
      success: false,
      error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
    };
  }

  if (sessionData.user.role === 'VIEWER') {
    return {
      success: false,
      error: 'Akses ditolak: Role Viewer hanya memiliki izin baca dan tidak dapat menyimpan layout.',
    };
  }

  const parsed = WarehouseBlueprintSchema.safeParse(blueprint);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }
  const valid = parsed.data;

  try {
    await withTransaction(async (tx) => {
      // 0. Query existing blueprint to preserve createdBy if already set
      const existing = await tx
        .select({ createdBy: schema.warehouseBlueprints.createdBy })
        .from(schema.warehouseBlueprints)
        .where(eq(schema.warehouseBlueprints.id, valid.id))
        .limit(1);

      const createdBy = existing[0]?.createdBy ?? sessionData.user.id;
      const updatedBy = sessionData.user.id;

      // 1. Upsert blueprint metadata
      await tx
        .insert(schema.warehouseBlueprints)
        .values({
          id: valid.id,
          name: valid.name,
          gridSnapStep: valid.gridSnapStep,
          floorDimensions: valid.floorDimensions,
          zonesData: valid.zones,
          structuralElements: valid.structuralElements,
          buildingLevels: valid.buildingLevels ?? [],
          verticalConnectors: valid.verticalConnectors ?? [],
          pickingConfig: valid.pickingConfig ?? null,
          createdBy,
          updatedBy,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.warehouseBlueprints.id,
          set: {
            name: valid.name,
            gridSnapStep: valid.gridSnapStep,
            floorDimensions: valid.floorDimensions,
            zonesData: valid.zones,
            structuralElements: valid.structuralElements,
            buildingLevels: valid.buildingLevels ?? [],
            verticalConnectors: valid.verticalConnectors ?? [],
            pickingConfig: valid.pickingConfig ?? null,
            updatedBy,
            updatedAt: new Date(),
          },
        });

      // 2. Cascade replace racks + bins (bins cascade via FK, delete explicitly anyway)
      await tx.delete(schema.inventoryBins).where(eq(schema.inventoryBins.blueprintId, valid.id));
      await tx.delete(schema.racks).where(eq(schema.racks.blueprintId, valid.id));

      if (valid.racks.length === 0) return;

      // 3. Insert racks
      await tx.insert(schema.racks).values(
        valid.racks.map((r) => ({
          id: r.id,
          blueprintId: valid.id,
          name: r.name,
          type: r.type,
          position: r.position,
          rotationY: r.rotationY,
          dimensions: r.dimensions,
          bays: r.bays,
          levels: r.levels,
          bayWidth: r.bayWidth,
          bayDepth: r.bayDepth,
          levelHeight: r.levelHeight,
          levelId: r.levelId ?? 'level-1',
        }))
      );

      // 4. Chunked bin inserts respecting Neon HTTP payload boundaries
      const allBins = valid.racks.flatMap((r) =>
        r.bins.map((b) => ({
          id: `${valid.id}:${r.id}:${b.id}`,
          rackId: r.id,
          blueprintId: valid.id,
          bayIndex: b.bayIndex,
          levelIndex: b.levelIndex,
          slotPosition: b.slotPosition ?? null,
          relativePosition: b.relativePosition,
          dimension: b.dimension,
          maxWeightKg: b.maxWeightKg,
          isOccupied: b.isOccupied,
          skuData: b.skuData ?? null,
        }))
      );

      for (const chunk of chunkArray(allBins, BIN_BATCH_CHUNK_SIZE)) {
        await tx.insert(schema.inventoryBins).values(chunk);
      }
    });

    try {
      revalidatePath('/');
      revalidatePath(`/editor/${valid.id}`);
    } catch {
      // In non-Next server environments (e.g. CLI scripts), revalidatePath may no-op
    }

    return { success: true, blueprintId: valid.id };
  } catch (error) {
    console.error('persistWarehouseLayout failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/** Loads a fully reassembled blueprint (metadata + racks + bins). */
export async function getWarehouseLayout(
  blueprintId: string
): Promise<WarehouseLayoutBlueprint | null> {
  const [meta] = await db
    .select()
    .from(schema.warehouseBlueprints)
    .where(eq(schema.warehouseBlueprints.id, blueprintId))
    .limit(1);

  if (!meta) return null;

  const rackRows = await db
    .select()
    .from(schema.racks)
    .where(eq(schema.racks.blueprintId, blueprintId));

  const binRows = await db
    .select()
    .from(schema.inventoryBins)
    .where(eq(schema.inventoryBins.blueprintId, blueprintId))
    .orderBy(
      asc(schema.inventoryBins.bayIndex),
      asc(schema.inventoryBins.levelIndex),
      asc(schema.inventoryBins.slotPosition)
    );

  return {
    id: meta.id,
    name: meta.name,
    floorDimensions: meta.floorDimensions,
    gridSnapStep: meta.gridSnapStep,
    zones: meta.zonesData,
    structuralElements: meta.structuralElements,
    buildingLevels: meta.buildingLevels ?? [],
    verticalConnectors: meta.verticalConnectors ?? [],
    pickingConfig: meta.pickingConfig ?? undefined,
    racks: rackRows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      position: r.position,
      rotationY: r.rotationY,
      dimensions: r.dimensions,
      bays: r.bays,
      levels: r.levels,
      bayWidth: r.bayWidth,
      bayDepth: r.bayDepth,
      levelHeight: r.levelHeight,
      levelId: r.levelId ?? 'level-1',
      bins: binRows
        .filter((b) => b.rackId === r.id)
        .map((b) => {
          const canonicalId = b.id.includes(':')
            ? b.id.split(':').slice(2).join(':')
            : generateBinId(r.name, b.bayIndex, b.levelIndex, b.slotPosition ?? undefined);
          return {
            id: canonicalId,
            rackId: b.rackId,
            bayIndex: b.bayIndex,
            levelIndex: b.levelIndex,
            slotPosition: b.slotPosition ?? undefined,
            relativePosition: b.relativePosition,
            dimension: b.dimension,
            maxWeightKg: b.maxWeightKg,
            isOccupied: b.isOccupied,
            skuData: b.skuData ?? (b.isOccupied ? generateMockSkuData(canonicalId) : undefined),
          };
        }),
    })),
    createdAt: meta.createdAt.toISOString(),
    updatedAt: meta.updatedAt.toISOString(),
  };
}

export interface BlueprintSummary {
  id: string;
  name: string;
  rackCount: number;
  binCount: number;
  updatedAt: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

export async function listWarehouseLayouts(): Promise<BlueprintSummary[]> {
  const metas = await db
    .select({
      id: schema.warehouseBlueprints.id,
      name: schema.warehouseBlueprints.name,
      updatedAt: schema.warehouseBlueprints.updatedAt,
      updatedBy: schema.warehouseBlueprints.updatedBy,
      updatedByName: schema.users.name,
    })
    .from(schema.warehouseBlueprints)
    .leftJoin(schema.users, eq(schema.warehouseBlueprints.updatedBy, schema.users.id));

  const rackRows = await db.select().from(schema.racks);
  const binCounts = await db
    .select({
      blueprintId: schema.inventoryBins.blueprintId,
      total: count(),
    })
    .from(schema.inventoryBins)
    .groupBy(schema.inventoryBins.blueprintId);

  const binCountMap = new Map(binCounts.map((row) => [row.blueprintId, row.total]));

  return metas.map((m) => ({
    id: m.id,
    name: m.name,
    rackCount: rackRows.filter((r) => r.blueprintId === m.id).length,
    binCount: binCountMap.get(m.id) ?? 0,
    updatedAt: m.updatedAt.toISOString(),
    updatedBy: m.updatedBy,
    updatedByName: m.updatedByName,
  }));
}

export async function deleteWarehouseLayout(
  blueprintId: string,
  internalSession?: SessionData
): Promise<ActionResult> {
  const sessionData = await resolveActionSession(internalSession);
  if (!sessionData) {
    return {
      success: false,
      error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
    };
  }

  if (sessionData.user.role === 'VIEWER') {
    return {
      success: false,
      error: 'Akses ditolak: Role Viewer tidak dapat menghapus layout.',
    };
  }

  try {
    // Racks/bins cascade via FK onDelete
    await db.delete(schema.warehouseBlueprints).where(eq(schema.warehouseBlueprints.id, blueprintId));
    return { success: true };
  } catch (error) {
    console.error('deleteWarehouseLayout failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
