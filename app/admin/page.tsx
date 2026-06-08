const adminSections = [
  {
    title: "Year and setup",
    description: "Configure the Jewish year, services, and honors.",
    status: "Next phase",
  },
  {
    title: "Assignment imports",
    description: "Upload assigned members and preview corrections.",
    status: "Planned",
  },
  {
    title: "Email invitations",
    description: "Send one invitation per honor assignment.",
    status: "Planned",
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
          </article>
        ))}
      </div>
    </section>
  );
}
