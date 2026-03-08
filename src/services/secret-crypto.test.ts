import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret-crypto.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("secret-crypto", () => {
  it("encrypts and decrypts with configured key", () => {
    vi.stubEnv("GITHUB_TOKEN_ENCRYPTION_KEY", "test-secret-key");
    const encrypted = encryptSecret("ghp_example");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain("ghp_example");
    expect(decryptSecret(encrypted)).toBe("ghp_example");
  });

  it("returns plaintext unchanged for legacy unencrypted values", () => {
    expect(decryptSecret("legacy_plain_token")).toBe("legacy_plain_token");
  });

  it("throws when key is missing during encryption", () => {
    vi.stubEnv("GITHUB_TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("PROZEN_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("abc")).toThrow();
  });
});

