import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACTIVATION_COOKIE_NAME = "datarun_activation";
const ACTIVATION_LIFETIME_MS = 72 * 60 * 60 * 1000;

export type ActivationSession = {
  userId: string;
  codeHash: string;
  expiresAt: string;
};

function getSigningSecret() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("A chave secreta do Supabase não está configurada no servidor.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(`datarun:activation:${value}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function activationHashesMatch(left: string, right: string) {
  return safeEqual(left, right);
}

export function normalizeActivationCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function createActivationCode() {
  const token = randomBytes(12).toString("hex").toUpperCase();
  const groups = token.match(/.{1,4}/g) ?? [token];
  return `DR-${groups.join("-")}`;
}

export function hashActivationCode(userId: string, code: string) {
  const normalized = normalizeActivationCode(code);
  return createHmac("sha256", getSigningSecret())
    .update(`datarun:activation-code:${userId}:${normalized}`)
    .digest("hex");
}

export function activationCodeExpiration() {
  return new Date(Date.now() + ACTIVATION_LIFETIME_MS).toISOString();
}

export function activationCodeIsValid(expiresAt: string | null | undefined) {
  return Boolean(expiresAt) && new Date(expiresAt as string).getTime() > Date.now();
}

export function createActivationSession(userId: string, codeHash: string, expiresAt: string) {
  const payload = Buffer.from(JSON.stringify({ userId, codeHash, expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readActivationSession(value: string | undefined): ActivationSession | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ActivationSession>;
    if (typeof parsed.userId !== "string" || typeof parsed.codeHash !== "string" || typeof parsed.expiresAt !== "string") return null;
    if (!activationCodeIsValid(parsed.expiresAt)) return null;
    return { userId: parsed.userId, codeHash: parsed.codeHash, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function activationCookieOptions(expiresAt: string) {
  const seconds = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: seconds,
    path: "/",
  };
}
