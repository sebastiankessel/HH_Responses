import { cookies } from "next/headers";
import { getDb } from "@/db";
import {
  getActiveYear,
  getHighHolidayYearById,
  getMostRecentYear,
  listHighHolidayYears,
  listResponseReviewForYear,
} from "@/db/helpers";
import { hasValidAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type ExportType = "full" | "pending" | "accepted" | "declined";
type ResponseRow = Awaited<ReturnType<typeof listResponseReviewForYear>>[number];

function toInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function getExportType(value: string | null): ExportType {
  return value === "pending" || value === "accepted" || value === "declined"
    ? value
    : "full";
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  return [
    headers.map(csvValue).join(","),
    ...rows.map((row) => row.map(csvValue).join(",")),
  ].join("\n");
}

function serviceDateTime(row: ResponseRow) {
  return [row.serviceDate, row.serviceTime].filter(Boolean).join(" ");
}

function attendedServices(row: ResponseRow) {
  return row.attendedServices
    .map((service) =>
      [service.serviceName, service.serviceDate, service.serviceTime]
        .filter(Boolean)
        .join(" ")
    )
    .join("; ");
}

function baseColumns(row: ResponseRow) {
  return [
    row.memberName,
    row.memberEmail,
    row.memberPhone,
    row.externalMemberId,
    row.serviceName,
    serviceDateTime(row),
    row.honorType,
    row.prayerName,
    row.pageNumber,
    row.emailStatus,
    row.emailSentAt,
    row.responseStatus,
    row.submittedAt,
    row.notes,
  ];
}

function buildCsv(type: ExportType, rows: ResponseRow[]) {
  const filteredRows =
    type === "full"
      ? rows
      : rows.filter((row) => row.responseStatus === type);

  if (type === "declined") {
    return toCsv(
      [
        "member_name",
        "email",
        "phone",
        "external_member_id",
        "service_name",
        "service_date_time",
        "honor_type",
        "prayer_name",
        "page_number",
        "email_status",
        "email_sent_at",
        "response_status",
        "submitted_at",
        "notes",
        "wants_reschedule",
        "attended_services",
        "possible_alternative_candidate",
      ],
      filteredRows.map((row) => [
        ...baseColumns(row),
        row.wantsReschedule,
        attendedServices(row),
        row.responseStatus === "declined" &&
        (row.wantsReschedule === "yes" || row.wantsReschedule === "unsure") &&
        row.attendedServices.length > 0
          ? "yes"
          : "no",
      ])
    );
  }

  return toCsv(
    [
      "member_name",
      "email",
      "phone",
      "external_member_id",
      "service_name",
      "service_date_time",
      "honor_type",
      "prayer_name",
      "page_number",
      "email_status",
      "email_sent_at",
      "response_status",
      "submitted_at",
      "notes",
    ],
    filteredRows.map(baseColumns)
  );
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const isAuthorized = await hasValidAdminSession(cookieStore);

  if (!isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const db = getDb();
  const years = await listHighHolidayYears(db);
  const activeYear = await getActiveYear(db);
  const mostRecentYear = years[0] ?? (await getMostRecentYear(db));
  const selectedYearId =
    toInt(url.searchParams.get("yearId")) ??
    activeYear?.id ??
    mostRecentYear?.id ??
    null;
  const selectedYear = selectedYearId
    ? await getHighHolidayYearById(db, selectedYearId)
    : null;
  const type = getExportType(url.searchParams.get("type"));
  const rows = selectedYear
    ? await listResponseReviewForYear(db, selectedYear.id)
    : [];
  const csv = buildCsv(type, rows);
  const yearSlug = selectedYear?.jewishYear ?? "no-year";

  return new Response(csv, {
    headers: {
      "content-disposition": `attachment; filename="high-holiday-${yearSlug}-${type}.csv"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
