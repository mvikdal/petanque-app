import { expect } from "vitest";
import { hashPassord } from "@/lib/auth/passord";
import { lagSesjonstoken, SESJONSCOOKIE } from "@/lib/auth/sesjon";
import { prisma } from "@/lib/prisma";
import { cookieKrukke } from "./oppsett";

// To testklubber med hver sin serie, spillere og én runde, og brukere med
// ulike roller. Alt har prefikset vitest-, slik at det kan ryddes bort
// trygt - også etter en test som krasjet halvveis.
export const PASSORD = "vitest-passord-123";
const EPOST = (navn: string) => `${navn}@vitest.test`;

export async function ryddTestdata() {
  // Deltakelse → Spiller er RESTRICT, så deltakelsene må slettes før
  // klubben (og dermed serier og spillere) kan slettes.
  await prisma.deltakelse.deleteMany({
    where: { runde: { serie: { klubb: { slug: { startsWith: "vitest-" } } } } },
  });
  await prisma.klubb.deleteMany({ where: { slug: { startsWith: "vitest-" } } });
  await prisma.adminBruker.deleteMany({ where: { epost: { endsWith: "@vitest.test" } } });
}

async function lagKlubb(slug: string) {
  const klubb = await prisma.klubb.create({ data: { slug, navn: `Vitest ${slug}` } });
  const serie = await prisma.serie.create({
    data: { klubbId: klubb.id, navn: "Testserie", ukedager: "", sesongStart: new Date("2026-01-01") },
  });
  const [s1, s2] = await Promise.all(
    ["Anna", "Bjørn"].map((navn) => prisma.spiller.create({ data: { navn, serieId: serie.id } }))
  );
  const runde = await prisma.runde.create({
    data: {
      serieId: serie.id,
      dato: new Date("2026-01-05"),
      rundenummer: 1,
      deltakelser: {
        create: [
          { spillerId: s1.id, kamp1: 5, kamp2: 3, kamp3: -2 },
          { spillerId: s2.id, kamp1: -5, kamp2: -3, kamp3: 2 },
        ],
      },
    },
  });
  return { ...klubb, serieId: serie.id, spillerIder: [s1.id, s2.id], rundeId: runde.id };
}

async function lagBruker(navn: string, erSuperadmin: boolean, klubber: { id: string; rolle: string }[]) {
  return prisma.adminBruker.create({
    data: {
      epost: EPOST(navn),
      passordHash: await hashPassord(PASSORD),
      erSuperadmin,
      klubber: { create: klubber.map((k) => ({ klubbId: k.id, rolle: k.rolle })) },
    },
  });
}

export async function lagTestdata() {
  await ryddTestdata();
  const a = await lagKlubb("vitest-a");
  const b = await lagKlubb("vitest-b");
  const adminA = await lagBruker("admin-a", false, [{ id: a.id, rolle: "admin" }]);
  const adminB = await lagBruker("admin-b", false, [{ id: b.id, rolle: "admin" }]);
  const demoA = await lagBruker("demo-a", false, [{ id: a.id, rolle: "demo" }]);
  const superadmin = await lagBruker("super", true, []);
  return { a, b, adminA, adminB, demoA, superadmin };
}
export type Testdata = Awaited<ReturnType<typeof lagTestdata>>;

// Logger inn ved å legge en gyldig sesjonscookie i krukka.
export function loggInnSom(brukerId: string, klubb: { id: string; slug: string } | null) {
  cookieKrukke.set(
    SESJONSCOOKIE,
    lagSesjonstoken({ brukerId, klubb: klubb && { id: klubb.id, slug: klubb.slug } })
  );
}

export function loggUt() {
  cookieKrukke.clear();
}

// redirect() kaster en spesiell feil der målet ligger i digest-feltet.
export async function forventRedirect(løfte: Promise<unknown>): Promise<string> {
  try {
    await løfte;
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    expect(digest.startsWith("NEXT_REDIRECT"), `forventet redirect, fikk: ${e}`).toBe(true);
    return decodeURIComponent(digest.split(";")[2]);
  }
  throw new Error("Forventet redirect, men funksjonen fullførte uten.");
}

// Øyeblikksbilde av alt i en klubb, for å vise at et avvist forsøk ikke
// endret noe.
export async function tilstand(klubbId: string) {
  return prisma.klubb.findUniqueOrThrow({
    where: { id: klubbId },
    include: {
      admins: true,
      serier: {
        include: {
          spillere: { orderBy: { id: "asc" } },
          runder: { include: { deltakelser: { orderBy: { id: "asc" } }, endringer: true } },
        },
      },
    },
  });
}

export function skjema(felter: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(felter)) fd.set(k, v);
  return fd;
}
