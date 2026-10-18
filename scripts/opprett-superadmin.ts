// Oppretter (eller oppdaterer) en superadmin, som også blir admin i én
// klubb. Passordet leses fra miljøvariabelen NYTT_PASSORD, så det aldri
// havner i repoet eller i kommandohistorikken som argument:
//
//   PowerShell:  $env:NYTT_PASSORD = "..."; npx tsx scripts/opprett-superadmin.ts <epost> [klubbslug]
//   Bash:        NYTT_PASSORD="..." npx tsx scripts/opprett-superadmin.ts <epost> [klubbslug]
//
// klubbslug er "sinsen" hvis den utelates.
import { PrismaClient } from "@prisma/client";
import { hashPassord, MIN_PASSORDLENGDE } from "@/lib/auth/passord";

const prisma = new PrismaClient();

async function main() {
  const epost = process.argv[2]?.trim().toLowerCase();
  const klubbSlug = process.argv[3] ?? "sinsen";
  const passord = process.env.NYTT_PASSORD;

  if (!epost || !epost.includes("@")) {
    throw new Error("Oppgi e-post: npx tsx scripts/opprett-superadmin.ts <epost> [klubbslug]");
  }
  if (!passord || passord.length < MIN_PASSORDLENGDE) {
    throw new Error(`Sett NYTT_PASSORD (minst ${MIN_PASSORDLENGDE} tegn).`);
  }

  const klubb = await prisma.klubb.findUnique({ where: { slug: klubbSlug } });
  if (!klubb) throw new Error(`Fant ingen klubb med slug «${klubbSlug}».`);

  const passordHash = await hashPassord(passord);
  const bruker = await prisma.adminBruker.upsert({
    where: { epost },
    create: { epost, passordHash, erSuperadmin: true },
    update: { passordHash, erSuperadmin: true },
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
