import Link from "next/link";

export const dynamic = "force-dynamic";

const adminSections = [
  {
    title: "Year and setup",
    description: "Configure the Jewish year, services, and honors.",
    href: "/admin/setup",
  },
  {
    title: "Assignments",
    description: "Upload assigned members or manage assignments manually.",
    href: "/admin/assignments",
  },
  {
    title: "Email invitations",
    description: "Send one invitation per honor assignment.",
    href: "/admin/email",
  },
  {
    title: "Response review",
    description: "Track pending, accepted, and declined honors.",
    href: "/admin/responses",
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
            <h2 className="text-lg font-semibold text-[#1d3c34]">
              {section.title}
            </h2>
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
