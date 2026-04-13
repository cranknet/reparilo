import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "dotenv";

config();

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const AUTH_FILE = "e2e/.auth/admin.json";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim();

if (!ADMIN_PASSWORD) {
  console.error("SEED_ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

interface CookieData {
  domain: string;
  expires: number;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: "Strict" | "Lax" | "None";
  secure: boolean;
  value: string;
}

function parseCookies(setCookieHeaders: string[]): CookieData[] {
  return setCookieHeaders.map((header) => {
    const parts = header.split(";").map((p) => p.trim());
    const [nameValue] = parts;
    const [name, value] = nameValue.split("=");

    const cookie: CookieData = {
      name,
      value,
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    };

    for (const part of parts.slice(1)) {
      if (part.toLowerCase() === "httponly") {
        cookie.httpOnly = true;
      }
      if (part.toLowerCase() === "secure") {
        cookie.secure = true;
      }
      if (part.toLowerCase().startsWith("path=")) {
        cookie.path = part.slice(5);
      }
      if (part.toLowerCase().startsWith("domain=")) {
        cookie.domain = part.slice(7);
      }
      if (part.toLowerCase().startsWith("samesite=")) {
        cookie.sameSite = part.slice(9) as CookieData["sameSite"];
      }
      if (part.toLowerCase().startsWith("max-age=")) {
        const maxAge = Number.parseInt(part.slice(8), 10);
        cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
      }
    }

    return cookie;
  });
}

async function main() {
  console.log(`Authenticating at ${BASE_URL}...`);

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`CSRF fetch failed: ${csrfRes.status}`);
  }

  const csrfJson = (await csrfRes.json()) as { data?: { token?: string } };
  const csrfToken = csrfJson.data?.token;
  if (!csrfToken) {
    throw new Error(`No CSRF token in response: ${JSON.stringify(csrfJson)}`);
  }

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} - ${body}`);
  }

  const setCookies = loginRes.headers.getSetCookie();
  if (setCookies.length === 0) {
    throw new Error("No cookies in login response");
  }

  const cookies = parseCookies(setCookies);

  const csrfCookies = csrfRes.headers.getSetCookie();
  if (csrfCookies.length > 0) {
    cookies.push(...parseCookies(csrfCookies));
  }

  const storageState = { cookies, origins: [] };

  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));

  console.log(`Saved auth state to ${AUTH_FILE}`);
  console.log(`Cookies: ${cookies.map((c) => c.name).join(", ")}`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
