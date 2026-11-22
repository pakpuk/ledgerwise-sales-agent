import { beforeAll, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789";
  process.env.APP_PASSWORD = "hunter2";
});

describe("session", () => {
  it("round-trips a valid token", async () => {
    const { token } = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });
  it("rejects tampered and expired tokens", async () => {
    const { token } = await createSessionToken();
    expect(await verifySessionToken(token.replace(/^\d+/, "9999999999"))).toBe(false);
    const old = await createSessionToken(Date.now() - 8 * 24 * 3600 * 1000);
    expect(await verifySessionToken(old.token)).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });
  it("checks the shared password", async () => {
    expect(await checkPassword("hunter2")).toBe(true);
    expect(await checkPassword("nope")).toBe(false);
  });
});
