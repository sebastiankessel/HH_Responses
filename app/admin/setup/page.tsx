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
import { hasValidAdminSession } from "@/lib/adminAuth";
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

type SetupTab = "years" | "services" | "honors";
type SetupMode = "grid" | "new" | "edit";
type SortDirection = "asc" | "desc";

type SearchParams = Promise<{
  yearId?: string;
  tab?: string;
  mode?: string;
  id?: string;
  q?: string;
  sort?: string;
  dir?: string;
  serviceId?: string;
}>;

type ServiceRow = Awaited<ReturnType<typeof listServicesForYear>>[number];
type HonorRow = Awaited<ReturnType<typeof listHonorsForYear>>[number];
type YearRow = Awaited<ReturnType<typeof listHighHolidayYears>>[number];

const tabs: Array<{ id: SetupTab; label: string; description: string }> = [
  {
    id: "years",
    label: "Set up Years",
    description: "Create and manage High Holiday years.",
  },
  {
    id: "services",
    label: "Set up Services",
    description: "Create the dated service schedule for a selected year.",
  },
  {
    id: "honors",
    label: "Set up Honors",
    description: "Create honors for the services in a selected year.",
  },
];

const inputClass =
  "w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]";
const compactInputClass =
  "w-full min-w-32 rounded-md border border-[#cdbb9f] bg-white px-2 py-1.5 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-[#cdbb9f] bg-white px-4 py-2 text-sm font-semibold text-[#3c352f] transition hover:bg-[#f8f3ea]";
const dangerButtonClass =
  "inline-flex items-center justify-center rounded-md border border-[#b99b6d] bg-white px-3 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]";

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

function getTab(value: string | undefined): SetupTab {
  return tabs.some((tab) => tab.id === value) ? (value as SetupTab) : "years";
}

function getMode(value: string | undefined): SetupMode {
  return value === "new" || value === "edit" ? value : "grid";
}

function getDirection(value: string | undefined): SortDirection {
  return value === "desc" ? "desc" : "asc";
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

function dateTimeValue(date: string, time: string | null | undefined) {
  return `${date}T${time || "00:00"}`;
}

function includesText(values: Array<string | number | null | undefined>, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function compareValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  dir: SortDirection
) {
  const direction = dir === "asc" ? 1 : -1;
  const left = typeof a === "boolean" ? Number(a) : a ?? "";
  const right = typeof b === "boolean" ? Number(b) : b ?? "";

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * direction;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * direction;
}

function setupHref({
  tab,
  yearId,
  mode,
  id,
  q,
  sort,
  dir,
  serviceId,
}: {
  tab: SetupTab;
  yearId?: number | null;
  mode?: SetupMode;
  id?: number | null;
  q?: string;
  sort?: string;
  dir?: SortDirection;
  serviceId?: number | null;
}) {
  const params = new URLSearchParams({ tab });
  if (tab !== "years" && yearId) {
    params.set("yearId", String(yearId));
  }
  if (mode && mode !== "grid") {
    params.set("mode", mode);
  }
  if (id) {
    params.set("id", String(id));
  }
  if (q) {
    params.set("q", q);
  }
  if (sort) {
    params.set("sort", sort);
  }
  if (dir) {
    params.set("dir", dir);
  }
  if (serviceId) {
    params.set("serviceId", String(serviceId));
  }

  return `/admin/setup?${params.toString()}`;
}

function sortHref(
  activeTab: SetupTab,
  selectedYearId: number | null,
  currentSort: string,
  currentDir: SortDirection,
  nextSort: string,
  q: string,
  serviceId?: number | null
) {
  const nextDir =
    currentSort === nextSort && currentDir === "asc" ? "desc" : "asc";
  return setupHref({
    tab: activeTab,
    yearId: selectedYearId,
    q,
    sort: nextSort,
    dir: nextDir,
    serviceId,
  });
}

function SortLink({
  href,
  active,
  dir,
  children,
}: {
  href: string;
  active: boolean;
  dir: SortDirection;
  children: React.ReactNode;
}) {
  return (
    <Link className="inline-flex items-center gap-1 hover:text-[#1d6f61]" href={href}>
      {children}
      {active ? <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span> : null}
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-[#cdbb9f] bg-white px-4 py-8 text-center text-sm leading-6 text-[#625950]">
      {children}
    </div>
  );
}

function Toolbar({
  activeTab,
  selectedYearId,
  q,
  sort,
  dir,
  serviceId,
  years,
}: {
  activeTab: SetupTab;
  selectedYearId: number | null;
  q: string;
  sort: string;
  dir: SortDirection;
  serviceId?: number | null;
  years: YearRow[];
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#eadcca] bg-[#fffaf2] p-4 lg:flex-row lg:items-end lg:justify-between">
      <form action="/admin/setup" className="grid gap-3 sm:grid-cols-[1fr_auto] lg:flex lg:items-end">
        <input name="tab" type="hidden" value={activeTab} />
        <input name="sort" type="hidden" value={sort} />
        <input name="dir" type="hidden" value={dir} />
        {serviceId ? <input name="serviceId" type="hidden" value={serviceId} /> : null}
        {activeTab !== "years" ? (
          <label className="text-sm font-semibold text-[#3c352f]">
            Year
            <select
              className={`mt-2 ${inputClass}`}
              defaultValue={selectedYearId ?? ""}
              name="yearId"
            >
              {years.length === 0 ? <option value="">No years created yet</option> : null}
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label} ({year.jewishYear})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-sm font-semibold text-[#3c352f]">
          Filter
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={q}
            name="q"
            placeholder="Search rows"
          />
        </label>
        <button className={secondaryButtonClass} type="submit">
          Apply
        </button>
      </form>
      <Link
        className={primaryButtonClass}
        href={setupHref({ tab: activeTab, yearId: selectedYearId, mode: "new" })}
      >
        Create New
      </Link>
    </div>
  );
}

function YearForm({
  year,
  suggestedJewishYear,
  years,
}: {
  year?: YearRow | null;
  suggestedJewishYear: number;
  years: YearRow[];
}) {
  const action = year ? updateYear : createYear;

  return (
    <form action={action} className="grid gap-5">
      <input name="tab" type="hidden" value="years" />
      {year ? <input name="id" type="hidden" value={year.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#3c352f]">
          Jewish year
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={year?.jewishYear ?? suggestedJewishYear}
            min="1"
            name="jewishYear"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-semibold text-[#3c352f]">
          Label
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={year?.label ?? `High Holidays ${suggestedJewishYear}`}
            name="label"
            required
          />
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold text-[#3c352f]">
        <input
          className="h-4 w-4 accent-[#1d6f61]"
          defaultChecked={year?.isActive ?? years.length === 0}
          name="isActive"
          type="checkbox"
        />
        Set as active admin year
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} type="submit">
          {year ? "Save Changes" : "Create Year"}
        </button>
        <Link className={secondaryButtonClass} href={setupHref({ tab: "years" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ServiceForm({
  service,
  selectedYearId,
}: {
  service?: ServiceRow | null;
  selectedYearId: number;
}) {
  const action = service ? updateService : createService;

  return (
    <form action={action} className="grid gap-5">
      <input name="tab" type="hidden" value="services" />
      <input name="yearId" type="hidden" value={selectedYearId} />
      {service ? <input name="id" type="hidden" value={service.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#3c352f] sm:col-span-2">
          Service name
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={service?.name ?? ""}
            name="name"
            placeholder="Erev Rosh Hashanah"
            required
          />
        </label>
        <label className="text-sm font-semibold text-[#3c352f]">
          Date
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={service?.serviceDate ?? ""}
            name="serviceDate"
            required
            type="date"
          />
        </label>
        <label className="text-sm font-semibold text-[#3c352f]">
          Time
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={service?.serviceTime ?? ""}
            name="serviceTime"
            type="time"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} type="submit">
          {service ? "Save Changes" : "Create Service"}
        </button>
        <Link
          className={secondaryButtonClass}
          href={setupHref({ tab: "services", yearId: selectedYearId })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function HonorForm({
  honor,
  selectedYearId,
  services,
}: {
  honor?: HonorRow | null;
  selectedYearId: number;
  services: ServiceRow[];
}) {
  const action = honor ? updateHonor : createHonor;

  return (
    <form action={action} className="grid gap-5">
      <input name="tab" type="hidden" value="honors" />
      <input name="yearId" type="hidden" value={selectedYearId} />
      {honor ? <input name="id" type="hidden" value={honor.id} /> : null}
      <label className="text-sm font-semibold text-[#3c352f]">
        Service
        <select
          className={`mt-2 ${inputClass}`}
          defaultValue={honor?.serviceId ?? services[0]?.id}
          name="serviceId"
          required
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {formatServiceDate(service.serviceDate)}
              {service.serviceTime ? ` at ${service.serviceTime}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-[#3c352f]">
        Honor type
        <input
          className={`mt-2 ${inputClass}`}
          defaultValue={honor?.honorType ?? ""}
          name="honorType"
          placeholder="Ark opening"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#3c352f]">
          Prayer name
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={honor?.prayerName ?? ""}
            name="prayerName"
          />
        </label>
        <label className="text-sm font-semibold text-[#3c352f]">
          Page number
          <input
            className={`mt-2 ${inputClass}`}
            defaultValue={honor?.pageNumber ?? ""}
            name="pageNumber"
          />
        </label>
      </div>
      <label className="text-sm font-semibold text-[#3c352f]">
        Estimated time
        <input
          className={`mt-2 ${inputClass}`}
          defaultValue={honor?.estimatedHonorTime ?? ""}
          name="estimatedHonorTime"
          type="time"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} type="submit">
          {honor ? "Save Changes" : "Create Honor"}
        </button>
        <Link
          className={secondaryButtonClass}
          href={setupHref({ tab: "honors", yearId: selectedYearId })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const isAuthorized = await hasValidAdminSession(cookieStore);

  if (!isAuthorized) {
    return null;
  }

  const db = getDb();
  const years = await listHighHolidayYears(db);
  const mostRecentYear = years[0] ?? (await getMostRecentYear(db));
  const suggestedJewishYear = await getSuggestedJewishYear(
    mostRecentYear?.jewishYear
  );

  const activeTab = getTab(params.tab);
  const mode = getMode(params.mode);
  const q = params.q?.trim() ?? "";
  const sort =
    params.sort ??
    (activeTab === "years" ? "jewishYear" : activeTab === "services" ? "dateTime" : "dateTime");
  const dir = params.dir ? getDirection(params.dir) : activeTab === "years" ? "desc" : "asc";
  const selectedYearId =
    toInt(params.yearId) ??
    years.find((year) => year.jewishYear === suggestedJewishYear)?.id ??
    mostRecentYear?.id ??
    null;
  const selectedYear =
    selectedYearId && activeTab !== "years"
      ? await getHighHolidayYearById(db, selectedYearId)
      : null;
  const selectedYearServices = selectedYear
    ? await listServicesForYear(db, selectedYear.id)
    : [];
  const selectedYearHonors = selectedYear
    ? await listHonorsForYear(db, selectedYear.id)
    : [];
  const serviceFilterId = toInt(params.serviceId);
  const editId = toInt(params.id);

  const filteredYears = years
    .filter((year) => includesText([year.label, year.jewishYear, year.isActive ? "active" : ""], q))
    .sort((a, b) => compareValues(a[sort as keyof YearRow], b[sort as keyof YearRow], dir));

  const filteredServices = selectedYearServices
    .filter((service) =>
      includesText(
        [service.name, service.serviceDate, service.serviceTime, formatServiceDate(service.serviceDate)],
        q
      )
    )
    .sort((a, b) => {
      if (sort === "dateTime") {
        return compareValues(
          dateTimeValue(a.serviceDate, a.serviceTime),
          dateTimeValue(b.serviceDate, b.serviceTime),
          dir
        );
      }

      return compareValues(a[sort as keyof ServiceRow], b[sort as keyof ServiceRow], dir);
    });

  const filteredHonors = selectedYearHonors
    .filter((honor) => !serviceFilterId || honor.serviceId === serviceFilterId)
    .filter((honor) =>
      includesText(
        [
          honor.honorType,
          honor.prayerName,
          honor.pageNumber,
          honor.estimatedHonorTime,
          honor.serviceName,
          honor.serviceDate,
          honor.serviceTime,
        ],
        q
      )
    )
    .sort((a, b) => {
      if (sort === "dateTime") {
        return compareValues(
          dateTimeValue(a.serviceDate, a.serviceTime),
          dateTimeValue(b.serviceDate, b.serviceTime),
          dir
        );
      }

      return compareValues(a[sort as keyof HonorRow], b[sort as keyof HonorRow], dir);
    });

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const editingYear = editId ? years.find((year) => year.id === editId) : null;
  const editingService = editId
    ? selectedYearServices.find((service) => service.id === editId)
    : null;
  const editingHonor = editId
    ? selectedYearHonors.find((honor) => honor.id === editId)
    : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a
            className="text-sm font-semibold text-[#1d6f61] hover:text-[#185b50]"
            href="/admin"
          >
            Back to admin
          </a>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d3c34]">
            Year and setup
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625950]">
            Configure years, services, and honors from focused setup submenus.
          </p>
        </div>
        {selectedYear && activeTab !== "years" ? (
          <div className="rounded-md border border-[#dfd1bd] bg-[#fffaf2] px-4 py-3 text-sm text-[#625950]">
            Current year:{" "}
            <span className="font-semibold text-[#1d3c34]">
              {selectedYear.label} ({selectedYear.jewishYear})
            </span>
          </div>
        ) : null}
      </div>

      <nav
        aria-label="Setup submenu"
        className="grid gap-3 border-b border-[#dfd1bd] pb-4 md:grid-cols-3"
      >
        {tabs.map((tab) => (
          <Link
            className={`rounded-md border px-4 py-3 text-sm transition ${
              activeTab === tab.id
                ? "border-[#1d6f61] bg-[#e8f2ef] text-[#1d3c34]"
                : "border-[#dfd1bd] bg-white text-[#625950] hover:border-[#1d6f61]"
            }`}
            href={setupHref({ tab: tab.id, yearId: selectedYearId })}
            key={tab.id}
          >
            <span className="block font-semibold">{tab.label}</span>
            <span className="mt-1 block leading-5">{tab.description}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-6 overflow-hidden rounded-lg border border-[#dfd1bd] bg-white shadow-sm">
        <div className="flex flex-col gap-3 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#1d3c34]">
              {mode === "new"
                ? `Create ${selectedTab.label.replace("Set up ", "").slice(0, -1)}`
                : mode === "edit"
                  ? `Edit ${selectedTab.label.replace("Set up ", "").slice(0, -1)}`
                  : selectedTab.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#625950]">
              {mode === "grid"
                ? "Review records in the grid, make quick inline changes, or open a full-screen editor."
                : "Use the full-screen form for changes that need more room."}
            </p>
          </div>
        </div>

        {mode === "grid" ? (
          <Toolbar
            activeTab={activeTab}
            dir={dir}
            q={q}
            selectedYearId={selectedYearId}
            serviceId={serviceFilterId}
            sort={sort}
            years={years}
          />
        ) : null}

        <div className="p-5">
          {mode === "new" && activeTab === "years" ? (
            <YearForm suggestedJewishYear={suggestedJewishYear} years={years} />
          ) : null}

          {mode === "edit" && activeTab === "years" ? (
            editingYear ? (
              <YearForm
                suggestedJewishYear={suggestedJewishYear}
                year={editingYear}
                years={years}
              />
            ) : (
              <EmptyState>That year record could not be found.</EmptyState>
            )
          ) : null}

          {mode === "new" && activeTab === "services" ? (
            selectedYearId ? (
              <ServiceForm selectedYearId={selectedYearId} />
            ) : (
              <EmptyState>Create a year before adding services.</EmptyState>
            )
          ) : null}

          {mode === "edit" && activeTab === "services" ? (
            selectedYearId && editingService ? (
              <ServiceForm selectedYearId={selectedYearId} service={editingService} />
            ) : (
              <EmptyState>That service record could not be found.</EmptyState>
            )
          ) : null}

          {mode === "new" && activeTab === "honors" ? (
            selectedYearId && selectedYearServices.length > 0 ? (
              <HonorForm selectedYearId={selectedYearId} services={selectedYearServices} />
            ) : (
              <EmptyState>Add at least one service before adding honors.</EmptyState>
            )
          ) : null}

          {mode === "edit" && activeTab === "honors" ? (
            selectedYearId && editingHonor ? (
              <HonorForm
                honor={editingHonor}
                selectedYearId={selectedYearId}
                services={selectedYearServices}
              />
            ) : (
              <EmptyState>That honor record could not be found.</EmptyState>
            )
          ) : null}

          {mode === "grid" && activeTab === "years" ? (
            filteredYears.length === 0 ? (
              <EmptyState>No High Holiday years match this view.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-[#f8f3ea] text-[#3c352f]">
                    <tr>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        <SortLink
                          active={sort === "jewishYear"}
                          dir={dir}
                          href={sortHref(activeTab, selectedYearId, sort, dir, "jewishYear", q)}
                        >
                          Jewish year
                        </SortLink>
                      </th>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        <SortLink
                          active={sort === "label"}
                          dir={dir}
                          href={sortHref(activeTab, selectedYearId, sort, dir, "label", q)}
                        >
                          Label
                        </SortLink>
                      </th>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        Active
                      </th>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredYears.map((year) => (
                      <tr className="align-top" key={year.id}>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <form action={updateYear} className="contents" id={`year-${year.id}`}>
                            <input name="tab" type="hidden" value="years" />
                            <input name="id" type="hidden" value={year.id} />
                            <input
                              className={compactInputClass}
                              defaultValue={year.jewishYear}
                              min="1"
                              name="jewishYear"
                              required
                              type="number"
                            />
                          </form>
                        </td>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <input
                            className={compactInputClass}
                            defaultValue={year.label}
                            form={`year-${year.id}`}
                            name="label"
                            required
                          />
                        </td>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <label className="flex items-center gap-2 text-sm font-semibold text-[#3c352f]">
                            <input
                              className="h-4 w-4 accent-[#1d6f61]"
                              defaultChecked={year.isActive}
                              form={`year-${year.id}`}
                              name="isActive"
                              type="checkbox"
                            />
                            Active
                          </label>
                        </td>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button className={primaryButtonClass} form={`year-${year.id}`} type="submit">
                              Save
                            </button>
                            <Link
                              className={secondaryButtonClass}
                              href={setupHref({ tab: "years", mode: "edit", id: year.id })}
                            >
                              Edit
                            </Link>
                            <button
                              className={dangerButtonClass}
                              form={`year-${year.id}`}
                              formAction={deleteYear}
                              type="submit"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {mode === "grid" && activeTab === "services" ? (
            !selectedYear ? (
              <EmptyState>Create or select a year before managing services.</EmptyState>
            ) : filteredServices.length === 0 ? (
              <EmptyState>No services match this view.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-[#f8f3ea] text-[#3c352f]">
                    <tr>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        <SortLink
                          active={sort === "dateTime"}
                          dir={dir}
                          href={sortHref(activeTab, selectedYearId, sort, dir, "dateTime", q)}
                        >
                          Date/time
                        </SortLink>
                      </th>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        <SortLink
                          active={sort === "name"}
                          dir={dir}
                          href={sortHref(activeTab, selectedYearId, sort, dir, "name", q)}
                        >
                          Service name
                        </SortLink>
                      </th>
                      <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((service) => (
                      <tr className="align-top" key={service.id}>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <form action={updateService} className="contents" id={`service-${service.id}`}>
                            <input name="tab" type="hidden" value="services" />
                            <input name="id" type="hidden" value={service.id} />
                            <input name="yearId" type="hidden" value={service.yearId} />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                className={compactInputClass}
                                defaultValue={service.serviceDate}
                                name="serviceDate"
                                required
                                type="date"
                              />
                              <input
                                className={compactInputClass}
                                defaultValue={service.serviceTime ?? ""}
                                name="serviceTime"
                                type="time"
                              />
                            </div>
                          </form>
                        </td>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <input
                            className={compactInputClass}
                            defaultValue={service.name}
                            form={`service-${service.id}`}
                            name="name"
                            required
                          />
                        </td>
                        <td className="border-b border-[#eadcca] px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button className={primaryButtonClass} form={`service-${service.id}`} type="submit">
                              Save
                            </button>
                            <Link
                              className={secondaryButtonClass}
                              href={setupHref({
                                tab: "services",
                                yearId: selectedYearId,
                                mode: "edit",
                                id: service.id,
                              })}
                            >
                              Edit
                            </Link>
                            <button
                              className={dangerButtonClass}
                              form={`service-${service.id}`}
                              formAction={deleteService}
                              type="submit"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {mode === "grid" && activeTab === "honors" ? (
            !selectedYear ? (
              <EmptyState>Create or select a year before managing honors.</EmptyState>
            ) : selectedYearServices.length === 0 ? (
              <EmptyState>Add services before managing honors.</EmptyState>
            ) : (
              <>
                <form
                  action="/admin/setup"
                  className="mb-4 flex flex-col gap-3 rounded-md border border-[#eadcca] bg-[#fffaf2] p-4 sm:flex-row sm:items-end"
                >
                  <input name="tab" type="hidden" value="honors" />
                  <input name="yearId" type="hidden" value={selectedYearId ?? ""} />
                  <input name="q" type="hidden" value={q} />
                  <input name="sort" type="hidden" value={sort} />
                  <input name="dir" type="hidden" value={dir} />
                  <label className="text-sm font-semibold text-[#3c352f]">
                    Service
                    <select
                      className={`mt-2 ${inputClass}`}
                      defaultValue={serviceFilterId ?? ""}
                      name="serviceId"
                    >
                      <option value="">All services</option>
                      {selectedYearServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={secondaryButtonClass} type="submit">
                    Filter services
                  </button>
                </form>

                {filteredHonors.length === 0 ? (
                  <EmptyState>No honors match this view.</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
                      <thead className="bg-[#f8f3ea] text-[#3c352f]">
                        <tr>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            <SortLink
                              active={sort === "dateTime"}
                              dir={dir}
                              href={sortHref(activeTab, selectedYearId, sort, dir, "dateTime", q, serviceFilterId)}
                            >
                              Service/date
                            </SortLink>
                          </th>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            <SortLink
                              active={sort === "honorType"}
                              dir={dir}
                              href={sortHref(activeTab, selectedYearId, sort, dir, "honorType", q, serviceFilterId)}
                            >
                              Honor
                            </SortLink>
                          </th>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            Prayer
                          </th>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            Page
                          </th>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            Estimated time
                          </th>
                          <th className="border-b border-[#dfd1bd] px-3 py-3 font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHonors.map((honor) => (
                          <tr className="align-top" key={honor.id}>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <form action={updateHonor} className="contents" id={`honor-${honor.id}`}>
                                <input name="tab" type="hidden" value="honors" />
                                <input name="id" type="hidden" value={honor.id} />
                                <input name="yearId" type="hidden" value={honor.yearId} />
                                <select
                                  className={compactInputClass}
                                  defaultValue={honor.serviceId}
                                  name="serviceId"
                                  required
                                >
                                  {selectedYearServices.map((service) => (
                                    <option key={service.id} value={service.id}>
                                      {service.name} - {service.serviceDate}
                                    </option>
                                  ))}
                                </select>
                              </form>
                              <div className="mt-2 text-xs leading-5 text-[#625950]">
                                {formatServiceDate(honor.serviceDate)}
                                {honor.serviceTime ? ` at ${honor.serviceTime}` : ""}
                              </div>
                            </td>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <input
                                className={compactInputClass}
                                defaultValue={honor.honorType}
                                form={`honor-${honor.id}`}
                                name="honorType"
                                required
                              />
                            </td>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <input
                                className={compactInputClass}
                                defaultValue={honor.prayerName}
                                form={`honor-${honor.id}`}
                                name="prayerName"
                                placeholder="Prayer"
                              />
                            </td>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <input
                                className={compactInputClass}
                                defaultValue={honor.pageNumber}
                                form={`honor-${honor.id}`}
                                name="pageNumber"
                                placeholder="Page"
                              />
                            </td>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <input
                                className={compactInputClass}
                                defaultValue={honor.estimatedHonorTime ?? ""}
                                form={`honor-${honor.id}`}
                                name="estimatedHonorTime"
                                type="time"
                              />
                            </td>
                            <td className="border-b border-[#eadcca] px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button className={primaryButtonClass} form={`honor-${honor.id}`} type="submit">
                                  Save
                                </button>
                                <Link
                                  className={secondaryButtonClass}
                                  href={setupHref({
                                    tab: "honors",
                                    yearId: selectedYearId,
                                    mode: "edit",
                                    id: honor.id,
                                  })}
                                >
                                  Edit
                                </Link>
                                <button
                                  className={dangerButtonClass}
                                  form={`honor-${honor.id}`}
                                  formAction={deleteHonor}
                                  type="submit"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          ) : null}
        </div>
      </section>
    </main>
  );
}
