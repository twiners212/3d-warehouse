// Fulfills DATA-MODEL.md Section 5 Drizzle ORM Schema Implementation
// Hybrid relational-document pattern: normalized racks/bins + JSONB blueprint payloads.

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  real,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { Size3D, Vector3D } from '@/types/spatial';
import type {
  RackType,
  StructuralElement,
  WarehouseZone,
  BuildingLevel,
  VerticalConnector,
  BinSkuData,
} from '@/types/layout';
import type { PickingRouteConfig } from '@/types/routing';

export type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

// 0. Auth & RBAC Tables
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>().default('VIEWER').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // cryptographic session token
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_sessions_user_id').on(table.userId),
  })
);

// 1. Blueprints Table
export const warehouseBlueprints = pgTable('warehouse_blueprints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gridSnapStep: real('grid_snap_step').default(0.5).notNull(),
  floorDimensions: jsonb('floor_dimensions').$type<Size3D>().notNull(),
  zonesData: jsonb('zones_data').$type<WarehouseZone[]>().default([]).notNull(),
  structuralElements: jsonb('structural_elements')
    .$type<StructuralElement[]>()
    .default([])
    .notNull(),
  buildingLevels: jsonb('building_levels').$type<BuildingLevel[]>().default([]).notNull(),
  verticalConnectors: jsonb('vertical_connectors')
    .$type<VerticalConnector[]>()
    .default([])
    .notNull(),
  pickingConfig: jsonb('picking_config').$type<PickingRouteConfig>(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Racks Table
export const racks = pgTable(
  'racks',
  {
    id: text('id').primaryKey(),
    blueprintId: text('blueprint_id')
      .notNull()
      .references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type')
      .$type<RackType>()
      .notNull(),
    position: jsonb('position')
      .$type<Vector3D>()
      .notNull(),
    rotationY: real('rotation_y').default(0.0).notNull(),
    dimensions: jsonb('dimensions').$type<Size3D>().notNull(),
    bays: integer('bays').notNull(),
    levels: integer('levels').notNull(),
    bayWidth: real('bay_width').notNull(),
    bayDepth: real('bay_depth').notNull(),
    levelHeight: real('level_height').notNull(),
    levelId: text('level_id').default('level-1').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // DATA-MODEL.md Section 4 Index 1
    blueprintIdx: index('idx_racks_blueprint_id').on(table.blueprintId),
  })
);

// 3. Inventory Bins Table
export const inventoryBins = pgTable(
  'inventory_bins',
  {
    id: text('id').primaryKey(), // E.g. "A01-02-03"
    blueprintId: text('blueprint_id')
      .notNull()
      .references(() => warehouseBlueprints.id, { onDelete: 'cascade' }),
    rackId: text('rack_id')
      .notNull()
      .references(() => racks.id, { onDelete: 'cascade' }),
    bayIndex: integer('bay_index').notNull(),
    levelIndex: integer('level_index').notNull(),
    slotPosition: text('slot_position'),
    relativePosition: jsonb('relative_position').$type<Vector3D>().notNull(),
    dimension: jsonb('dimension').$type<Size3D>().notNull(),
    maxWeightKg: real('max_weight_kg').default(1000.0).notNull(),
    isOccupied: boolean('is_occupied').default(false).notNull(),
    skuData: jsonb('sku_data').$type<BinSkuData>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // DATA-MODEL.md Section 4 Indexes 2 & 3, Constraint 1
    rackIdx: index('idx_bins_rack_id').on(table.rackId),
    occupancyIdx: index('idx_bins_blueprint_occupancy').on(
      table.blueprintId,
      table.isOccupied
    ),
    uniqueBayLevel: uniqueIndex('uq_rack_bay_level').on(
      table.rackId,
      table.bayIndex,
      table.levelIndex,
      table.id
    ),
  })
);

// 4. Relational Definitions
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  createdBlueprints: many(warehouseBlueprints, { relationName: 'createdBlueprints' }),
  updatedBlueprints: many(warehouseBlueprints, { relationName: 'updatedBlueprints' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const blueprintRelations = relations(warehouseBlueprints, ({ one, many }) => ({
  racks: many(racks),
  bins: many(inventoryBins),
  creator: one(users, {
    fields: [warehouseBlueprints.createdBy],
    references: [users.id],
    relationName: 'createdBlueprints',
  }),
  updater: one(users, {
    fields: [warehouseBlueprints.updatedBy],
    references: [users.id],
    relationName: 'updatedBlueprints',
  }),
}));

export const rackRelations = relations(racks, ({ one, many }) => ({
  blueprint: one(warehouseBlueprints, {
    fields: [racks.blueprintId],
    references: [warehouseBlueprints.id],
  }),
  bins: many(inventoryBins),
}));

export const binRelations = relations(inventoryBins, ({ one }) => ({
  rack: one(racks, {
    fields: [inventoryBins.rackId],
    references: [racks.id],
  }),
  blueprint: one(warehouseBlueprints, {
    fields: [inventoryBins.blueprintId],
    references: [warehouseBlueprints.id],
  }),
}));

