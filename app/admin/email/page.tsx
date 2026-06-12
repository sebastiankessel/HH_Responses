import Link from "next/link";
import { getDb } from "@/db";
import {
  getActiveYear,
  getHighHolidayYearById,
  getMostRecentYear,
  listAssignmentsForYear,
  listHighHolidayYears,
} from "@/db/helpers";
import { getEmailConfig, getPublicSiteUrl } from "@/lib/email";
import { resendInvitation, sendNewInvitations } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  yearId?: string;
  sent?: string;
  failed?: string;
  skipped?: string;
}>;

function toInt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function resultNumber(value: string | undefined) {
  return toInt(value) ?? 0;
}

function formatServiceDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not sent";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(value: string) {
  return value.replace("_", " ");
}

function rsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${encodeURIComponent(token)}`;
  return siteUrl ? `${siteUrl.replace(/\/+$/, "")}${path}` : path;
}

export default async function EmailInvitationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const db = getDb();
  const years = await listHighHolidayYears(db);
  const activeYear = await getActiveYear(db);
  const mostRecentYear = years[0] ?? (await getMostRecentYear(db));
  const selectedYearId =
    toInt(params.yearId) ?? activeYear?.id ?? mostRecentYear?.id ?? null;
  const selectedYear = selectedYearId
    ? await getHighHolidayYearById(db, selectedYearId)
    : null;
  const assignments = selectedYear
    ? await listAssignmentsForYear(db, selectedYear.id)
    : [];
  const emailConfig = getEmailConfig();
  const siteUrl = getPublicSiteUrl();
  const hasSendResult = params.sent !== undefined;
  const sendResult = {
    sent: resultNumber(params.sent),
    failed: resultNumber(params.failed),
    skipped: resultNumber(params.skipped),
  };
  const eligibleCount = assignments.filter(
    (assignment) =>
      assignment.emailStatus === "not_sent" && assignment.memberEmail
  ).length;
  const missingEmailCount = assignments.filter(
    (assignment) => !assignment.memberEmail
  ).length;
  const sentCount = assignments.filter(
    (assignment) => assignment.emailStatus === "sent"
  ).length;
  const failedCount = assignments.filter(
    (assignment) => assignment.emailStatus === "failed"
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            className="text-sm font-semibold text-[#1d6f61] hover:text-[#185b50]"
            href="/admin"
          >
            Back to admin
          </a>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d3c34]">
            Email invitations
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625950]">
            Send one invitation per honor assignment. Batch sends only include
            assignments with email addresses that have not already been sent.
          </p>
        </div>
        <form action="/admin/email" className="flex flex-col gap-2 sm:w-72">
          <label className="text-sm font-semibold text-[#3c352f]">
            Selected Jewish year
            <select
              className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
              defaultValue={selectedYear?.id ?? ""}
              name="yearId"
            >
              {years.length === 0 ? (
                <option value="">No years created yet</option>
              ) : null}
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label} ({year.jewishYear})
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
            type="submit"
          >
            Switch year
          </button>
        </form>
      </div>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Send new invitations
          </h3>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <SummaryStat label="Ready" value={eligibleCount} />
            <SummaryStat label="Sent" value={sentCount} />
            <SummaryStat label="Failed" value={failedCount} />
            <SummaryStat label="No email" value={missingEmailCount} />
          </dl>
          <form action={sendNewInvitations} className="mt-5">
            <input name="yearId" type="hidden" value={selectedYear?.id ?? ""} />
            <button
              className="w-full rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50] disabled:cursor-not-allowed disabled:bg-[#9aa59c]"
              disabled={!selectedYear || eligibleCount === 0 || !emailConfig.configured}
              type="submit"
            >
              Send unsent invitations
            </button>
          </form>
          {!emailConfig.configured ? (
            <p className="mt-4 rounded-md border border-[#dfd1bd] bg-white px-3 py-2 text-sm leading-6 text-[#625950]">
              Email sending is not configured yet. Set RESEND_API_KEY,
              EMAIL_FROM, and PUBLIC_SITE_URL before sending invitations.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Send tracking
          </h3>
          {hasSendResult ? (
            <dl className="mt-5 grid grid-cols-3 gap-3">
              <SummaryStat label="Sent" value={sendResult.sent} />
              <SummaryStat label="Failed" value={sendResult.failed} />
              <SummaryStat label="Skipped" value={sendResult.skipped} />
            </dl>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              Send results will appear here after an invitation batch or
              individual re-send.
            </p>
          )}
          <div className="mt-5 rounded-md bg-[#f8f3ea] px-3 py-2 text-xs leading-5 text-[#625950]">
            Provider: {emailConfig.provider}. From address:{" "}
            {emailConfig.from ?? "not configured"}. RSVP link base:{" "}
            {siteUrl || "not configured"}.
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1d3c34]">
              Invitations for {selectedYear?.label ?? "selected year"}
            </h3>
            <p className="mt-1 text-sm text-[#625950]">
              {assignments.length} assignment
              {assignments.length === 1 ? "" : "s"} available.
            </p>
          </div>
          <Link
            className="inline-flex rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
            href={`/admin/assignments${selectedYear ? `?yearId=${selectedYear.id}` : ""}`}
          >
            Manage assignments
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs uppercase text-[#6b4a22]">
              <tr>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Member
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Honor
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Service
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Email status
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  RSVP link
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-[#625950]"
                    colSpan={6}
                  >
                    No assignments have been imported for this year.
                  </td>
                </tr>
              ) : null}
              {assignments.map((assignment) => (
                <tr className="align-top" key={assignment.id}>
                  <td className="border-b border-[#eadcca] px-3 py-3">
                    <div className="font-semibold text-[#1d3c34]">
                      {assignment.memberName}
                    </div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {assignment.memberEmail ?? "No email"}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#3c352f]">
                    <div className="font-semibold">{assignment.honorType}</div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {[assignment.prayerName, assignment.pageNumber]
                        .filter(Boolean)
                        .join(" | ") || "No prayer/page"}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#3c352f]">
                    <div className="font-semibold">
                      {assignment.serviceName}
                    </div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {formatServiceDate(assignment.serviceDate)}
                      {assignment.serviceTime
                        ? ` at ${assignment.serviceTime}`
                        : ""}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#625950]">
                    <div className="capitalize">
                      {statusLabel(assignment.emailStatus)}
                    </div>
                    <div className="mt-1 text-xs">
                      {formatDateTime(assignment.emailSentAt)}
                    </div>
                  </td>
                  <td className="max-w-72 border-b border-[#eadcca] px-3 py-3">
                    <code className="block break-all rounded bg-white px-2 py-1 text-xs text-[#625950]">
                      {rsvpUrl(siteUrl, assignment.rsvpToken)}
                    </code>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3">
                    <form action={resendInvitation}>
                      <input
                        name="yearId"
                        type="hidden"
                        value={selectedYear?.id ?? ""}
                      />
                      <input
                        name="assignmentId"
                        type="hidden"
                        value={assignment.id}
                      />
                      <button
                        className="rounded-md border border-[#b99b6d] bg-white px-3 py-2 text-xs font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0] disabled:cursor-not-allowed disabled:text-[#9a8f83]"
                        disabled={!assignment.memberEmail || !emailConfig.configured}
                        type="submit"
                      >
                        Re-send
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#eadcca] bg-white p-3">
      <dt className="text-xs font-semibold uppercase text-[#8b5f2f]">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-[#1d3c34]">{value}</dd>
    </div>
  );
}
