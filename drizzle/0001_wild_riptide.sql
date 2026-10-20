ALTER TABLE "inventory_bins" ADD COLUMN "sku_data" jsonb;--> statement-breakpoint
ALTER TABLE "racks" ADD COLUMN "level_id" text DEFAULT 'level-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_blueprints" ADD COLUMN "building_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_blueprints" ADD COLUMN "vertical_connectors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_blueprints" ADD COLUMN "picking_config" jsonb;