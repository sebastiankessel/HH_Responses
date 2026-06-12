import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f3ea] text-[#231f20]">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-5 py-8">
        <nav className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="inline-flex items-center gap-3"
            href="/"
          >
            <img
              alt="Congregation Ner Tamid of South Bay"
              className="h-14 w-auto"
              src="/ner-tamid-logo.png"
            />
          </Link>
          <Link
            className="rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
            href="/admin"
          >
            Admin
          </Link>
        </nav>

        <div className="grid items-center gap-10 py-16 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-7">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b5f2f]">
              Jewish Spirit - Modern Experience
            </p>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[#1d3c34] sm:text-6xl">
                High Holiday honors RSVP coordination.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#5f5750]">
                A gracious response site for Congregation Ner Tamid of South
                Bay members invited to participate in High Holiday services.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-md bg-[#1d6f61] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#185b50]"
                href="/admin"
              >
                Open admin
              </Link>
              <span className="rounded-md border border-[#dfd1bd] px-5 py-3 text-center text-sm font-semibold text-[#6d635b]">
                Each honor has a unique RSVP link
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5f2f]">
              South Bay / Rancho Palos Verdes
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-[#1d3c34]">
              Honors invitations
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#625950]">
              Members receive a unique link for each assigned honor. The public
              RSVP page shows the honor, service date, and response options in
              a focused mobile-friendly flow.
            </p>
            <div className="mt-6 border-t border-[#eadcca] pt-5">
              <p className="text-sm font-semibold text-[#3c352f]">
                Office workspace
              </p>
              <p className="mt-2 text-sm leading-6 text-[#625950]">
                Admin screens cover setup, assignments, invitations, response
                review, and CSV exports behind a server-side password gate.
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-[#dfd1bd] pt-5 text-sm text-[#6d635b]">
          Congregation Ner Tamid of South Bay
        </footer>
      </section>
    </main>
  );
}
