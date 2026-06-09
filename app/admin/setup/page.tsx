import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import {
  getHighHolidayYearById,
  getMostRecentYear,
  listHighHolidayYears,
  listHonorsForYear,
  listServicesForYear,
} from "@/db/helpers";
import {
  ADMIN_SESSION_COOKIE,
  isValidAdminSessionToken,
} from "@/lib/adminAuth";
import {
  createHonor,
  createService,
  createYear,
  deleteHonor,
  deleteService,
  deleteYear,
  updateHonor,
  updateService,
  updateYear,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  yearId?: string;
}>;

async function getSuggestedJewishYear(fallbackYear?: number) {
  const today = new Date();
  const url = new URL("https://www.hebcal.com/converter");
  url.searchParams.set("cfg", "json");
  url.searchParams.set("g2h", "1");
  url.searchParams.set("gy", String(today.getUTCFullYear()));
  url.searchParams.set("gm", String(today.getUTCMonth() + 1));
  url.searchParams.set("gd", String(today.getUTCDate()));

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) {
      throw new Error("Hebcal date conversion failed.");
    }

    const data = (await response.json()) as { hy?: number };
    if (typeof data.hy === "number") {
      return data.hy + 1;
    }
  } catch {
    // Fall through to the configured-year fallback below.
  }

  return fallbackYear ?? today.getUTCFullYear() + 3762;
}

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

export default async function SetupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const isAuthorized = await isValidAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );

  if (!isAuthorized) {
    return null;
  }

  const db = getDb();
  const years = await listHighHolidayYears(db);
  const mostRecentYear = years[0] ?? (await getMostRecentYear(db));
  const suggestedJewishYear = await getSuggestedJewishYear(
    mostRecentYear?.jewishYear
  );

  const selectedYearId =
    toInt(params.yearId) ??
    years.find((year) => year.jewishYear === suggestedJewishYear)?.id ??
    mostRecentYear?.id ??
    null;

  const selectedYear = selectedYearId
    ? await getHighHolidayYearById(db, selectedYearId)
    : null;
  const selectedYearServices = selectedYear
    ? await listServicesForYear(db, selectedYear.id)
    : [];
  const selectedYearHonors = selectedYear
    ? await listHonorsForYear(db, selectedYear.id)
    : [];

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
            Year and setup
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625950]">
            Create the High Holiday year, then define services and honors for
            that year.
          </p>
        </div>
        <form action="/admin/setup" className="flex flex-col gap-2 sm:w-72">
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
            Create Jewish year
          </h3>
          <form action={createYear} className="mt-5 grid gap-4">
            <label className="text-sm font-semibold text-[#3c352f]">
              Jewish year
              <input
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={suggestedJewishYear}
                min="1"
                name="jewishYear"
                required
                type="number"
              />
            </label>
            <label className="text-sm font-semibold text-[#3c352f]">
              Label
              <input
                className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                defaultValue={`High Holidays ${suggestedJewishYear}`}
                name="label"
                required
              />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-[#3c352f]">
              <input
                className="h-4 w-4 accent-[#1d6f61]"
                defaultChecked={years.length === 0}
                name="isActive"
                type="checkbox"
              />
              Set as active admin year
            </label>
            <button
              className="rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
              type="submit"
            >
              Save year
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Existing years
          </h3>
          <div className="mt-5 space-y-4">
            {years.length === 0 ? (
              <p className="text-sm leading-6 text-[#625950]">
                No High Holiday years have been created.
              </p>
            ) : null}
            {years.map((year) => (
              <form
                action={updateYear}
                className="grid gap-3 rounded-md border border-[#eadcca] bg-white p-4 md:grid-cols-[110px_1fr_auto] md:items-end"
                key={year.id}
              >
                <input name="id" type="hidden" value={year.id} />
                <label className="text-sm font-semibold text-[#3c352f]">
                  Year
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={year.jewishYear}
                    min="1"
                    name="jewishYear"
                    required
                    type="number"
                  />
                </label>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Label
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={year.label}
                    name="label"
                    required
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#3c352f]">
                    <input
                      className="h-4 w-4 accent-[#1d6f61]"
                      defaultChecked={year.isActive}
                      name="isActive"
                      type="checkbox"
                    />
                    Active
                  </label>
                  <button
                    className="rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                    type="submit"
                  >
                    Update
                  </button>
                  <button
                    className="rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
                    formAction={deleteYear}
                    type="submit"
                  >
                    Delete
                  </button>
                </div>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Add service
          </h3>
          {selectedYear ? (
            <form action={createService} className="mt-5 grid gap-4">
              <input name="yearId" type="hidden" value={selectedYear.id} />
              <label className="text-sm font-semibold text-[#3c352f]">
                Service name
                <input
                  className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="name"
                  placeholder="Erev Rosh Hashanah"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#3c352f]">
                  Date
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    name="serviceDate"
                    required
                    type="date"
                  />
                </label>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Time
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    name="serviceTime"
                    type="time"
                  />
                </label>
              </div>
              <label className="text-sm font-semibold text-[#3c352f]">
                Sort order
                <input
                  className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  defaultValue="0"
                  name="sortOrder"
                  type="number"
                />
              </label>
              <button
                className="rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                type="submit"
              >
                Save service
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              Create a Jewish year before adding services.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Services for {selectedYear?.label ?? "selected year"}
          </h3>
          <div className="mt-5 space-y-4">
            {selectedYearServices.length === 0 ? (
              <p className="text-sm leading-6 text-[#625950]">
                No services have been added for this year.
              </p>
            ) : null}
            {selectedYearServices.map((service) => (
              <form
                action={updateService}
                className="grid gap-3 rounded-md border border-[#eadcca] bg-white p-4"
                key={service.id}
              >
                <input name="id" type="hidden" value={service.id} />
                <input name="yearId" type="hidden" value={service.yearId} />
                <label className="text-sm font-semibold text-[#3c352f]">
                  Service name
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={service.name}
                    name="name"
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Date
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={service.serviceDate}
                      name="serviceDate"
                      required
                      type="date"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Time
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={service.serviceTime ?? ""}
                      name="serviceTime"
                      type="time"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Sort
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={service.sortOrder}
                      name="sortOrder"
                      type="number"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                    type="submit"
                  >
                    Update service
                  </button>
                  <button
                    className="rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
                    formAction={deleteService}
                    type="submit"
                  >
                    Delete service
                  </button>
                </div>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">Add honor</h3>
          {selectedYear && selectedYearServices.length > 0 ? (
            <form action={createHonor} className="mt-5 grid gap-4">
              <input name="yearId" type="hidden" value={selectedYear.id} />
              <label className="text-sm font-semibold text-[#3c352f]">
                Service
                <select
                  className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="serviceId"
                  required
                >
                  {selectedYearServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-[#3c352f]">
                Honor type
                <input
                  className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="honorType"
                  placeholder="Ark opening"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#3c352f]">
                  Prayer name
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    name="prayerName"
                  />
                </label>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Page number
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    name="pageNumber"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#3c352f]">
                  Estimated time
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    name="estimatedHonorTime"
                    type="time"
                  />
                </label>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Sort order
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue="0"
                    name="sortOrder"
                    type="number"
                  />
                </label>
              </div>
              <button
                className="rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                type="submit"
              >
                Save honor
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              Add at least one service before adding honors.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1d3c34]">
            Honors for {selectedYear?.label ?? "selected year"}
          </h3>
          <div className="mt-5 space-y-4">
            {selectedYearHonors.length === 0 ? (
              <p className="text-sm leading-6 text-[#625950]">
                No honors have been added for this year.
              </p>
            ) : null}
            {selectedYearHonors.map((honor) => (
              <form
                action={updateHonor}
                className="grid gap-3 rounded-md border border-[#eadcca] bg-white p-4"
                key={honor.id}
              >
                <input name="id" type="hidden" value={honor.id} />
                <input name="yearId" type="hidden" value={honor.yearId} />
                <div className="rounded-md bg-[#f8f3ea] px-3 py-2 text-sm text-[#625950]">
                  {honor.serviceName} - {formatServiceDate(honor.serviceDate)}
                  {honor.serviceTime ? ` at ${honor.serviceTime}` : ""}
                </div>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Service
                  <select
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={honor.serviceId}
                    name="serviceId"
                    required
                  >
                    {selectedYearServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Honor type
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={honor.honorType}
                    name="honorType"
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm font-semibold text-[#3c352f] sm:col-span-2">
                    Prayer name
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={honor.prayerName}
                      name="prayerName"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Page
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={honor.pageNumber}
                      name="pageNumber"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Sort
                    <input
                      className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                      defaultValue={honor.sortOrder}
                      name="sortOrder"
                      type="number"
                    />
                  </label>
                </div>
                <label className="text-sm font-semibold text-[#3c352f]">
                  Estimated time
                  <input
                    className="mt-2 w-full rounded-md border border-[#cdbb9f] px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                    defaultValue={honor.estimatedHonorTime ?? ""}
                    name="estimatedHonorTime"
                    type="time"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                    type="submit"
                  >
                    Update honor
                  </button>
                  <button
                    className="rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
                    formAction={deleteHonor}
                    type="submit"
                  >
                    Delete honor
                  </button>
                </div>
              </form>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
