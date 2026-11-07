import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createRunde,
  createSpiller,
  gjenopprettBackup,
  taBackupNå,
  updateRunde,
  updateSerie,
} from "@/app/[klubb]/admin/actions";
import { GET as lastNed } from "@/app/[klubb]/admin/serie/[serieId]/backup/[backupId]/route";
import { GET as nattligJobb } from "@/app/api/cron/backup/route";
import {
  backupEndredeSerier,
  lagreBackup,
  listBackuper,
  MAKS_AUTOMATISKE_KOPIER,
} from "@/lib/data/backup";
import { prisma } from "@/lib/prisma";
import { sendteEposter } from "./oppsett";
import {
  forventRedirect,
  lagTestdata,
  loggInnSom,
  loggUt,
  ryddTestdata,
  skjema,
  tilstand,
  type Testdata,
} from "./testdata";

let t: Testdata;
beforeAll(async () => {
  t = await lagTestdata();
});
afterAll(ryddTestdata);
afterEach(() => {
  loggUt();
  sendteEposter.length = 0;
});

const etterId = <T extends { id: string }>(liste: T[]) =>
  [...liste].sort((a, b) => a.id.localeCompare(b.id));

// Seriene i en klubb med alt innhold, i fast rekkefølge og uten
// backup-feltene, som endres av selve kopieringen.
async function serieinnhold(klubbId: string) {
  const klubb = await tilstand(klubbId);
  return klubb.serier.map((serie) => ({
    ...serie,
    sistEndret: undefined,
    sistBackup: undefined,
    spillere: etterId(serie.spillere),
    runder: etterId(serie.runder).map((r) => ({
      ...r,
      deltakelser: etterId(r.deltakelser),
      endringer: etterId(r.endringer),
    })),
  }));
}

const serieskjema = (navn: string, status = "aktiv") =>
  skjema({ navn, ukedager: "", antallTellendeRunder: "12", status });

async function nyesteKopi(klubbId: string, serieId: string, grunn: string) {
  const kopier = await listBackuper(klubbId, serieId);
  return kopier.find((k) => k.grunn === grunn)!;
}

describe("gjenoppretting", () => {
  it("setter serien tilbake slik den var, og kan selv angres", async () => {
    loggInnSom(t.adminA.id, t.a);
    expect(await forventRedirect(taBackupNå(t.a.slug, t.a.serieId))).toContain("ok=");
    const før = await serieinnhold(t.a.id);

    // Ny runde, rettet runde og nytt navn etter kopien.
    await forventRedirect(
      createRunde(t.a.slug, t.a.serieId, "2026-03-01", [
        { spillerId: t.a.spillerIder[0], kamp1: 4, kamp2: null, kamp3: null },
      ])
    );
    await forventRedirect(
      updateRunde(
        t.a.slug,
        t.a.rundeId,
        "2026-01-05",
        [{ spillerId: t.a.spillerIder[0], kamp1: 7, kamp2: 3, kamp3: -2 }],
        "feiltasting"
      )
    );
    await forventRedirect(updateSerie(t.a.slug, t.a.serieId, serieskjema("Omdøpt")));
    expect(await serieinnhold(t.a.id)).not.toEqual(før);

    const kopi = await nyesteKopi(t.a.id, t.a.serieId, "manuell");
    const mål = await forventRedirect(
      gjenopprettBackup(t.a.slug, t.a.serieId, kopi.id, skjema({ bekreft: "ja" }))
    );
    expect(mål).toContain("ok=");
    expect(await serieinnhold(t.a.id)).toEqual(før);

    // Tilstanden før gjenopprettingen er lagret og kan hentes tilbake.
    const angre = await nyesteKopi(t.a.id, t.a.serieId, "før gjenoppretting");
    expect(angre.antallRunder).toBe(2);
    await forventRedirect(
      gjenopprettBackup(t.a.slug, t.a.serieId, angre.id, skjema({ bekreft: "ja" }))
    );
    const serie = await prisma.serie.findUniqueOrThrow({
      where: { id: t.a.serieId },
      include: { _count: { select: { runder: true } } },
    });
    expect(serie.navn).toBe("Omdøpt");
    expect(serie._count.runder).toBe(2);

    // Tilbake til utgangspunktet for de andre testene.
    await forventRedirect(
      gjenopprettBackup(t.a.slug, t.a.serieId, kopi.id, skjema({ bekreft: "ja" }))
    );
  });

  it("krever avkrysning, og uten den endres ingenting", async () => {
    loggInnSom(t.adminA.id, t.a);
    await forventRedirect(taBackupNå(t.a.slug, t.a.serieId));
    const kopi = await nyesteKopi(t.a.id, t.a.serieId, "manuell");
    const før = await serieinnhold(t.a.id);
    const antallKopier = (await listBackuper(t.a.id, t.a.serieId)).length;

    const mål = await forventRedirect(gjenopprettBackup(t.a.slug, t.a.serieId, kopi.id, skjema({})));
    expect(mål).toContain("feil=");
    expect(await serieinnhold(t.a.id)).toEqual(før);
    expect(await listBackuper(t.a.id, t.a.serieId)).toHaveLength(antallKopier);
  });
});

describe("tilgang", () => {
  it("admin i A kommer ikke til Bs kopier", async () => {
    const kopiB = await lagreBackup(t.b.serieId, "manuell");
    loggInnSom(t.adminA.id, t.a);
    const før = await serieinnhold(t.b.id);

    await expect(
      gjenopprettBackup(t.b.slug, t.b.serieId, kopiB.id, skjema({ bekreft: "ja" }))
    ).rejects.toThrow(/Ikke innlogget/);
    expect(
      await forventRedirect(
        gjenopprettBackup(t.a.slug, t.b.serieId, kopiB.id, skjema({ bekreft: "ja" }))
      )
    ).toContain("finnes ikke");
    await expect(taBackupNå(t.a.slug, t.b.serieId)).rejects.toThrow(/finnes ikke/);
    expect(await listBackuper(t.a.id, t.b.serieId)).toEqual([]);
    expect(await serieinnhold(t.b.id)).toEqual(før);

    const params = (klubb: string) =>
      ({ params: Promise.resolve({ klubb, serieId: t.b.serieId, backupId: kopiB.id }) });
    expect((await lastNed(new Request("http://localhost"), params(t.a.slug))).status).toBe(404);
    expect((await lastNed(new Request("http://localhost"), params(t.b.slug))).status).toBe(403);

    loggInnSom(t.adminB.id, t.b);
    const svar = await lastNed(new Request("http://localhost"), params(t.b.slug));
    expect(svar.status).toBe(200);
    expect((await svar.json()).formatversjon).toBe(1);
  });

  it("demo-admin kan ikke ta kopi eller gjenopprette", async () => {
    const kopi = await lagreBackup(t.a.serieId, "manuell");
    loggInnSom(t.demoA.id, t.a);
    await expect(taBackupNå(t.a.slug, t.a.serieId)).rejects.toThrow(/Demo-admin/);
    await expect(
      gjenopprettBackup(t.a.slug, t.a.serieId, kopi.id, skjema({ bekreft: "ja" }))
    ).rejects.toThrow(/Demo-admin/);
  });
});

describe("nattlig kopi", () => {
  // Testdatabasen kan ha andre serier også, så bare testklubbenes teller.
  const testseriene = async () => {
    const kopier = await backupEndredeSerier();
    return kopier.filter((k) => k.klubbSlug.startsWith("vitest-")).map((k) => k.serieId);
  };

  it("tar bare kopi av serier som er endret siden forrige kopi", async () => {
    await testseriene();
    expect(await testseriene()).toEqual([]);

    loggInnSom(t.adminB.id, t.b);
    await createSpiller(t.b.slug, t.b.serieId, "Ny etter kopi");
    expect(await testseriene()).toEqual([t.b.serieId]);
    expect(await testseriene()).toEqual([]);
  });

  it("jobben avviser kall uten riktig CRON_SECRET", async () => {
    const forrige = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect((await nattligJobb(new Request("http://localhost"))).status).toBe(401);

      process.env.CRON_SECRET = "vitest-cron-hemmelighet";
      const kall = (token: string) =>
        nattligJobb(
          new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } })
        );
      expect((await kall("feil")).status).toBe(401);

      loggInnSom(t.adminB.id, t.b);
      await createSpiller(t.b.slug, t.b.serieId, "Ny før natt");
      const svar = await kall("vitest-cron-hemmelighet");
      expect(svar.status).toBe(200);
      expect((await svar.json()).kopier).toContain(`${t.b.slug}/Testserie`);
      const epost = sendteEposter.at(-1)!;
      expect(epost.vedlegg?.some((v) => v.filnavn.startsWith(`${t.b.slug}-testserie-`))).toBe(true);
    } finally {
      if (forrige === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = forrige;
    }
  });

  it(`beholder de ${MAKS_AUTOMATISKE_KOPIER} siste automatiske kopiene, og alle andre`, async () => {
    const gammel = (dagerSiden: number, grunn = "automatisk") => ({
      serieId: t.b.serieId,
      klubbId: t.b.id,
      serienavn: "Testserie",
      grunn,
      antallRunder: 0,
      antallSpillere: 0,
      data: "{}",
      opprettet: new Date(Date.now() - dagerSiden * 86_400_000),
    });
    await prisma.serieBackup.createMany({
      data: [
        ...Array.from({ length: MAKS_AUTOMATISKE_KOPIER + 5 }, (_, i) => gammel(i + 10)),
        gammel(500, "avsluttet"),
      ],
    });
    await lagreBackup(t.b.serieId, "automatisk");

    const kopier = await listBackuper(t.b.id, t.b.serieId);
    expect(kopier.filter((k) => k.grunn === "automatisk")).toHaveLength(MAKS_AUTOMATISKE_KOPIER);
    expect(kopier.some((k) => k.grunn === "avsluttet")).toBe(true);
  });
});

describe("avsluttet serie", () => {
  it("får en endelig kopi med en gang, sendt på e-post, og bare én gang", async () => {
    loggInnSom(t.adminB.id, t.b);
    const antallEndelige = async () =>
      (await listBackuper(t.b.id, t.b.serieId)).filter((k) => k.grunn === "avsluttet").length;
    const før = await antallEndelige();

    await forventRedirect(updateSerie(t.b.slug, t.b.serieId, serieskjema("Testserie", "avsluttet")));
    expect(await antallEndelige()).toBe(før + 1);
    expect(sendteEposter).toHaveLength(1);

    await forventRedirect(updateSerie(t.b.slug, t.b.serieId, serieskjema("Testserie", "avsluttet")));
    expect(await antallEndelige()).toBe(før + 1);
  });
});
