export const adminSections = [
  "overview",
  "products",
  "orders",
  "people",
  "promotions",
  "care",
  "payments",
  "reports",
  "audit",
  "settings",
  "landing",
  "references",
  "popup",
] as const;
export type AdminSection = (typeof adminSections)[number];
export function parseAdminLocation(hash: string) {
  const [rawSection, query = ""] = hash.replace(/^#/, "").split("?");
  const section: AdminSection = adminSections.includes(
    rawSection as AdminSection,
  )
    ? (rawSection as AdminSection)
    : "overview";
  const incoming = new URLSearchParams(query);
  const params = new URLSearchParams();
  if (section === "orders") {
    const status = incoming.get("status");
    if (
      status &&
      [
        "PENDING_PAYMENT",
        "PAID",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELED",
      ].includes(status)
    )
      params.set("status", status);
    const order = incoming.get("order");
    if (
      order &&
      /^[1-9]\d*$/.test(order) &&
      Number.isSafeInteger(Number(order))
    )
      params.set("order", order);
  }
  if (section === "products" && incoming.get("active") === "false")
    params.set("active", "false");
  if (
    section === "payments" &&
    ["INITIATED", "SUCCESS", "FAILED"].includes(incoming.get("status") ?? "")
  )
    params.set("status", incoming.get("status")!);
  if (section === "reports" && incoming.get("focus") === "low")
    params.set("focus", "low");
  const canonical = `#${section}${params.size ? `?${params}` : ""}`;
  return { section, params, canonical };
}
