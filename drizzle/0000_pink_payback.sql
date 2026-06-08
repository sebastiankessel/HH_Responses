CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year_id` integer NOT NULL,
	`honor_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`rsvp_token` text NOT NULL,
	`email_status` text DEFAULT 'not_sent' NOT NULL,
	`email_sent_at` text,
	`response_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`year_id`) REFERENCES `high_holiday_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`honor_id`) REFERENCES `honors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_rsvp_token_idx` ON `assignments` (`rsvp_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_honor_member_idx` ON `assignments` (`year_id`,`honor_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `assignments_year_response_idx` ON `assignments` (`year_id`,`response_status`);--> statement-breakpoint
CREATE INDEX `assignments_email_status_idx` ON `assignments` (`email_status`);--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`recipient_email` text NOT NULL,
	`provider_message_id` text,
	`status` text NOT NULL,
	`error_message` text,
	`sent_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_events_assignment_idx` ON `email_events` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `email_events_provider_message_idx` ON `email_events` (`provider_message_id`);--> statement-breakpoint
CREATE TABLE `high_holiday_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jewish_year` integer NOT NULL,
	`label` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `high_holiday_years_jewish_year_idx` ON `high_holiday_years` (`jewish_year`);--> statement-breakpoint
CREATE INDEX `high_holiday_years_active_idx` ON `high_holiday_years` (`is_active`);--> statement-breakpoint
CREATE TABLE `honors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	`honor_type` text NOT NULL,
	`prayer_name` text,
	`page_number` text,
	`estimated_honor_time` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`year_id`) REFERENCES `high_holiday_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `honors_year_service_sort_idx` ON `honors` (`year_id`,`service_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `honors_upload_match_idx` ON `honors` (`year_id`,`service_id`,`honor_type`,`prayer_name`,`page_number`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`external_member_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `members_email_idx` ON `members` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_external_member_id_idx` ON `members` (`external_member_id`);--> statement-breakpoint
CREATE TABLE `rsvp_response_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`response_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `rsvp_responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rsvp_response_services_unique_idx` ON `rsvp_response_services` (`response_id`,`service_id`);--> statement-breakpoint
CREATE TABLE `rsvp_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`status` text NOT NULL,
	`wants_reschedule` text,
	`notes` text,
	`submitted_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rsvp_responses_assignment_idx` ON `rsvp_responses` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `rsvp_responses_status_idx` ON `rsvp_responses` (`status`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year_id` integer NOT NULL,
	`name` text NOT NULL,
	`service_date` text NOT NULL,
	`service_time` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`year_id`) REFERENCES `high_holiday_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_year_sort_idx` ON `services` (`year_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `services_year_name_idx` ON `services` (`year_id`,`name`);