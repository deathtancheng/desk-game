export function cloudApiBase(): string {
  // Local dev uses the Next.js API routes; the static deployment uses the Sites Function.
  return process.env.NEXT_PUBLIC_CLOUD_BASE || "/api";
}
