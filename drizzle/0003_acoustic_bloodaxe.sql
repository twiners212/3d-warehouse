DROP INDEX "uq_rack_bay_level";--> statement-breakpoint
ALTER TABLE "inventory_bins" ADD COLUMN "slot_position" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rack_bay_level" ON "inventory_bins" USING btree ("rack_id","bay_index","level_index","id");