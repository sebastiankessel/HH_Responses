import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const highHolidayYears = sqliteTable(
  "high_holiday_years",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jewishYear: integer("jewish_year").notNull(),
    label: text("label").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("high_holiday_years_jewish_year_idx").on(table.jewishYear),
    index("high_holiday_years_active_idx").on(table.isActive),
  ]
);

export const services = sqliteTable(
  "services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    yearId: integer("year_id")
      .notNull()
      .references(() => highHolidayYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serviceDate: text("service_date").notNull(),
    serviceTime: text("service_time"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("services_year_sort_idx").on(table.yearId, table.sortOrder),
    uniqueIndex("services_year_name_idx").on(table.yearId, table.name),
  ]
);

export const honors = sqliteTable(
  "honors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    yearId: integer("year_id")
      .notNull()
      .references(() => highHolidayYears.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    honorType: text("honor_type").notNull(),
    prayerName: text("prayer_name").notNull().default(""),
    pageNumber: text("page_number").notNull().default(""),
    estimatedHonorTime: text("estimated_honor_time"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("honors_year_service_sort_idx").on(
      table.yearId,
      table.serviceId,
      table.sortOrder
    ),
    uniqueIndex("honors_upload_match_idx").on(
      table.yearId,
      table.serviceId,
      table.honorType,
      table.prayerName,
      table.pageNumber
    ),
  ]
);

export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    externalMemberId: text("external_member_id"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("members_email_idx").on(table.email),
    uniqueIndex("members_external_member_id_idx").on(table.externalMemberId),
  ]
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    yearId: integer("year_id")
      .notNull()
      .references(() => highHolidayYears.id, { onDelete: "cascade" }),
    honorId: integer("honor_id")
      .notNull()
      .references(() => honors.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    rsvpToken: text("rsvp_token").notNull(),
    emailStatus: text("email_status", {
      enum: ["not_sent", "sent", "failed"],
    })
      .notNull()
      .default("not_sent"),
    emailSentAt: text("email_sent_at"),
    responseStatus: text("response_status", {
      enum: ["pending", "accepted", "declined"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("assignments_rsvp_token_idx").on(table.rsvpToken),
    uniqueIndex("assignments_honor_member_idx").on(
      table.yearId,
      table.honorId,
      table.memberId
    ),
    index("assignments_year_response_idx").on(
      table.yearId,
      table.responseStatus
    ),
    index("assignments_email_status_idx").on(table.emailStatus),
  ]
);

export const rsvpResponses = sqliteTable(
  "rsvp_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["accepted", "declined"] }).notNull(),
    wantsReschedule: text("wants_reschedule", {
      enum: ["yes", "no", "unsure"],
    }),
    notes: text("notes"),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [
    uniqueIndex("rsvp_responses_assignment_idx").on(table.assignmentId),
    index("rsvp_responses_status_idx").on(table.status),
  ]
);

export const rsvpResponseServices = sqliteTable(
  "rsvp_response_services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    responseId: integer("response_id")
      .notNull()
      .references(() => rsvpResponses.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("rsvp_response_services_unique_idx").on(
      table.responseId,
      table.serviceId
    ),
  ]
);

export const emailEvents = sqliteTable(
  "email_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at"),
  },
  (table) => [
    index("email_events_assignment_idx").on(table.assignmentId),
    index("email_events_provider_message_idx").on(table.providerMessageId),
  ]
);

export type HighHolidayYear = typeof highHolidayYears.$inferSelect;
export type NewHighHolidayYear = typeof highHolidayYears.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Honor = typeof honors.$inferSelect;
export type NewHonor = typeof honors.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type RsvpResponse = typeof rsvpResponses.$inferSelect;
export type NewRsvpResponse = typeof rsvpResponses.$inferInsert;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
