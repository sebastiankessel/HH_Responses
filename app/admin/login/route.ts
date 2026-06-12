import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminPassword,
  getAdminSessionMaxAge,
} from "@/lib/adminAuth";

const LEGACY_SESSION_COOKIE_PATHS = ["/admin", "/admin/"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");
  const redirectUrl = new URL("/admin", request.url);

  if (password !== getAdminPassword()) {
    redirectUrl.searchParams.set("error", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const response = NextResponse.redirect(redirectUrl, 303);
  const maxAge = getAdminSessionMaxAge();
  for (const path of LEGACY_SESSION_COOKIE_PATHS) {
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: redirectUrl.protocol === "https:",
      path,
      maxAge: 0,
    });
  }
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await createAdminSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUrl.protocol === "https:",
    path: "/",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  });

  return response;
}
