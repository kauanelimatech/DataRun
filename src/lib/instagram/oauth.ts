import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type InstagramOAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};

type TokenPayload = {
  access_token: string;
  user_id?: string | number;
  expires_in?: number;
  permissions?: string[];
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} não está configurada no servidor.`);
  return value;
}

function encryptionKey() {
  const key = Buffer.from(required(process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY, "INSTAGRAM_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("INSTAGRAM_TOKEN_ENCRYPTION_KEY deve conter uma chave Base64 de 32 bytes.");
  return key;
}

export function getInstagramOAuthConfig(): InstagramOAuthConfig {
  return {
    appId: required(process.env.INSTAGRAM_APP_ID, "INSTAGRAM_APP_ID"),
    appSecret: required(process.env.INSTAGRAM_APP_SECRET, "INSTAGRAM_APP_SECRET"),
    redirectUri: required(process.env.INSTAGRAM_REDIRECT_URI, "INSTAGRAM_REDIRECT_URI"),
  };
}

export function encryptInstagramToken(value: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), initializationVector);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${initializationVector.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptInstagramToken(value: string) {
  const [version, initializationVector, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !initializationVector || !tag || !ciphertext) throw new Error("O token do Instagram armazenado não está em um formato válido.");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(initializationVector, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function createInstagramAuthorizationUrl(state: string) {
  const config = getInstagramOAuthConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_insights");
  url.searchParams.set("state", state);
  return url;
}

async function requestToken(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => null) as TokenPayload | null;
  if (!response.ok || !payload?.access_token) throw new Error("A Meta não autorizou a conexão com o Instagram.");
  return payload;
}

export async function exchangeInstagramAuthorizationCode(code: string) {
  const config = getInstagramOAuthConfig();
  const body = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  });
  const shortLivedToken = await requestToken("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const exchangeUrl = new URL("https://graph.instagram.com/access_token");
  exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
  exchangeUrl.searchParams.set("client_secret", config.appSecret);
  exchangeUrl.searchParams.set("access_token", shortLivedToken.access_token);
  const longLivedToken = await requestToken(exchangeUrl.toString(), { method: "GET" });

  return {
    accessToken: longLivedToken.access_token,
    userId: String(longLivedToken.user_id ?? shortLivedToken.user_id ?? ""),
    expiresIn: longLivedToken.expires_in ?? shortLivedToken.expires_in ?? null,
    scopes: longLivedToken.permissions ?? shortLivedToken.permissions ?? ["instagram_business_basic", "instagram_business_manage_insights"],
  };
}

export async function getInstagramAccount(accessToken: string, fallbackUserId: string) {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "id,user_id,username,account_type");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null) as { id?: string | number; user_id?: string | number; username?: string } | null;
  const userId = payload?.user_id ?? payload?.id ?? fallbackUserId;
  if (!response.ok || !userId) throw new Error("Não foi possível identificar a conta profissional autorizada.");
  return { userId: String(userId), username: payload?.username ?? null };
}
