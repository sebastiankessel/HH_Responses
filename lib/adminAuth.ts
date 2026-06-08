import { env } from "cloudflare:workers";

export const ADMIN_SESSION_COOKIE = "hh_admin_session";
const SESSION_PAYLOAD = "high-holiday-honors-admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const FALLBACK_ADMIN_PASSWORD = "change-this-high-holiday-password";

type RuntimeEnv = typeof env & {
  ADMIN_PASSWORD?: string;
};

export function getAdminPassword() {
  return (
    (env as RuntimeEnv).ADMIN_PASSWORD ??
    process.env.ADMIN_PASSWORD ??
    FALLBACK_ADMIN_PASSWORD
  );
}

export function getAdminSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}

export async function createAdminSessionToken() {
  const signature = await signSessionPayload(getAdminPassword());
  return `v1.${signature}`;
}

export async function isValidAdminSessionToken(token: string | undefined) {
  if (!token?.startsWith("v1.")) {
    return false;
  }

  const expected = await createAdminSessionToken();
  return timingSafeEqual(token, expected);
}

async function signSessionPayload(secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(SESSION_PAYLOAD)
  );

  return bufferToHex(signature);
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}
