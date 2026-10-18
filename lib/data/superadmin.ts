// Datatilgang for /superadmin: klubber og klubbadmins. Bevisst ingen
// tilgang til serier, runder eller spillere herfra - superadmin håndterer
// bare oppsett og brukere.
import { prisma } from "@/lib/prisma";
import { hashPassord } from "@/lib/auth/passord";
import { erGyldigSlug } from "@/lib/slug";
import { sjekkPassordkrav } from "@/lib/data/brukere";

export { leggTilKlubbAdmin } from "@/lib/data/brukere";

export async function erSuperadmin(brukerId: string): Promise<boolean> {
  const bruker = await prisma.adminBruker.findUnique({
    where: { id: brukerId },
    select: { erSuperadmin: true },
  });
  return bruker?.erSuperadmin === true;
}

export async function listKlubberMedAdmins() {
  return prisma.klubb.findMany({
    orderBy: { navn: "asc" },
    select: {
      id: true,
      slug: true,
      navn: true,
      _count: { select: { serier: true } },
      admins: {
        orderBy: { opprettet: "asc" },
        select: {
          rolle: true,
          bruker: { select: { id: true, epost: true, erSuperadmin: true } },
        },
      },
    },
  });
}

export async function opprettKlubb(navn: string, slug: string) {
  if (!navn) throw new Error("Navn er obligatorisk.");
  if (!erGyldigSlug(slug)) {
    throw new Error(
      `Ugyldig slug «${slug}». Bruk små bokstaver a-z, tall og bindestrek, og ikke et reservert ord.`
    );
  }
  if (await prisma.klubb.findUnique({ where: { navn } })) {
    throw new Error(`Klubben «${navn}» finnes allerede.`);
  }
  if (await prisma.klubb.findUnique({ where: { slug } })) {
    throw new Error(`Slugen «${slug}» er allerede i bruk.`);
  }
  return prisma.klubb.create({ data: { navn, slug } });
}

// Tilbakestilling gjelder klubbadmins. Superadmins passord settes med
// scripts/opprett-superadmin.ts, så ingen kan låse ute en superadmin herfra.
export async function tilbakestillPassord(brukerId: string, passord: string) {
  sjekkPassordkrav(passord);
  const bruker = await prisma.adminBruker.findUnique({ where: { id: brukerId } });
  if (!bruker) throw new Error("Brukeren finnes ikke.");
  if (bruker.erSuperadmin) {
    throw new Error("Superadmins passord settes med scripts/opprett-superadmin.ts.");
  }
  await prisma.adminBruker.update({
    where: { id: brukerId },
    data: { passordHash: await hashPassord(passord) },
  });
  return bruker.epost;
}
