// Engangsflytting av data ved klubbskillet (2026-10-18), se
// prisma/migrations/1_klubbskille. Kjøres ETTER at migreringen er lagt inn:
//
//   npx tsx scripts/migrer-klubber.ts          (tørrkjøring - endrer ingenting)
//   npx tsx scripts/migrer-klubber.ts --utfør  (gjør endringene, i én transaksjon)
//
// Stopper uten å endre noe hvis den finner serier den ikke kjenner, data
// i uventede klubber, eller spillere som brukes på tvers av serier.
import { PrismaClient } from "@prisma/client";

const SINSEN = { slug: "sinsen", navn: "Sinsen" };
const DEMO = { slug: "demo", navn: "Demo" };

const SERIE_TIL_KLUBB: Record<string, string> = {
  "Demo-serie": DEMO.slug,
  "Vinterkula 2026/27": SINSEN.slug,
  Lillekula: SINSEN.slug,
  SinsenGaloppen: SINSEN.slug,
};

const prisma = new PrismaClient();
const utfør = process.argv.includes("--utfør");

async function main() {
  const klubber = await prisma.klubb.findMany({
    include: { serier: { include: { _count: { select: { runder: true, spillere: true } } } } },
    orderBy: { opprettet: "asc" },
  });

  console.log("Klubber i databasen nå:");
  for (const k of klubber) {
    console.log(`  ${k.navn} (slug ${k.slug}, ${k.serier.length} serie(r))`);
    for (const s of k.serier) {
      const mål = SERIE_TIL_KLUBB[s.navn] ?? "UKJENT";
      console.log(
        `    - ${s.navn}: ${s._count.runder} runder, ${s._count.spillere} spillere → ${mål}`
      );
    }
  }

  const problemer: string[] = [];

  const alleSerier = klubber.flatMap((k) => k.serier.map((s) => ({ ...s, klubb: k })));
  for (const s of alleSerier) {
    if (!(s.navn in SERIE_TIL_KLUBB)) {
      problemer.push(`Ukjent serie «${s.navn}» i klubben ${s.klubb.navn}`);
    }
  }

  // Spillerregisteret er per serie, så en deltakelse skal aldri peke på en
  // spiller fra en annen serie enn rundens. Gjør den det, ville spilleren
  // blitt delt mellom klubber etter flyttingen.
  const kryssbruk = await prisma.$queryRaw<
    { spiller: string; spillerSerie: string; rundeSerie: string }[]
  >`
    SELECT sp."navn" AS spiller, ss."navn" AS "spillerSerie", rs."navn" AS "rundeSerie"
    FROM "Deltakelse" d
    JOIN "Spiller" sp ON sp."id" = d."spillerId"
    JOIN "Runde" r ON r."id" = d."rundeId"
    JOIN "Serie" ss ON ss."id" = sp."serieId"
    JOIN "Serie" rs ON rs."id" = r."serieId"
    WHERE sp."serieId" <> r."serieId"
  `;
  for (const k of kryssbruk) {
    problemer.push(
      `Spilleren «${k.spiller}» (registrert i ${k.spillerSerie}) har spilt i ${k.rundeSerie}`
    );
  }

  const kjenteSlugger = new Set([SINSEN.slug, DEMO.slug]);
  for (const k of klubber) {
    const erKjent =
      kjenteSlugger.has(k.slug) || k.navn === SINSEN.navn || k.navn === DEMO.navn;
    if (!erKjent && k.serier.length > 0) {
      problemer.push(`Klubben «${k.navn}» (slug ${k.slug}) har serier og er ikke Sinsen eller Demo`);
    }
  }

  if (problemer.length > 0) {
    console.log("\nSTOPP - dette må avklares før flyttingen:");
    for (const p of problemer) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  const finnKlubb = (k: { slug: string; navn: string }) =>
    klubber.find((x) => x.slug === k.slug) ?? klubber.find((x) => x.navn === k.navn);

  const plan: string[] = [];
  for (const k of [SINSEN, DEMO]) {
    const eksisterende = finnKlubb(k);
    if (!eksisterende) plan.push(`Opprett klubben ${k.navn} (${k.slug})`);
    else if (eksisterende.slug !== k.slug || eksisterende.navn !== k.navn) {
      plan.push(`Gi klubben «${eksisterende.navn}» navn ${k.navn} og slug ${k.slug}`);
    }
  }
  for (const s of alleSerier) {
    const mål = SERIE_TIL_KLUBB[s.navn];
    if (s.klubb.slug !== mål) plan.push(`Flytt ${s.navn} fra ${s.klubb.navn} til ${mål}`);
  }

  console.log(plan.length === 0 ? "\nIngenting å endre." : "\nEndringer:");
  for (const p of plan) console.log(`  - ${p}`);

  if (!utfør) {
    if (plan.length > 0) console.log("\nTørrkjøring - kjør med --utfør for å gjøre endringene.");
    return;
  }
  if (plan.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const klubbIder: Record<string, string> = {};
    for (const k of [SINSEN, DEMO]) {
      const eksisterende = finnKlubb(k);
      const lagret = eksisterende
        ? await tx.klubb.update({ where: { id: eksisterende.id }, data: k })
        : await tx.klubb.create({ data: k });
      klubbIder[k.slug] = lagret.id;
    }
    for (const s of alleSerier) {
      const klubbId = klubbIder[SERIE_TIL_KLUBB[s.navn]];
      if (s.klubbId !== klubbId) {
        await tx.serie.update({ where: { id: s.id }, data: { klubbId } });
      }
    }
  });

  console.log("\nFerdig.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
