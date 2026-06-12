import Link from "next/link";
import { getDb } from "@/db";
import {
  getRsvpAssignmentByToken,
  getRsvpResponseForAssignment,
  listRsvpServiceOptionsForYear,
} from "@/db/helpers";
import { submitRsvp } from "./actions";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ token: string }>;

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

function detailValue(values: Array<string | number | null>) {
  return values.filter(Boolean).join(" | ");
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f3ea] px-5 py-8 text-[#231f20]">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="text-sm font-semibold uppercase text-[#1d3c34] sm:tracking-[0.18em]"
            href="/"
          >
            Congregation Ner Tamid
          </Link>
          <span className="text-xs font-semibold uppercase text-[#8b5f2f] sm:text-right sm:tracking-[0.16em]">
            Jewish Spirit - Modern Experience
          </span>
        </nav>
        {children}
      </div>
    </main>
  );
}

function InvalidToken() {
  return (
    <PageShell>
      <section className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8b5f2f]">
          RSVP link
        </p>
        <h1 className="mt-4 text-2xl font-semibold leading-tight text-[#1d3c34] sm:text-3xl">
          We could not find this honor invitation.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#625950]">
          This link may be incomplete or no longer active. Please contact
          Sebastian Kessel at{" "}
          <a
            className="font-semibold text-[#1d6f61] underline-offset-4 hover:underline"
            href="mailto:ritualvp@nertamid.com"
          >
            ritualvp@nertamid.com
          </a>{" "}
          and he can help confirm your High Holiday honor assignment.
        </p>
      </section>
    </PageShell>
  );
}

export default async function RsvpPage({ params }: { params: PageParams }) {
  const { token } = await params;
  const db = getDb();
  const assignment = await getRsvpAssignmentByToken(db, token);

  if (!assignment) {
    return <InvalidToken />;
  }

  const response = await getRsvpResponseForAssignment(db, assignment.id);
  const serviceOptions = response
    ? []
    : await listRsvpServiceOptionsForYear(db, assignment.yearId);
  const serviceTime = formatTime(assignment.serviceTime);
  const estimatedTime = formatTime(assignment.estimatedHonorTime);
  const honorDetails = detailValue([
    assignment.prayerName,
    assignment.pageNumber ? `Page ${assignment.pageNumber}` : null,
    estimatedTime ? `Estimated ${estimatedTime}` : null,
  ]);

  return (
    <PageShell>
      <section className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8b5f2f] sm:tracking-[0.18em]">
          High Holiday honors RSVP
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-[#1d3c34] sm:text-4xl">
          {assignment.memberName}, please respond to your honor invitation.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#625950]">
          Congregation Ner Tamid of South Bay is grateful for your
          participation in {assignment.yearLabel}.
        </p>

        <div className="mt-7 grid gap-4 rounded-lg border border-[#eadcca] bg-white p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5f2f]">
              Assigned honor
            </p>
            <p className="mt-2 text-xl font-semibold text-[#1d3c34]">
              {assignment.honorType}
            </p>
            {honorDetails ? (
              <p className="mt-2 text-sm leading-6 text-[#625950]">
                {honorDetails}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5f2f]">
              Service
            </p>
            <p className="mt-2 text-xl font-semibold text-[#1d3c34]">
              {assignment.serviceName}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#625950]">
              {formatDate(assignment.serviceDate)}
              {serviceTime ? ` at ${serviceTime}` : ""}
            </p>
          </div>
        </div>

        {response ? (
          <div className="mt-7 rounded-lg border border-[#b7d8cf] bg-[#edf7f3] p-5">
            <h2 className="text-xl font-semibold text-[#1d3c34]">
              Your RSVP has been received.
            </h2>
            <dl className="mt-4 grid gap-3 text-sm text-[#3c352f]">
              <div>
                <dt className="font-semibold">Response</dt>
                <dd className="mt-1 capitalize">{response.status}</dd>
              </div>
              {response.status === "declined" ? (
                <>
                  <div>
                    <dt className="font-semibold">Reschedule request</dt>
                    <dd className="mt-1">
                      {response.wantsReschedule === "yes"
                        ? "Yes"
                        : response.wantsReschedule === "unsure"
                          ? "Not sure, please contact me"
                          : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold">
                      Services you expect to attend
                    </dt>
                    <dd className="mt-1">
                      {response.attendedServices.length > 0
                        ? response.attendedServices
                            .map((service) => service.name)
                            .join(", ")
                        : "None selected"}
                    </dd>
                  </div>
                </>
              ) : null}
              {response.notes ? (
                <div>
                  <dt className="font-semibold">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{response.notes}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-5 text-sm leading-6 text-[#625950]">
              Submitted RSVP responses cannot be edited from this link. Please
              contact Sebastian Kessel at{" "}
              <a
                className="font-semibold text-[#1d6f61] underline-offset-4 hover:underline"
                href="mailto:ritualvp@nertamid.com"
              >
                ritualvp@nertamid.com
              </a>{" "}
              if something changes.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <form
              action={submitRsvp}
              className="rounded-lg border border-[#eadcca] bg-white p-5"
            >
              <input name="token" type="hidden" value={token} />
              <input name="status" type="hidden" value="accepted" />
              <h2 className="text-xl font-semibold text-[#1d3c34]">
                Accept this honor
              </h2>
              <label className="mt-4 block text-sm font-semibold text-[#3c352f]">
                Notes for the office
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="notes"
                />
              </label>
              <button
                className="mt-4 w-full rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                type="submit"
              >
                Accept honor
              </button>
            </form>

            <form
              action={submitRsvp}
              className="rounded-lg border border-[#eadcca] bg-white p-5"
            >
              <input name="token" type="hidden" value={token} />
              <input name="status" type="hidden" value="declined" />
              <h2 className="text-xl font-semibold text-[#1d3c34]">
                Decline this honor
              </h2>
              <fieldset className="mt-4 grid gap-3">
                <legend className="text-sm font-semibold text-[#3c352f]">
                  Would you like the office to try to reschedule this honor if
                  possible?
                </legend>
                {[
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["unsure", "Not sure / please contact me"],
                ].map(([value, label]) => (
                  <label
                    className="flex items-center gap-3 text-sm text-[#3c352f]"
                    key={value}
                  >
                    <input
                      className="h-4 w-4 accent-[#1d6f61]"
                      name="wantsReschedule"
                      required
                      type="radio"
                      value={value}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="mt-5 grid gap-3">
                <legend className="text-sm font-semibold text-[#3c352f]">
                  Which High Holiday services do you plan to attend?
                </legend>
                <p className="text-sm leading-6 text-[#625950]">
                  This optional information helps the office identify possible
                  alternatives.
                </p>
                {serviceOptions.map((service) => (
                  <label
                    className="flex items-start gap-3 text-sm text-[#3c352f]"
                    key={service.id}
                  >
                    <input
                      className="mt-1 h-4 w-4 accent-[#1d6f61]"
                      name="attendedServiceId"
                      type="checkbox"
                      value={service.id}
                    />
                    <span>
                      <span className="font-semibold">{service.name}</span>
                      <span className="block text-[#625950]">
                        {formatDate(service.serviceDate)}
                        {formatTime(service.serviceTime)
                          ? ` at ${formatTime(service.serviceTime)}`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="mt-5 block text-sm font-semibold text-[#3c352f]">
                Notes for the office
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
                  name="notes"
                />
              </label>
              <button
                className="mt-4 w-full rounded-md border border-[#b99b6d] bg-white px-4 py-3 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
                type="submit"
              >
                Decline honor
              </button>
            </form>
          </div>
        )}
      </section>
    </PageShell>
  );
}
