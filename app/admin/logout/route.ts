import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUrl.protocol === "https:",
    path: "/admin",
    maxAge: 0,
  });

  return response;
}
