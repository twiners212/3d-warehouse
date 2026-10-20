CREATE TABLE "inventory_bins" (
	"id" text PRIMARY KEY NOT NULL,
	"blueprint_id" text NOT NULL,
	"rack_id" text NOT NULL,
	"bay_index" integer NOT NULL,
	"level_index" integer NOT NULL,
	"relative_position" jsonb NOT NULL,
	"dimension" jsonb NOT NULL,
	"max_weight_kg" real DEFAULT 1000 NOT NULL,
	"is_occupied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "racks" (
	"id" text PRIMARY KEY NOT NULL,
	"blueprint_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"position" jsonb NOT NULL,
	"rotation_y" real DEFAULT 0 NOT NULL,
	"dimensions" jsonb NOT NULL,
	"bays" integer NOT NULL,
	"levels" integer NOT NULL,
	"bay_width" real NOT NULL,
	"bay_depth" real NOT NULL,
	"level_height" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_blueprints" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grid_snap_step" real DEFAULT 0.5 NOT NULL,
	"floor_dimensions" jsonb NOT NULL,
	"zones_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structural_elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_bins" ADD CONSTRAINT "inventory_bins_blueprint_id_warehouse_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."warehouse_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_bins" ADD CONSTRAINT "inventory_bins_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "racks" ADD CONSTRAINT "racks_blueprint_id_warehouse_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."warehouse_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bins_rack_id" ON "inventory_bins" USING btree ("rack_id");--> statement-breakpoint
CREATE INDEX "idx_bins_blueprint_occupancy" ON "inventory_bins" USING btree ("blueprint_id","is_occupied");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rack_bay_level" ON "inventory_bins" USING btree ("rack_id","bay_index","level_index");--> statement-breakpoint
CREATE INDEX "idx_racks_blueprint_id" ON "racks" USING btree ("blueprint_id");