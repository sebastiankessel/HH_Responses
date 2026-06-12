import Link from "next/link";
import { getDb } from "@/db";
import {
  getActiveYear,
  getHighHolidayYearById,
  getMostRecentYear,
  listHighHolidayYears,
  listHonorsForYear,
  listResponseReviewForYear,
  listServicesForYear,
} from "@/db/helpers";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  yearId?: string;
  serviceId?: string;
  honorId?: string;
  responseStatus?: string;
  emailStatus?: string;
}>;

type ResponseStatus = "all" | "pending" | "accepted" | "declined";
type EmailStatus = "all" | "not_sent" | "sent" | "failed" | "missing";
type ResponseRow = Awaited<ReturnType<typeof listResponseReviewForYear>>[number];

const responseOptions: Array<{ value: ResponseStatus; label: string }> = [
  { value: "all", label: "All responses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const emailOptions: Array<{ value: EmailStatus; label: string }> = [
  { value: "all", label: "All email statuses" },
  { value: "not_sent", label: "Not sent" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "missing", label: "Missing email" },
];

function toInt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function getResponseStatus(value: string | undefined): ResponseStatus {
  return value === "pending" || value === "accepted" || value === "declined"
    ? value
    : "all";
}

function getEmailStatus(value: string | undefined): EmailStatus {
  return value === "not_sent" ||
    value === "sent" ||
    value === "failed" ||
    value === "missing"
    ? value
    : "all";
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
    return "Not submitted";
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

function wantsRescheduleLabel(value: string | null) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "unsure") {
    return "Not sure";
  }

  if (value === "no") {
    return "No";
  }

  return "Not provided";
}

function isAlternativeCandidate(row: ResponseRow) {
  return (
    row.responseStatus === "declined" &&
    (row.wantsReschedule === "yes" || row.wantsReschedule === "unsure") &&
    row.attendedServices.length > 0
  );
}

function filterRows({
  rows,
  serviceId,
  honorId,
  responseStatus,
  emailStatus,
}: {
  rows: ResponseRow[];
  serviceId: number | null;
  honorId: number | null;
  responseStatus: ResponseStatus;
  emailStatus: EmailStatus;
}) {
  return rows.filter((row) => {
    if (serviceId && row.serviceId !== serviceId) {
      return false;
    }

    if (honorId && row.honorId !== honorId) {
      return false;
    }

    if (responseStatus !== "all" && row.responseStatus !== responseStatus) {
      return false;
    }

    if (emailStatus === "missing") {
      return !row.memberEmail;
    }

    if (emailStatus !== "all" && row.emailStatus !== emailStatus) {
      return false;
    }

    return true;
  });
}

function exportHref(yearId: number | null, type: string) {
  const params = new URLSearchParams({ type });
  if (yearId) {
    params.set("yearId", String(yearId));
  }

  return `/admin/responses/export?${params.toString()}`;
}

export default async function ResponsesPage({
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
  const rows = selectedYear
    ? await listResponseReviewForYear(db, selectedYear.id)
    : [];
  const services = selectedYear
    ? await listServicesForYear(db, selectedYear.id)
    : [];
  const honors = selectedYear ? await listHonorsForYear(db, selectedYear.id) : [];
  const serviceId = toInt(params.serviceId);
  const honorId = toInt(params.honorId);
  const responseStatus = getResponseStatus(params.responseStatus);
  const emailStatus = getEmailStatus(params.emailStatus);
  const filteredRows = filterRows({
    rows,
    serviceId,
    honorId,
    responseStatus,
    emailStatus,
  });
  const honorsForFilter = serviceId
    ? honors.filter((honor) => honor.serviceId === serviceId)
    : honors;
  const totals = {
    honors: honors.length,
    assignments: rows.length,
    emailsSent: rows.filter((row) => row.emailStatus === "sent").length,
    pending: rows.filter((row) => row.responseStatus === "pending").length,
    accepted: rows.filter((row) => row.responseStatus === "accepted").length,
    declined: rows.filter((row) => row.responseStatus === "declined").length,
    missingEmail: rows.filter((row) => !row.memberEmail).length,
  };

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
            Response dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625950]">
            Review RSVP status, declined response details, and export office
            lists for the selected High Holiday year.
          </p>
        </div>
        <form action="/admin/responses" className="flex flex-col gap-2 sm:w-72">
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <SummaryStat label="Honors" value={totals.honors} />
        <SummaryStat label="Assignments" value={totals.assignments} />
        <SummaryStat label="Emails sent" value={totals.emailsSent} />
        <SummaryStat label="Pending" value={totals.pending} />
        <SummaryStat label="Accepted" value={totals.accepted} />
        <SummaryStat label="Declined" value={totals.declined} />
        <SummaryStat label="No email" value={totals.missingEmail} />
      </section>

      <section className="mt-6 rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <form
            action="/admin/responses"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          >
            <input name="yearId" type="hidden" value={selectedYear?.id ?? ""} />
            <label className="text-sm font-semibold text-[#3c352f]">
              Service
              <select
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={serviceId ?? ""}
                name="serviceId"
              >
                <option value="">All services</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#3c352f]">
              Honor
              <select
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={honorId ?? ""}
                name="honorId"
              >
                <option value="">All honors</option>
                {honorsForFilter.map((honor) => (
                  <option key={honor.id} value={honor.id}>
                    {honor.serviceName} - {honor.honorType}
                    {honor.prayerName ? ` - ${honor.prayerName}` : ""}
                    {honor.pageNumber ? ` - Page ${honor.pageNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#3c352f]">
              Response
              <select
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={responseStatus}
                name="responseStatus"
              >
                {responseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#3c352f]">
              Email
              <select
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={emailStatus}
                name="emailStatus"
              >
                {emailOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="self-end rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
              type="submit"
            >
              Apply filters
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <ExportLink href={exportHref(selectedYear?.id ?? null, "full")}>
              Full CSV
            </ExportLink>
            <ExportLink href={exportHref(selectedYear?.id ?? null, "pending")}>
              Pending CSV
            </ExportLink>
            <ExportLink href={exportHref(selectedYear?.id ?? null, "accepted")}>
              Accepted CSV
            </ExportLink>
            <ExportLink href={exportHref(selectedYear?.id ?? null, "declined")}>
              Declined CSV
            </ExportLink>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1d3c34]">
              Responses for {selectedYear?.label ?? "selected year"}
            </h3>
            <p className="mt-1 text-sm text-[#625950]">
              Showing {filteredRows.length} of {rows.length} assignment
              {rows.length === 1 ? "" : "s"}.
            </p>
          </div>
          <Link
            className="inline-flex rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
            href={`/admin/email${selectedYear ? `?yearId=${selectedYear.id}` : ""}`}
          >
            Manage invitations
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
                  Status
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Submitted
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Decline details
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-[#625950]"
                    colSpan={7}
                  >
                    No assignments match these filters.
                  </td>
                </tr>
              ) : null}
              {filteredRows.map((row) => (
                <tr className="align-top" key={row.id}>
                  <td className="border-b border-[#eadcca] px-3 py-3">
                    <div className="font-semibold text-[#1d3c34]">
                      {row.memberName}
                    </div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {row.memberEmail ?? "No email"}
                      {row.memberPhone ? ` | ${row.memberPhone}` : ""}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#3c352f]">
                    <div className="font-semibold">{row.honorType}</div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {[row.prayerName, row.pageNumber ? `Page ${row.pageNumber}` : null]
                        .filter(Boolean)
                        .join(" | ") || "No prayer/page"}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#3c352f]">
                    <div className="font-semibold">{row.serviceName}</div>
                    <div className="mt-1 text-xs text-[#625950]">
                      {formatServiceDate(row.serviceDate)}
                      {row.serviceTime ? ` at ${row.serviceTime}` : ""}
                    </div>
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3">
                    <span className="capitalize text-[#3c352f]">
                      {row.responseStatus}
                    </span>
                    <div className="mt-1 text-xs capitalize text-[#625950]">
                      Email: {statusLabel(row.emailStatus)}
                    </div>
                    {isAlternativeCandidate(row) ? (
                      <div className="mt-2 rounded-full bg-[#e8f2ef] px-2 py-1 text-xs font-semibold text-[#1d6f61]">
                        Alternative candidate
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#625950]">
                    {formatDateTime(row.submittedAt)}
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#625950]">
                    {row.responseStatus === "declined" ? (
                      <div className="space-y-2">
                        <div>
                          Reschedule: {wantsRescheduleLabel(row.wantsReschedule)}
                        </div>
                        <div>
                          Attend:{" "}
                          {row.attendedServices.length > 0
                            ? row.attendedServices
                                .map((service) => service.serviceName)
                                .join(", ")
                            : "None selected"}
                        </div>
                      </div>
                    ) : (
                      "Not applicable"
                    )}
                  </td>
                  <td className="max-w-72 border-b border-[#eadcca] px-3 py-3 text-[#625950]">
                    {row.notes ? (
                      <p className="whitespace-pre-wrap">{row.notes}</p>
                    ) : (
                      "No notes"
                    )}
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
    <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-4 shadow-sm">
      <dt className="text-xs font-semibold uppercase text-[#8b5f2f]">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-[#1d3c34]">{value}</dd>
    </div>
  );
}

function ExportLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className="inline-flex rounded-md border border-[#b99b6d] bg-white px-3 py-2 text-xs font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
      href={href}
    >
      {children}
    </a>
  );
}
