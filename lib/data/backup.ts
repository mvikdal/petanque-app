// Sikkerhetskopi per serie (2026-11-07). En kopi er hele serien som JSON:
// seriefeltene, spillerne, rundene, deltakelsene og endringsloggen, med de
// samme id-ene, så lenker til runder virker også etter en gjenoppretting.
// Kopiene ligger i SerieBackup, som ikke har relasjoner til serien og
// derfor blir liggende om serien slettes.
import type { SerieBackup } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Grunn = "automatisk" | "manuell" | "avsluttet" | "før gjenoppretting";

// Så mange automatiske kopier beholdes per serie. Kopier med andre grunner
// slettes aldri.
export const MAKS_AUTOMATISKE_KOPIER = 50;

// Økes hvis formatet endres, slik at gjenopprettingen kan lese eldre kopier.
const FORMATVERSJON = 1;

type SerieKopi = {
  formatversjon: number;
  tatt: string;
  klubb: { id: string; slug: string; navn: string };
  serie: {
    id: string;
    navn: string;
    ukedager: string;
    sesongStart: string;
    sesongSlutt: string | null;
    poengGrense: number;
    antallTellendeRunder: number;
    status: string;
    opprettet: string;
  };
  spillere: { id: string; navn: string; opprettet: string }[];
  runder: {
    id: string;
    dato: string;
    rundenummer: number;
    opprettet: string;
    deltakelser: {
      id: string;
      spillerId: string;
      kamp1: number | null;
      kamp2: number | null;
      kamp3: number | null;
    }[];
    endringer: { id: string; tidspunkt: string; kommentar: string | null; forrigeData: string }[];
  }[];
};

export type LagretKopi = SerieBackup & { klubbSlug: string };

// Filnavn for nedlasting og e-postvedlegg, f.eks.
// "sinsen-vinterkula-2026-27-2026-11-07-1224.json" (norsk tid).
export function filnavnForKopi(k: { klubbSlug: string; serienavn: string; opprettet: Date }) {
  const serie = k.serienavn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // sv-SE gir formatet "2026-11-07 12:24".
  const tid = k.opprettet
    .toLocaleString("sv-SE", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" })
    .replace(" ", "-")
    .replace(":", "");
  return `${k.klubbSlug}-${serie || "serie"}-${tid}.json`;
}

async function lagSerieKopi(serieId: string, tatt: Date): Promise<SerieKopi> {
  const s = await prisma.serie.findUniqueOrThrow({
    where: { id: serieId },
    include: {
      klubb: true,
      spillere: { orderBy: { id: "asc" } },
      runder: {
        orderBy: { rundenummer: "asc" },
        include: {
          deltakelser: { orderBy: { id: "asc" } },
          endringer: { orderBy: { tidspunkt: "asc" } },
        },
      },
    },
  });
  return {
    formatversjon: FORMATVERSJON,
    tatt: tatt.toISOString(),
    klubb: { id: s.klubb.id, slug: s.klubb.slug, navn: s.klubb.navn },
    serie: {
      id: s.id,
      navn: s.navn,
      ukedager: s.ukedager,
      sesongStart: s.sesongStart.toISOString(),
      sesongSlutt: s.sesongSlutt?.toISOString() ?? null,
      poengGrense: s.poengGrense,
      antallTellendeRunder: s.antallTellendeRunder,
      status: s.status,
      opprettet: s.opprettet.toISOString(),
    },
    spillere: s.spillere.map((p) => ({ id: p.id, navn: p.navn, opprettet: p.opprettet.toISOString() })),
    runder: s.runder.map((r) => ({
      id: r.id,
      dato: r.dato.toISOString(),
      rundenummer: r.rundenummer,
      opprettet: r.opprettet.toISOString(),
      deltakelser: r.deltakelser.map((d) => ({
        id: d.id,
        spillerId: d.spillerId,
        kamp1: d.kamp1,
        kamp2: d.kamp2,
        kamp3: d.kamp3,
      })),
      endringer: r.endringer.map((e) => ({
        id: e.id,
        tidspunkt: e.tidspunkt.toISOString(),
        kommentar: e.kommentar,
        forrigeData: e.forrigeData,
      })),
    })),
  };
}

// Lagrer en kopi av serien slik den er nå. Brukes internt og fra
// lib/data/serier.ts - sjekker ikke klubb, det gjør de eksporterte
// funksjonene som tar klubbId.
export async function lagreBackup(serieId: string, grunn: Grunn): Promise<LagretKopi> {
  const tatt = new Date();
  const kopi = await lagSerieKopi(serieId, tatt);
  const backup = await prisma.serieBackup.create({
    data: {
      serieId,
      klubbId: kopi.klubb.id,
      serienavn: kopi.serie.navn,
      grunn,
      antallRunder: kopi.runder.length,
      antallSpillere: kopi.spillere.length,
      data: JSON.stringify(kopi),
      opprettet: tatt,
    },
  });
  await prisma.serie.update({ where: { id: serieId }, data: { sistBackup: tatt } });
  await ryddGamleKopier(serieId);
  return { ...backup, klubbSlug: kopi.klubb.slug };
}

async function ryddGamleKopier(serieId: string) {
  const gamle = await prisma.serieBackup.findMany({
    where: { serieId, grunn: "automatisk" },
    orderBy: { opprettet: "desc" },
    skip: MAKS_AUTOMATISKE_KOPIER,
    select: { id: true },
  });
  if (gamle.length > 0) {
    await prisma.serieBackup.deleteMany({ where: { id: { in: gamle.map((g) => g.id) } } });
  }
}

// Den nattlige jobben: én automatisk kopi av hver serie som er endret
// siden forrige kopi. Uendrede serier (f.eks. avsluttede) hoppes over.
export async function backupEndredeSerier(): Promise<LagretKopi[]> {
  const serier = await prisma.serie.findMany({
    where: { sistEndret: { not: null } },
    select: { id: true, sistEndret: true, sistBackup: true },
  });
  const endret = serier.filter((s) => !s.sistBackup || s.sistEndret! > s.sistBackup);
  const kopier: LagretKopi[] = [];
  for (const s of endret) kopier.push(await lagreBackup(s.id, "automatisk"));
  return kopier;
}

// ---------- For admin-siden, alltid filtrert på klubb ----------

export async function hentBackupStatus(klubbId: string, serieId: string) {
  return prisma.serie.findFirst({
    where: { id: serieId, klubbId },
    select: {
      id: true,
      navn: true,
      sistEndret: true,
      sistBackup: true,
      _count: { select: { runder: true, spillere: true } },
    },
  });
}

export async function listBackuper(klubbId: string, serieId: string) {
  return prisma.serieBackup.findMany({
    where: { klubbId, serieId },
    orderBy: { opprettet: "desc" },
    omit: { data: true },
  });
}

export async function hentBackup(klubbId: string, serieId: string, backupId: string) {
  return prisma.serieBackup.findFirst({ where: { id: backupId, klubbId, serieId } });
}

export async function taManuellBackup(klubbId: string, serieId: string) {
  const serie = await prisma.serie.findFirst({ where: { id: serieId, klubbId } });
  if (!serie) throw new Error("Serien finnes ikke i denne klubben.");
  return lagreBackup(serieId, "manuell");
}

// Erstatter seriens innhold med innholdet i kopien. Nåværende tilstand
// lagres først som en kopi («før gjenoppretting»), så gjenopprettingen kan
// angres. Alt erstattes i én transaksjon - feiler noe, er serien uendret.
export async function gjenopprettSerie(klubbId: string, serieId: string, backupId: string) {
  const backup = await hentBackup(klubbId, serieId, backupId);
  if (!backup) throw new Error("Sikkerhetskopien finnes ikke for denne serien.");

  const kopi = JSON.parse(backup.data) as SerieKopi;
  if (kopi.formatversjon !== FORMATVERSJON) {
    throw new Error(`Ukjent formatversjon ${kopi.formatversjon} i sikkerhetskopien.`);
  }
  if (kopi.serie.id !== serieId || kopi.klubb.id !== klubbId) {
    throw new Error("Sikkerhetskopien hører ikke til denne serien.");
  }

  const navnTatt = await prisma.serie.findFirst({
    where: { klubbId, navn: kopi.serie.navn, NOT: { id: serieId } },
  });
  if (navnTatt) {
    throw new Error(`En annen serie i klubben heter nå «${kopi.serie.navn}». Gi den nytt navn først.`);
  }

  const finnes = await prisma.serie.findUnique({ where: { id: serieId } });
  if (finnes) await lagreBackup(serieId, "før gjenoppretting");

  // Serien er lik en kopi etterpå, så den trenger ingen ny nattlig kopi.
  const nå = new Date();
  const seriefelter = {
    navn: kopi.serie.navn,
    ukedager: kopi.serie.ukedager,
    sesongStart: new Date(kopi.serie.sesongStart),
    sesongSlutt: kopi.serie.sesongSlutt ? new Date(kopi.serie.sesongSlutt) : null,
    poengGrense: kopi.serie.poengGrense,
    antallTellendeRunder: kopi.serie.antallTellendeRunder,
    status: kopi.serie.status,
    sistEndret: nå,
    sistBackup: nå,
  };

  await prisma.$transaction(
    async (tx) => {
      // Deltakelse → Spiller er RESTRICT, så deltakelsene slettes først.
      // Endringsloggen følger rundene (cascade).
      await tx.deltakelse.deleteMany({ where: { runde: { serieId } } });
      await tx.runde.deleteMany({ where: { serieId } });
      await tx.spiller.deleteMany({ where: { serieId } });

      await tx.serie.upsert({
        where: { id: serieId },
        create: { id: serieId, klubbId, opprettet: new Date(kopi.serie.opprettet), ...seriefelter },
        update: seriefelter,
      });
      await tx.spiller.createMany({
        data: kopi.spillere.map((p) => ({
          id: p.id,
          navn: p.navn,
          serieId,
          opprettet: new Date(p.opprettet),
        })),
      });
      await tx.runde.createMany({
        data: kopi.runder.map((r) => ({
          id: r.id,
          serieId,
          dato: new Date(r.dato),
          rundenummer: r.rundenummer,
          opprettet: new Date(r.opprettet),
        })),
      });
      await tx.deltakelse.createMany({
        data: kopi.runder.flatMap((r) => r.deltakelser.map((d) => ({ ...d, rundeId: r.id }))),
      });
      await tx.rundeEndring.createMany({
        data: kopi.runder.flatMap((r) =>
          r.endringer.map((e) => ({ ...e, rundeId: r.id, tidspunkt: new Date(e.tidspunkt) }))
        ),
      });
    },
    { timeout: 30_000 }
  );
  return backup;
}
