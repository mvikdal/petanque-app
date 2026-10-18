// Oppretter (eller oppdaterer) demo-admin i Demo-klubben, med e-post og
// passord fra DEMO_ADMIN_EPOST og DEMO_ADMIN_PASSORD - de samme som vises
// på /demo/admin/login. Kjør på nytt hvis verdiene endres:
//
//   npx tsx --env-file=.env scripts/opprett-demo-admin.ts
//
// Demo-admin får rollen "demo": kan registrere og rette resultater, men
// ikke bytte passord eller opprette brukere.
import { PrismaClient } from "@prisma/client";
import { hashPassord, MIN_PASSORDLENGDE } from "@/lib/auth/passord";

const prisma = new PrismaClient();

async function main() {
  const epost = process.env.DEMO_ADMIN_EPOST?.trim().toLowerCase();
  const passord = process.env.DEMO_ADMIN_PASSORD;
  if (!epost || !passord || passord.length < MIN_PASSORDLENGDE) {
    throw new Error(
      `Sett DEMO_ADMIN_EPOST og DEMO_ADMIN_PASSORD (passord minst ${MIN_PASSORDLENGDE} tegn).`
    );
  }

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

  const passordHash = await hashPassord(passord);
  const bruker = await prisma.adminBruker.upsert({
    where: { epost },
    create: { epost, passordHash },
    update: { passordHash },
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
