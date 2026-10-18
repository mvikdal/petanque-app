import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Passord lagres som scrypt-hash med tilfeldig salt (Node-innebygd, ingen
// ekstra avhengigheter). Format: "scrypt$<salt base64>$<hash base64>".
const scryptAsync = promisify(scrypt) as (
  passord: string,
  salt: Buffer,
  lengde: number
) => Promise<Buffer>;

const NØKKELLENGDE = 64;
export const MIN_PASSORDLENGDE = 10;

export async function hashPassord(passord: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(passord, salt, NØKKELLENGDE);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function sjekkPassord(passord: string, lagret: string): Promise<boolean> {
  const [algoritme, saltB64, hashB64] = lagret.split("$");
  if (algoritme !== "scrypt" || !saltB64 || !hashB64) return false;
  const forventet = Buffer.from(hashB64, "base64");
  const faktisk = await scryptAsync(passord, Buffer.from(saltB64, "base64"), forventet.length);
  return faktisk.length === forventet.length && timingSafeEqual(faktisk, forventet);
}

// Brukes når e-posten ikke finnes, så innlogging tar like lang tid uansett
// og ikke avslører hvilke e-poster som er registrert.
export const UBRUKELIG_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(NØKKELLENGDE).toString("base64");
