// Oppretter (eller oppdaterer) en superadmin, som også blir admin i én
// klubb. Superadmin logger inn på /superadmin/login med en engangskode
// som sendes til e-postadressen:
//
//   npx tsx --env-file=.env scripts/opprett-superadmin.ts <epost> [klubbslug]
//
// klubbslug er "sinsen" hvis den utelates.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const epost = process.argv[2]?.trim().toLowerCase();
  const klubbSlug = process.argv[3] ?? "sinsen";

  if (!epost || !epost.includes("@")) {
    throw new Error("Oppgi e-post: npx tsx scripts/opprett-superadmin.ts <epost> [klubbslug]");
  }

  const klubb = await prisma.klubb.findUnique({ where: { slug: klubbSlug } });
  if (!klubb) throw new Error(`Fant ingen klubb med slug «${klubbSlug}».`);

  const bruker = await prisma.adminBruker.upsert({
    where: { epost },
    create: { epost, erSuperadmin: true },
    update: { erSuperadmin: true },
  });
  await prisma.klubbAdmin.upsert({
    where: { brukerId_klubbId: { brukerId: bruker.id, klubbId: klubb.id } },
    create: { brukerId: bruker.id, klubbId: klubb.id, rolle: "admin" },
    update: { rolle: "admin" },
  });

  console.log(`${epost} er superadmin og admin i ${klubb.navn}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
