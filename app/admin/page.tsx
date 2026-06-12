import Link from "next/link";

export const dynamic = "force-dynamic";

const adminSections = [
  {
    title: "Year and setup",
    description: "Configure the Jewish year, services, and honors.",
    status: "Ready",
    href: "/admin/setup",
  },
  {
    title: "Assignments",
    description: "Upload assigned members or manage assignments manually.",
    status: "Ready",
    href: "/admin/assignments",
  },
  {
    title: "Email invitations",
    description: "Send one invitation per honor assignment.",
    status: "Ready",
    href: "/admin/email",
  },
  {
    title: "Response review",
    description: "Track pending, accepted, and declined honors.",
    status: "Planned",
  },
];

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {adminSections.map((section) => (
          <article
            className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-5 shadow-sm"
            key={section.title}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#1d3c34]">
                {section.title}
              </h2>
              <span className="rounded-full bg-[#e8f2ef] px-3 py-1 text-xs font-semibold text-[#1d6f61]">
                {section.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#625950]">
              {section.description}
            </p>
            {section.href ? (
              <Link
                className="mt-5 inline-flex rounded-md bg-[#1d6f61] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185b50]"
                href={section.href}
              >
                Open {section.title.toLowerCase()}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
