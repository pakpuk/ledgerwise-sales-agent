// Shared-password auth: a signed, expiring cookie. Web Crypto only, so it
// runs both in proxy.ts and in server actions.

export const SESSION_COOKIE = "lw_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (>=16 chars)");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionToken(now = Date.now()): Promise<{ token: string; maxAge: number }> {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  return { token: `${exp}.${await hmac(String(exp))}`, maxAge: TTL_SECONDS };
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmac(exp));
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD is not set");
  // Compare HMACs so length/timing doesn't leak.
  return safeEqual(await hmac(`pw:${input}`), await hmac(`pw:${pw}`));
}
