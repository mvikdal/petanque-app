// Oppretter (eller oppdaterer) demo-admin i Demo-klubben, med e-post fra
// DEMO_ADMIN_EPOST. Knappen «Prøv som demo» på /demo/admin/login logger
// inn som denne brukeren, uten kode. Kjør på nytt hvis verdien endres:
//
//   npx tsx --env-file=.env scripts/opprett-demo-admin.ts
//
// Demo-admin får rollen "demo": kan registrere og rette resultater, men
// ikke opprette brukere.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const epost = process.env.DEMO_ADMIN_EPOST?.trim().toLowerCase();
  if (!epost) throw new Error("Sett DEMO_ADMIN_EPOST.");

  const klubb = await prisma.klubb.findUnique({ where: { slug: "demo" } });
  if (!klubb) throw new Error("Fant ikke Demo-klubben (slug demo).");

  // Innloggingen er offentlig, så brukeren må aldri ha mer tilgang enn
  // demo-rollen i Demo-klubben.
  const eksisterende = await prisma.adminBruker.findUnique({
    where: { epost },
    include: { klubber: true },
  });
  if (
    eksisterende &&
    (eksisterende.erSuperadmin || eksisterende.klubber.some((k) => k.klubbId !== klubb.id))
  ) {
    throw new Error(`${epost} har tilgang utover Demo-klubben og kan ikke brukes som demo-admin.`);
  }

  const bruker = await prisma.adminBruker.upsert({
    where: { epost },
    create: { epost },
    update: {},
  });
  await prisma.klubbAdmin.upsert({
    where: { brukerId_klubbId: { brukerId: bruker.id, klubbId: klubb.id } },
    create: { brukerId: bruker.id, klubbId: klubb.id, rolle: "demo" },
    update: { rolle: "demo" },
  });

  console.log(`${epost} er demo-admin i ${klubb.navn}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
