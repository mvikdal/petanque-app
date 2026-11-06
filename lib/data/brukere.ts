// Adminbrukere og deres tilgang til klubber. Ingen passord: man logger inn
// med en engangskode på e-post (lib/data/innloggingskoder.ts).
import { prisma } from "@/lib/prisma";

export type Rolle = "admin" | "demo";

export function normaliserEpost(epost: string) {
  return epost.trim().toLowerCase();
}

export async function finnBrukerForInnlogging(epost: string) {
  return prisma.adminBruker.findUnique({
    where: { epost: normaliserEpost(epost) },
    select: { id: true, epost: true, erSuperadmin: true },
  });
}

// Demo-admin i en klubb, for knappen «Prøv som demo» på /demo/admin/login.
export async function finnDemoAdmin(klubbId: string) {
  return prisma.klubbAdmin.findFirst({
    where: { klubbId, rolle: "demo", bruker: { erSuperadmin: false } },
    orderBy: { opprettet: "asc" },
    select: { brukerId: true },
  });
}

// Tilgangen en bruker har i én klubb, slått opp på nytt fra databasen hver
// gang (ikke fra cookien), så en fjernet admin mister tilgangen med en gang.
// Superadmin har admin-tilgang i alle klubber (avklart 2026-10-18).
export async function hentKlubbtilgang(
  brukerId: string,
  klubbId: string
): Promise<{ rolle: Rolle } | null> {
  const bruker = await prisma.adminBruker.findUnique({
    where: { id: brukerId },
    select: {
      erSuperadmin: true,
      klubber: { where: { klubbId }, select: { rolle: true } },
    },
  });
  if (!bruker) return null;
  const medlemskap = bruker.klubber[0];
  if (medlemskap) return { rolle: medlemskap.rolle === "demo" ? "demo" : "admin" };
  return bruker.erSuperadmin ? { rolle: "admin" } : null;
}

// Gir en bruker admin-tilgang i en klubb. Finnes e-posten fra før (f.eks.
// admin i en annen klubb), knyttes den eksisterende brukeren til klubben -
// ellers opprettes brukeren. Personen logger inn med e-postadressen sin.
export async function leggTilKlubbAdmin(
  klubbId: string,
  epost: string,
  rolle: Rolle
): Promise<{ nyBruker: boolean }> {
  const normalisert = normaliserEpost(epost);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisert)) {
    throw new Error("Ugyldig e-postadresse.");
  }
  if (!(await prisma.klubb.findUnique({ where: { id: klubbId } }))) {
    throw new Error("Klubben finnes ikke.");
  }

  const eksisterende = await prisma.adminBruker.findUnique({ where: { epost: normalisert } });
  if (eksisterende) {
    const alleredeAdmin = await prisma.klubbAdmin.findUnique({
      where: { brukerId_klubbId: { brukerId: eksisterende.id, klubbId } },
    });
    if (alleredeAdmin) throw new Error(`${normalisert} er allerede admin i klubben.`);
    await prisma.klubbAdmin.create({ data: { brukerId: eksisterende.id, klubbId, rolle } });
    return { nyBruker: false };
  }

  await prisma.adminBruker.create({
    data: { epost: normalisert, klubber: { create: { klubbId, rolle } } },
  });
  return { nyBruker: true };
}

export async function listKlubbAdmins(klubbId: string) {
  return prisma.klubbAdmin.findMany({
    where: { klubbId },
    orderBy: { opprettet: "asc" },
    select: { rolle: true, bruker: { select: { id: true, epost: true } } },
  });
}
