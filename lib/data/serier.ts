// Klubbfiltrert datatilgang for serier, runder og spillere. Hver funksjon
// tar klubbId først og filtrerer alltid på den - direkte på Serie, og via
// serien for Spiller og Runde. En id fra en annen klubb gir null (eller
// kaster ved skriving), aldri data.
import { prisma } from "@/lib/prisma";
import { erGyldigPoengforskjell } from "@/lib/ranking";

// ---------- Lesing ----------

export async function listSerier(klubbId: string) {
  return prisma.serie.findMany({
    where: { klubbId },
    orderBy: { opprettet: "desc" },
    include: { _count: { select: { runder: true } } },
  });
}

export async function hentSerie(klubbId: string, serieId: string) {
  return prisma.serie.findFirst({
    where: { id: serieId, klubbId },
    include: { _count: { select: { runder: true } } },
  });
}

// Seriesiden: alle runder med deltakelser og spillernavn.
export async function hentSerieMedResultater(klubbId: string, serieId: string) {
  return prisma.serie.findFirst({
    where: { id: serieId, klubbId },
    include: {
      runder: {
        orderBy: { rundenummer: "desc" },
        include: { deltakelser: { include: { spiller: true } } },
      },
    },
  });
}

// Admin-oversikten over rundene i en serie.
export async function hentSerieMedRundeliste(klubbId: string, serieId: string) {
  return prisma.serie.findFirst({
    where: { id: serieId, klubbId },
    include: {
      runder: {
        orderBy: { rundenummer: "desc" },
        include: { _count: { select: { deltakelser: true, endringer: true } } },
      },
    },
  });
}

// Rundesiden: runden, hele serien (for oppsummering og plassbevegelse)
// og endringsloggen.
export async function hentRundeMedSerie(klubbId: string, serieId: string, rundeId: string) {
  return prisma.runde.findFirst({
    where: { id: rundeId, serieId, serie: { klubbId } },
    include: {
      serie: {
        include: {
          runder: { include: { deltakelser: { include: { spiller: true } } } },
        },
      },
      deltakelser: { include: { spiller: true } },
      endringer: { orderBy: { tidspunkt: "desc" } },
    },
  });
}

export async function hentRundeForRedigering(
  klubbId: string,
  serieId: string,
  rundeId: string
) {
  return prisma.runde.findFirst({
    where: { id: rundeId, serieId, serie: { klubbId } },
    include: { serie: true, deltakelser: true },
  });
}

export async function listSpillere(klubbId: string, serieId: string) {
  return prisma.spiller.findMany({
    where: { serieId, serie: { klubbId } },
    orderBy: { navn: "asc" },
  });
}

// ---------- Skriving ----------

async function krevSerie(klubbId: string, serieId: string) {
  const serie = await prisma.serie.findFirst({ where: { id: serieId, klubbId } });
  if (!serie) throw new Error("Serien finnes ikke i denne klubben.");
  return serie;
}

export async function opprettSerie(
  klubbId: string,
  data: {
    navn: string;
    ukedager: string;
    sesongStart: Date;
    poengGrense: number;
    antallTellendeRunder: number;
  }
) {
  const finnes = await prisma.serie.findFirst({ where: { klubbId, navn: data.navn } });
  if (finnes) throw new Error(`Serien «${data.navn}» finnes allerede i klubben.`);
  return prisma.serie.create({ data: { ...data, klubbId } });
}

export async function oppdaterSerie(
  klubbId: string,
  serieId: string,
  data: { navn: string; ukedager: string; antallTellendeRunder: number; status: string }
) {
  await krevSerie(klubbId, serieId);
  const navnTatt = await prisma.serie.findFirst({
    where: { klubbId, navn: data.navn, NOT: { id: serieId } },
  });
  if (navnTatt) throw new Error(`Serien «${data.navn}» finnes allerede i klubben.`);
  return prisma.serie.update({ where: { id: serieId, klubbId }, data });
}

export async function opprettSpiller(klubbId: string, serieId: string, navn: string) {
  await krevSerie(klubbId, serieId);
  const eksisterende = await prisma.spiller.findMany({ where: { serieId } });
  if (eksisterende.some((s) => s.navn.toLowerCase() === navn.toLowerCase())) {
    throw new Error(`"${navn}" er allerede registrert i denne serien.`);
  }
  return prisma.spiller.create({ data: { navn, serieId } });
}

export type NyDeltakelseInput = {
  spillerId: string;
  kamp1: number | null;
  kamp2: number | null;
  kamp3: number | null;
};

async function validerDeltakelser(
  serieId: string,
  poengGrense: number,
  deltakelser: NyDeltakelseInput[]
) {
  if (deltakelser.length === 0) {
    throw new Error("Minst én spiller må delta i runden");
  }

  // Spillerne må høre til serien (og dermed klubben, siden serien er
  // sjekket mot klubben før dette kalles).
  const antallSpillereISerie = await prisma.spiller.count({
    where: { serieId, id: { in: deltakelser.map((d) => d.spillerId) } },
  });
  if (antallSpillereISerie !== deltakelser.length) {
    throw new Error("En eller flere spillere hører ikke til denne serien.");
  }

  for (const d of deltakelser) {
    const kamper = [d.kamp1, d.kamp2, d.kamp3];
    if (kamper.every((k) => k === null)) {
      throw new Error("En spiller kan ikke registreres uten resultat for minst én kamp.");
    }
    for (const kamp of kamper) {
      if (kamp !== null && !erGyldigPoengforskjell(kamp, poengGrense)) {
        throw new Error(
          `Ugyldig poengforskjell (${kamp}). Må være et heltall mellom -${poengGrense} og ${poengGrense}, ulik 0.`
        );
      }
    }
  }
}

// Rundenummer skal alltid følge datoen (avklart 2026-10-15): eldste runde
// er runde 1. Ved samme dato beholdes den eksisterende innbyrdes rekkefølgen.
// Gjøres i to steg via negative midlertidige numre, fordi (serieId,
// rundenummer) er unik og to runder ellers kan kollidere underveis.
async function renummererRunderEtterDato(serieId: string) {
  const runder = await prisma.runde.findMany({
    where: { serieId },
    orderBy: [{ dato: "asc" }, { rundenummer: "asc" }],
    select: { id: true, rundenummer: true },
  });
  const endres = runder
    .map((r, i) => ({ id: r.id, fra: r.rundenummer, til: i + 1 }))
    .filter((r) => r.fra !== r.til);
  if (endres.length === 0) return;

  await prisma.$transaction([
    ...endres.map((r) =>
      prisma.runde.update({ where: { id: r.id }, data: { rundenummer: -r.til } })
    ),
    ...endres.map((r) =>
      prisma.runde.update({ where: { id: r.id }, data: { rundenummer: r.til } })
    ),
  ]);
}

// Engangsretting fra admin for serier der rundenummer og dato har kommet
// i utakt (f.eks. Demo-serie og Lillekula, rettet 2026-10-15).
export async function sorterRunderEtterDato(klubbId: string, serieId: string) {
  await krevSerie(klubbId, serieId);
  await renummererRunderEtterDato(serieId);
}

export async function opprettRunde(
  klubbId: string,
  serieId: string,
  dato: Date,
  deltakelser: NyDeltakelseInput[]
) {
  const serie = await krevSerie(klubbId, serieId);
  await validerDeltakelser(serieId, serie.poengGrense, deltakelser);

  const siste = await prisma.runde.findFirst({
    where: { serieId },
    orderBy: { rundenummer: "desc" },
  });

  const runde = await prisma.runde.create({
    data: {
      serieId,
      dato,
      rundenummer: (siste?.rundenummer ?? 0) + 1,
      deltakelser: {
        create: deltakelser.map((d) => ({
          spillerId: d.spillerId,
          kamp1: d.kamp1,
          kamp2: d.kamp2,
          kamp3: d.kamp3,
        })),
      },
    },
  });

  // En runde kan registreres med en dato før tidligere runder.
  await renummererRunderEtterDato(serieId);
  return runde;
}

// Admin-mulighet for å rette en allerede lagret runde (§ ny avklaring
// 2026-09-14) - kan gjøres på en hvilken som helst runde, uansett alder.
// Hver retting logges i RundeEndring med tidspunkt, valgfri kommentar, og
// en snapshot av deltakelsene slik de var før rettingen.
export async function oppdaterRunde(
  klubbId: string,
  rundeId: string,
  dato: Date,
  deltakelser: NyDeltakelseInput[],
  kommentar: string
) {
  const runde = await prisma.runde.findFirst({
    where: { id: rundeId, serie: { klubbId } },
    include: { serie: true, deltakelser: { include: { spiller: true } } },
  });
  if (!runde) throw new Error("Runden finnes ikke i denne klubben.");

  await validerDeltakelser(runde.serieId, runde.serie.poengGrense, deltakelser);

  const forrigeData = JSON.stringify(
    runde.deltakelser.map((d) => ({
      spillerNavn: d.spiller.navn,
      kamp1: d.kamp1,
      kamp2: d.kamp2,
      kamp3: d.kamp3,
    }))
  );

  await prisma.$transaction([
    prisma.deltakelse.deleteMany({ where: { rundeId } }),
    prisma.runde.update({
      where: { id: rundeId },
      data: {
        dato,
        deltakelser: {
          create: deltakelser.map((d) => ({
            spillerId: d.spillerId,
            kamp1: d.kamp1,
            kamp2: d.kamp2,
            kamp3: d.kamp3,
          })),
        },
      },
    }),
    prisma.rundeEndring.create({
      data: { rundeId, kommentar: kommentar.trim() || null, forrigeData },
    }),
  ]);

  // En rettet dato kan flytte runden i rekkefølgen.
  await renummererRunderEtterDato(runde.serieId);
  return runde;
}
