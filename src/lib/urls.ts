import { headers } from "next/headers";

/** Base URL for links printed in QR codes. NEXT_PUBLIC_APP_URL wins; otherwise the request host. */
export function appUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function joinUrl(code: string): string {
  return `${appUrl()}/l/${code}`;
}
