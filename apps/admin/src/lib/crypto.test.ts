import { beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("crypto helpers", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "unit-test-key";
  });

  it("encrypts and decrypts payloads symmetrically", () => {
    const raw = "secret-token-123";
    const encrypted = encrypt(raw);

    expect(encrypted).not.toBe(raw);
    expect(encrypted.split(":")).toHaveLength(4);
    expect(decrypt(encrypted)).toBe(raw);
  });

  it("throws for malformed ciphertext", () => {
    expect(() => decrypt("bad-format")).toThrow("Invalid ciphertext format");
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow("ENCRYPTION_KEY environment variable not set");
  });
});
