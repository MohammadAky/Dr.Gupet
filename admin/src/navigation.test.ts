import { expect, it } from "vitest";
import { parseAdminLocation } from "./navigation";

it("restores an allowlisted order location without carrying credentials or unknown filters", () => {
  const result = parseAdminLocation(
    "#orders?order=42&status=PAID&token=secret&redirect=https://example.com",
  );
  expect(result.canonical).toBe("#orders?status=PAID&order=42");
  expect(result.params.get("token")).toBeNull();
});
it("rejects unknown sections, invalid statuses and unsafe identifiers", () => {
  expect(parseAdminLocation("#unknown?token=secret").canonical).toBe(
    "#overview",
  );
  expect(parseAdminLocation("#orders?order=-2&status=ADMIN").canonical).toBe(
    "#orders",
  );
  expect(parseAdminLocation("#orders?order=9007199254740993").canonical).toBe(
    "#orders",
  );
  expect(
    parseAdminLocation("#products?active=true&password=secret").canonical,
  ).toBe("#products");
});

it("restores the scoped landing editor without carrying unknown query data", () => {
  expect(parseAdminLocation("#landing?token=private").canonical).toBe(
    "#landing",
  );
});
