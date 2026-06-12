"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  getInvitationAssignmentById,
  markAssignmentEmailResult,
  recordEmailEvent,
} from "@/db/helpers";
import { assignments, members } from "@/db/schema";
import {
  hasValidAdminSession,
} from "@/lib/adminAuth";
import { getEmailConfig, sendInvitationEmail } from "@/lib/email";

type SendCounts = {
  sent: number;
  failed: number;
  skipped: number;
};

type InvitationAssignment = NonNullable<
  Awaited<ReturnType<typeof getInvitationAssignmentById>>
>;

function requiredNumber(formData: FormData, name: string) {
  const value = formData.get(name);
  const parsed = typeof value === "string" ? Number(value) : NaN;

  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} is required.`);
  }

  return parsed;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const isAuthorized = await hasValidAdminSession(cookieStore);

  if (!isAuthorized) {
    throw new Error("Admin access is required.");
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`2000-01-01T${value}`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function honorDetails(assignment: InvitationAssignment) {
  return [
    assignment.prayerName,
    assignment.pageNumber ? `Page ${assignment.pageNumber}` : null,
    assignment.estimatedHonorTime
      ? `Estimated ${formatTime(assignment.estimatedHonorTime)}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function invitationUrl(siteUrl: string, token: string) {
  return `${siteUrl.replace(/\/+$/, "")}/rsvp/${encodeURIComponent(token)}`;
}

function buildInvitationEmail(
  assignment: InvitationAssignment,
  siteUrl: string
) {
  const serviceTime = formatTime(assignment.serviceTime);
  const serviceLine = `${assignment.serviceName}, ${formatDate(
    assignment.serviceDate
  )}${serviceTime ? ` at ${serviceTime}` : ""}`;
  const details = honorDetails(assignment);
  const url = invitationUrl(siteUrl, assignment.rsvpToken);
  const subject = `Congregation Ner Tamid High Holiday Honor: ${assignment.honorType}`;
  const text = [
    `Dear ${assignment.memberName},`,
    "",
    `Congregation Ner Tamid of South Bay is honored to invite you to participate in ${assignment.yearLabel}.`,
    "",
    `Assigned honor: ${assignment.honorType}`,
    details ? `Details: ${details}` : null,
    `Service: ${serviceLine}`,
    "",
    "Please use this unique RSVP link for this honor:",
    url,
    "",
    "If you have more than one honor, each invitation has its own RSVP link.",
    "",
    "With gratitude,",
    "Congregation Ner Tamid of South Bay",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <p>Dear ${escapeHtml(assignment.memberName)},</p>
    <p>Congregation Ner Tamid of South Bay is honored to invite you to participate in ${escapeHtml(
      assignment.yearLabel
    )}.</p>
    <p>
      <strong>Assigned honor:</strong> ${escapeHtml(assignment.honorType)}<br>
      ${
        details
          ? `<strong>Details:</strong> ${escapeHtml(details)}<br>`
          : ""
      }
      <strong>Service:</strong> ${escapeHtml(serviceLine)}
    </p>
    <p>
      <a href="${escapeHtml(url)}">Please RSVP for this honor</a>
    </p>
    <p>This link is unique to this honor. If you have more than one honor, each invitation has its own RSVP link.</p>
    <p>With gratitude,<br>Congregation Ner Tamid of South Bay</p>
  `;

  return { to: assignment.memberEmail ?? "", subject, html, text };
}

function redirectWithCounts(yearId: number, counts: SendCounts) {
  const params = new URLSearchParams({
    yearId: String(yearId),
    sent: String(counts.sent),
    failed: String(counts.failed),
    skipped: String(counts.skipped),
  });

  redirect(`/admin/email?${params.toString()}`);
}

async function sendAssignmentInvitation(
  assignmentId: number,
  allowAlreadySent: boolean
) {
  const db = getDb();
  const assignment = await getInvitationAssignmentById(db, assignmentId);
  const config = getEmailConfig();

  if (!assignment?.memberEmail || !config.siteUrl) {
    return { status: "skipped" as const, yearId: assignment?.yearId ?? null };
  }

  if (!allowAlreadySent && assignment.emailStatus !== "not_sent") {
    return { status: "skipped" as const, yearId: assignment.yearId };
  }

  const email = buildInvitationEmail(assignment, config.siteUrl);
  const result = await sendInvitationEmail(email);
  const sentAt = new Date().toISOString();

  await recordEmailEvent(db, {
    assignmentId: assignment.id,
    recipientEmail: assignment.memberEmail,
    providerMessageId: result.ok ? result.providerMessageId : null,
    status: result.ok ? "sent" : "failed",
    errorMessage: result.ok ? null : result.errorMessage,
    sentAt,
  });

  await markAssignmentEmailResult(
    db,
    assignment.id,
    result.ok ? "sent" : "failed",
    result.ok ? sentAt : null
  );

  return { status: result.ok ? "sent" : "failed", yearId: assignment.yearId };
}

export async function sendNewInvitations(formData: FormData) {
  await requireAdmin();

  const db = getDb();
  const yearId = requiredNumber(formData, "yearId");
  const config = getEmailConfig();
  const counts: SendCounts = { sent: 0, failed: 0, skipped: 0 };

  if (!config.configured) {
    redirectWithCounts(yearId, { sent: 0, failed: 0, skipped: 0 });
  }

  const eligible = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(members, eq(assignments.memberId, members.id))
    .where(
      and(
        eq(assignments.yearId, yearId),
        eq(assignments.emailStatus, "not_sent"),
        isNotNull(members.email)
      )
    );

  for (const row of eligible) {
    const result = await sendAssignmentInvitation(row.id, false);
    counts[result.status] += 1;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/email");
  revalidatePath("/admin/assignments");
  redirectWithCounts(yearId, counts);
}

export async function resendInvitation(formData: FormData) {
  await requireAdmin();

  const fallbackYearId = requiredNumber(formData, "yearId");
  const assignmentId = requiredNumber(formData, "assignmentId");
  const result = await sendAssignmentInvitation(assignmentId, true);
  const yearId = result.yearId ?? fallbackYearId;
  const counts: SendCounts = { sent: 0, failed: 0, skipped: 0 };
  counts[result.status] += 1;

  revalidatePath("/admin");
  revalidatePath("/admin/email");
  revalidatePath("/admin/assignments");
  redirectWithCounts(yearId, counts);
}
