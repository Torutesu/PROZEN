import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";

function getEncryptionKey(): string | null {
  return process.env["GITHUB_TOKEN_ENCRYPTION_KEY"] ??
    process.env["PROZEN_ENCRYPTION_KEY"] ??
    null;
}

function deriveKey(rawKey: string): Buffer {
  // Normalize arbitrary-length keys into a 32-byte AES-256 key.
  return createHash("sha256").update(rawKey).digest();
}

export function encryptSecret(plainText: string): string {
  const keyRaw = getEncryptionKey();
  if (!keyRaw) {
    throw new Error(
      "GITHUB_TOKEN_ENCRYPTION_KEY (or PROZEN_ENCRYPTION_KEY) is required.",
    );
  }

  const key = deriveKey(keyRaw);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) {
    // Backward compatibility for legacy plain-text rows.
    return value;
  }

  const keyRaw = getEncryptionKey();
  if (!keyRaw) {
    throw new Error(
      "Encrypted secret found but GITHUB_TOKEN_ENCRYPTION_KEY is not configured.",
    );
  }

  const payload = value.slice(PREFIX.length);
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted secret payload.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");
  const key = deriveKey(keyRaw);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

