import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCODING = "hex" as const;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

export function encrypt(plaintext: string): string {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) throw new Error("ENCRYPTION_KEY environment variable not set");

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: salt + iv + authTag + ciphertext (all hex)
  return [
    salt.toString(ENCODING),
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    encrypted.toString(ENCODING),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) throw new Error("ENCRYPTION_KEY environment variable not set");

  const [saltHex, ivHex, authTagHex, dataHex] = ciphertext.split(":");
  if (!saltHex || !ivHex || !authTagHex || !dataHex) {
    throw new Error("Invalid ciphertext format");
  }

  const salt = Buffer.from(saltHex, ENCODING);
  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);
  const encryptedData = Buffer.from(dataHex, ENCODING);

  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
