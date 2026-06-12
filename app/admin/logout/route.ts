import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

const SESSION_COOKIE_PATHS = ["/", "/admin", "/admin/"];

export async function POST(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  for (const path of SESSION_COOKIE_PATHS) {
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

  return response;
}
