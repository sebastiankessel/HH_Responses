import Link from "next/link";
import { getDb } from "@/db";
import {
  getActiveYear,
  getHighHolidayYearById,
  getMostRecentYear,
  listAssignmentsForYear,
  listHighHolidayYears,
} from "@/db/helpers";
import { importAssignments } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  yearId?: string;
  totalRows?: string;
  createdAssignments?: string;
  existingAssignments?: string;
  duplicateRows?: string;
  skippedRows?: string;
  invalidEmailRows?: string;
  unknownYearRows?: string;
  unknownHonorRows?: string;
}>;

function toInt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
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

function resultNumber(value: string | undefined) {
  return toInt(value) ?? 0;
}

export default async function AssignmentsPage({
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
  const hasImportResult = params.totalRows !== undefined;
  const importResult = {
    totalRows: resultNumber(params.totalRows),
    createdAssignments: resultNumber(params.createdAssignments),
    existingAssignments: resultNumber(params.existingAssignments),
    duplicateRows: resultNumber(params.duplicateRows),
    skippedRows: resultNumber(params.skippedRows),
    invalidEmailRows: resultNumber(params.invalidEmailRows),
    unknownYearRows: resultNumber(params.unknownYearRows),
    unknownHonorRows: resultNumber(params.unknownHonorRows),
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            className="text-sm font-semibold text-[#1d6f61] hover:text-[#185b50]"
            href="/admin"
          >
            Back to admin
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d3c34]">
            Assignment imports
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625950]">
            Import assigned members into existing honors. Re-uploading the same
            assignment CSV will reuse matching members and skip duplicate
            assignments.
          </p>
        </div>
        <form action="/admin/assignments" className="flex flex-col gap-2 sm:w-72">
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
            Upload assignments CSV
          </h3>
          {selectedYear ? (
            <form action={importAssignments} className="mt-5 grid gap-4">
              <input name="yearId" type="hidden" value={selectedYear.id} />
              <label className="text-sm font-semibold text-[#3c352f]">
                CSV file
                <input
                  accept=".csv,text/csv"
                  className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#e8f2ef] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#1d6f61] outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="assignmentCsv"
                  required
                  type="file"
                />
              </label>
              <div className="rounded-md bg-[#f8f3ea] px-3 py-2 text-xs leading-5 text-[#625950]">
                Expected headers: member_name, email, year, service_name,
                honor_type, prayer_name, page_number, phone,
                external_member_id.
              </div>
              <button
                className="rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                type="submit"
              >
                Import valid assignments
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              Create a Jewish year and honors before importing assignments.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Import result
          </h3>
          {hasImportResult ? (
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultStat label="Rows" value={importResult.totalRows} />
              <ResultStat
                label="Created"
                value={importResult.createdAssignments}
              />
              <ResultStat
                label="Existing"
                value={importResult.existingAssignments}
              />
              <ResultStat
                label="Duplicate rows"
                value={importResult.duplicateRows}
              />
              <ResultStat label="Skipped" value={importResult.skippedRows} />
              <ResultStat
                label="Invalid email"
                value={importResult.invalidEmailRows}
              />
              <ResultStat
                label="Unknown year"
                value={importResult.unknownYearRows}
              />
              <ResultStat
                label="Unknown honor"
                value={importResult.unknownHonorRows}
              />
            </dl>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              Import results will appear here after the first upload.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1d3c34]">
              Assignments for {selectedYear?.label ?? "selected year"}
            </h3>
            <p className="mt-1 text-sm text-[#625950]">
              {assignments.length} assignment
              {assignments.length === 1 ? "" : "s"} currently stored.
            </p>
          </div>
          <Link
            className="inline-flex rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
            href={`/admin/setup${selectedYear ? `?yearId=${selectedYear.id}` : ""}`}
          >
            Manage setup
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
                  Email
                </th>
                <th className="border-b border-[#dfd1bd] px-3 py-2 font-semibold">
                  RSVP
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm text-[#625950]"
                    colSpan={5}
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
                      {assignment.memberPhone
                        ? ` | ${assignment.memberPhone}`
                        : ""}
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
                    {assignment.emailStatus.replace("_", " ")}
                  </td>
                  <td className="border-b border-[#eadcca] px-3 py-3 text-[#625950]">
                    {assignment.responseStatus}
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

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#eadcca] bg-white p-3">
      <dt className="text-xs font-semibold uppercase text-[#8b5f2f]">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-[#1d3c34]">{value}</dd>
    </div>
  );
}
