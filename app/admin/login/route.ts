import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminPassword,
  getAdminSessionMaxAge,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");
  const redirectUrl = new URL("/admin", request.url);

  if (password !== getAdminPassword()) {
    redirectUrl.searchParams.set("error", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await createAdminSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUrl.protocol === "https:",
    path: "/admin",
    maxAge: getAdminSessionMaxAge(),
  });

  return response;
}
