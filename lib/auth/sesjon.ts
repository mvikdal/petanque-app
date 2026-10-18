import { createHmac, timingSafeEqual } from "node:crypto";

// Sesjonen er en signert cookie (HMAC-SHA256 med SESSION_SECRET), ikke
// en databaserad. Den gjelder én klubb om gangen - logger man inn i en
// annen klubb, erstattes den. Superadmin-sesjonen har klubb = null.
// Brukes både av proxy.ts og av server-koden, så den har ingen
// avhengighet til next/headers eller databasen.

export const SESJONSCOOKIE = "sesjon";
export const SESJONSLEVETID_SEKUNDER = 30 * 24 * 60 * 60;

export type Sesjon = {
  brukerId: string;
  klubb: { id: string; slug: string } | null;
  utløper: number; // millisekunder siden epoch
};

function hemmelighet(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET mangler eller er for kort (minst 32 tegn).");
  }
  return s;
}

function signer(data: string): string {
  return createHmac("sha256", hemmelighet()).update(data).digest("base64url");
}

export function lagSesjonstoken(sesjon: Omit<Sesjon, "utløper">): string {
  const innhold: Sesjon = { ...sesjon, utløper: Date.now() + SESJONSLEVETID_SEKUNDER * 1000 };
  const data = Buffer.from(JSON.stringify(innhold)).toString("base64url");
  return `${data}.${signer(data)}`;
}

export function lesSesjonstoken(token: string | undefined): Sesjon | null {
  if (!token) return null;
  const [data, signatur] = token.split(".");
  if (!data || !signatur) return null;

  const forventet = Buffer.from(signer(data));
  const faktisk = Buffer.from(signatur);
  if (forventet.length !== faktisk.length || !timingSafeEqual(forventet, faktisk)) {
    return null;
  }

  try {
    const sesjon = JSON.parse(Buffer.from(data, "base64url").toString()) as Sesjon;
    return sesjon.utløper > Date.now() ? sesjon : null;
  } catch {
    return null;
  }
}
