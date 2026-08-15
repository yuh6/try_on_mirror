CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
DROP INDEX `idx_board_messages_time`;--> statement-breakpoint
ALTER TABLE `board_messages` ADD `owner` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_board_messages_owner` ON `board_messages` (`owner`);--> statement-breakpoint
DROP INDEX `idx_board_reports_time`;--> statement-breakpoint
ALTER TABLE `board_reports` ADD `owner` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_board_reports_owner` ON `board_reports` (`owner`);--> statement-breakpoint
DROP INDEX `idx_board_todos_time`;--> statement-breakpoint
ALTER TABLE `board_todos` ADD `owner` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_board_todos_owner` ON `board_todos` (`owner`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_board_moods` (
	`date` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`mood` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`time` text NOT NULL,
	PRIMARY KEY(`owner`, `date`)
);
--> statement-breakpoint
INSERT INTO `__new_board_moods`("date", "owner", "mood", "note", "time") SELECT "date", '', "mood", "note", "time" FROM `board_moods`;--> statement-breakpoint
DROP TABLE `board_moods`;--> statement-breakpoint
ALTER TABLE `__new_board_moods` RENAME TO `board_moods`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `elder_profiles` ADD `owner` text DEFAULT '' NOT NULL;