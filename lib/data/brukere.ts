// Adminbrukere og deres tilgang til klubber. Passord-hashen forlater
// aldri dette laget utenom til selve passordsjekken ved innlogging.
import { prisma } from "@/lib/prisma";
import { hashPassord, MIN_PASSORDLENGDE, sjekkPassord } from "@/lib/auth/passord";

export type Rolle = "admin" | "demo";

export async function finnBrukerForInnlogging(epost: string) {
  return prisma.adminBruker.findUnique({
    where: { epost: epost.trim().toLowerCase() },
    select: { id: true, passordHash: true, erSuperadmin: true },
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

export function sjekkPassordkrav(passord: string) {
  if (passord.length < MIN_PASSORDLENGDE) {
    throw new Error(`Passordet må ha minst ${MIN_PASSORDLENGDE} tegn.`);
  }
}

// Gir en bruker admin-tilgang i en klubb. Finnes e-posten fra før (f.eks.
// admin i en annen klubb), knyttes den eksisterende brukeren til klubben
// og passordet beholdes - ellers opprettes brukeren med passordet.
export async function leggTilKlubbAdmin(
  klubbId: string,
  epost: string,
  passord: string,
  rolle: Rolle
): Promise<{ nyBruker: boolean }> {
  const normalisert = epost.trim().toLowerCase();
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

  sjekkPassordkrav(passord);
  await prisma.adminBruker.create({
    data: {
      epost: normalisert,
      passordHash: await hashPassord(passord),
      klubber: { create: { klubbId, rolle } },
    },
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

// Brukeren bytter sitt eget passord og må oppgi det gamle.
export async function byttPassord(brukerId: string, gammelt: string, nytt: string) {
  sjekkPassordkrav(nytt);
  const bruker = await prisma.adminBruker.findUnique({ where: { id: brukerId } });
  if (!bruker || !(await sjekkPassord(gammelt, bruker.passordHash))) {
    throw new Error("Nåværende passord er feil.");
  }
  await prisma.adminBruker.update({
    where: { id: brukerId },
    data: { passordHash: await hashPassord(nytt) },
  });
}
