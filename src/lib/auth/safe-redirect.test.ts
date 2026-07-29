import { describe, it, expect } from "vitest";
import { sanitizeNextPath } from "./safe-redirect";

describe("sanitizeNextPath", () => {
  it("allows a valid internal path", () => {
    expect(sanitizeNextPath("/account/requests")).toBe("/account/requests");
  });

  it("falls back to /account when missing", () => {
    expect(sanitizeNextPath(null)).toBe("/account");
    expect(sanitizeNextPath(undefined)).toBe("/account");
    expect(sanitizeNextPath("")).toBe("/account");
  });

  it("rejects absolute external URLs", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/account");
    expect(sanitizeNextPath("http://evil.com/account")).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/account");
  });

  it("rejects a path without a leading slash", () => {
    expect(sanitizeNextPath("evil.com")).toBe("/account");
  });

  it("rejects embedded scheme / backslash tricks", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/account");
    expect(sanitizeNextPath("/redirect?to=javascript://evil")).toBe("/account");
  });
});
