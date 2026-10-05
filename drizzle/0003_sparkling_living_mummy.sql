CREATE TABLE `observation_cancellations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_id` text NOT NULL,
	`original_json` text NOT NULL,
	`reason` text NOT NULL,
	`cancelled_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observation_cancellations_day_id_unique` ON `observation_cancellations` (`day_id`);--> statement-breakpoint
CREATE INDEX `obs_cancel_user` ON `observation_cancellations` (`user_id`);