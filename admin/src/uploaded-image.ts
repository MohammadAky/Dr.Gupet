/** Normalize only an authenticated upload response; never request its authority. */
export function uploadedImagePath(value: unknown): string | null {
  if (typeof value !== "string" || value.includes("@")) return null;
  const match = /^(?:https?:\/\/[^/?#]+)?(\/uploads\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:png|jpe?g|webp))$/.exec(value);
  if (!match || match[1]!.length > 500) return null;
  if (!value.startsWith("/")) {
    try { const url = new URL(value); if (url.username || url.password) return null; }
    catch { return null; }
  }
  return match[1]!;
}
