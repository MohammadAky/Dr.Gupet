import { expect, it } from "vitest";
import { uploadedImagePath } from "./uploaded-image";

it.each(["/uploads/photo.webp", "https://api.example.test/uploads/photo.webp", "http://127.0.0.1:3014/uploads/photo.webp"])("uses only the raster upload path from %s", value => {
  expect(uploadedImagePath(value)).toBe("/uploads/photo.webp");
});
it.each([undefined, "", "https://user:pass@api.test/uploads/a.webp", "https://@api.test/uploads/a.webp", "https://api.test/uploads/a.webp?token=x", "https://api.test/uploads/a.webp#x", "https://api.test/uploads/../uploads/a.webp", "https://api.test/uploads/%2e%2e/a.webp", "//api.test/uploads/a.webp", "/uploads/a.svg", "/brand/a.webp", "/uploads/a.webp?x=1", "javascript:/uploads/a.webp", "/uploads/" + "a".repeat(501) + ".webp"])("rejects malformed or non-upload content %s", value => {
  expect(uploadedImagePath(value)).toBeNull();
});
