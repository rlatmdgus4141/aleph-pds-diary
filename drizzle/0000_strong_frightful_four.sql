CREATE TABLE `completions` (
	`task_id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `execution_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`request_key` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`actual_minutes` integer NOT NULL,
	`blocker` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `log_request_unique` ON `execution_logs` (`request_key`);--> statement-breakpoint
CREATE INDEX `logs_task` ON `execution_logs` (`task_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`priority` text,
	`success` text DEFAULT '' NOT NULL,
	`expected_minutes` integer,
	`draft` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_reflection` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`insight` text NOT NULL,
	`next_plan_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`next_plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_plan_version` ON `plan_revisions` (`plan_id`,`version`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`priority` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`expected_minutes` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_plan_active` ON `tasks` (`plan_id`,`deleted_at`);