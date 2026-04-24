import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { loadEnv } from "../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = "v1";

function getKey(): Buffer {
  const raw = loadEnv().AI_ENCRYPTION_KEY;
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    return "";
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) {
    return "";
  }
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    return "";
  }
  try {
    const [, ivB64, tagB64, encB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const enc = Buffer.from(encB64, "base64");
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      return "";
    }
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(payload: string): boolean {
  return typeof payload === "string" && payload.startsWith(`${VERSION}:`);
}
