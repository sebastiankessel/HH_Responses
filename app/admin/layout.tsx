import { cookies } from "next/headers";
import { hasValidAdminSession } from "@/lib/adminAuth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthorized = await hasValidAdminSession(cookieStore);

  if (!isAuthorized) {
    return <AdminLogin />;
  }

  return (
    <main className="min-h-screen bg-[#f8f3ea] text-[#231f20]">
      <header className="border-b border-[#dfd1bd] bg-[#fffaf2]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5f2f]">
              Congregation Ner Tamid of South Bay
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1d3c34]">
              High Holiday Honors Admin
            </h1>
          </div>
          <form action="/admin/logout" method="post">
            <button
              className="rounded-md border border-[#b99b6d] px-4 py-2 text-sm font-semibold text-[#6b4a22] transition hover:bg-[#f2e5d0]"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}

function AdminLogin() {
  return (
    <main className="min-h-screen bg-[#f8f3ea] px-5 py-12 text-[#231f20]">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl items-center gap-10 md:grid-cols-[1fr_380px]">
        <div className="space-y-7">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b5f2f]">
            Jewish Spirit - Modern Experience
          </p>
          <div className="space-y-5">
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-[#1d3c34] sm:text-5xl">
              High Holiday honors coordination for Congregation Ner Tamid.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-[#5f5750]">
              Admin access is protected so the office can manage services,
              honors, invitations, and RSVP responses from one respectful,
              focused workspace.
            </p>
          </div>
        </div>

        <form
          action="/admin/login"
          className="rounded-lg border border-[#dfd1bd] bg-[#fffaf2] p-6 shadow-sm"
          method="post"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[#1d3c34]">
              Admin password
            </h2>
            <p className="text-sm leading-6 text-[#6d635b]">
              Enter the shared office password to continue.
            </p>
          </div>
          <label className="mt-6 block text-sm font-semibold text-[#3c352f]">
            Password
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-md border border-[#cdbb9f] bg-white px-3 py-2 text-base outline-none transition focus:border-[#1d6f61] focus:ring-2 focus:ring-[#b7d8cf]"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="mt-6 w-full rounded-md bg-[#1d6f61] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#185b50]"
            type="submit"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
