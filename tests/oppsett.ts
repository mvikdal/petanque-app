import { existsSync } from "node:fs";
import { vi } from "vitest";

// Leses før noe annet importeres, slik at Prisma kobler til testdatabasen.
if (existsSync(".env")) process.loadEnvFile(".env");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Sett TEST_DATABASE_URL i .env til en egen Neon-branch for tester (aldri produksjon)."
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET ??= "test-hemmelighet-som-er-minst-32-tegn-lang";

// next/headers og next/cache finnes bare inne i en Next-forespørsel. Her
// erstattes cookies() med en enkel cookie-krukke som testene styrer, og
// revalidatePath() gjør ingenting.
export const cookieKrukke = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (navn: string) =>
      cookieKrukke.has(navn) ? { name: navn, value: cookieKrukke.get(navn)! } : undefined,
    set: (navn: string, verdi: string) => void cookieKrukke.set(navn, verdi),
    delete: (navn: string) => void cookieKrukke.delete(navn),
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));
