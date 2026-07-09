CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`person_image_hash` text NOT NULL,
	`clothing_source` text NOT NULL,
	`clothing_ref` text NOT NULL,
	`output_url` text,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`latency_ms` integer NOT NULL,
	CONSTRAINT "generations_clothing_source_check" CHECK("generations"."clothing_source" IN ('uploaded','wardrobe')),
	CONSTRAINT "generations_status_check" CHECK("generations"."status" IN ('success','failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_generations_created_at` ON `generations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_generations_status_created` ON `generations` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `wardrobe_item_tags` (
	`wardrobe_item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`wardrobe_item_id`, `tag_id`),
	FOREIGN KEY (`wardrobe_item_id`) REFERENCES `wardrobe_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wit_tag` ON `wardrobe_item_tags` (`tag_id`);