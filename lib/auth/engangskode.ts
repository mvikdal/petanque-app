import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { hemmelighet } from "@/lib/auth/sesjon";

// Engangskoder for innlogging (2026-10-24, erstatter passord). Koden er 6
// sifre og sendes på e-post. Bare en HMAC av koden lagres i databasen -
// en rask hash holder, siden koden er kortlivet og antall forsøk er
// begrenset (se lib/data/innloggingskoder.ts). Ingen databaseavhengighet.

export const KODELENGDE = 6;
export const KODE_LEVETID_MINUTTER = 10;
export const MAKS_FEIL_PER_KODE = 5;
export const MAKS_KODER_PER_TIME = 5;

export function lagKode(): string {
  return String(randomInt(0, 10 ** KODELENGDE)).padStart(KODELENGDE, "0");
}

// Mellomrom og bindestrek fjernes, i tilfelle koden limes inn som "123 456".
export function normaliserKode(kode: string): string {
  return kode.replace(/[\s-]/g, "");
}

export function hashKode(kode: string): string {
  return createHmac("sha256", hemmelighet()).update(`engangskode:${kode}`).digest("base64url");
}

export function kodeStemmer(kode: string, lagretHash: string): boolean {
  const forventet = Buffer.from(lagretHash);
  const faktisk = Buffer.from(hashKode(normaliserKode(kode)));
  return forventet.length === faktisk.length && timingSafeEqual(forventet, faktisk);
}
