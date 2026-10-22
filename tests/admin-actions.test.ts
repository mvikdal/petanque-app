import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createRunde,
  createSerie,
  createSpiller,
  sorterRunderEtterDato,
  tolkResultatark,
  updateRunde,
  updateSerie,
} from "@/app/[klubb]/admin/actions";
import { byttEgetPassord, leggTilAdmin } from "@/app/[klubb]/admin/konto/actions";
import { loggInn } from "@/app/[klubb]/admin/login/actions";
import { prisma } from "@/lib/prisma";
import { cookieKrukke } from "./oppsett";
import {
  forventRedirect,
  lagTestdata,
  loggInnSom,
  loggUt,
  PASSORD,
  ryddTestdata,
  skjema,
  tilstand,
  type Testdata,
} from "./testdata";

// Server actions kan kalles direkte, uten å gå via en side eller proxy.ts.
// De må derfor selv sjekke at innloggingen gjelder akkurat denne klubben.
let t: Testdata;
beforeAll(async () => {
  t = await lagTestdata();
});
afterAll(ryddTestdata);
afterEach(loggUt);

const nySerie = () =>
  skjema({
    navn: "Kapret serie",
    sesongStart: "2026-02-01",
    poengGrense: "13",
    antallTellendeRunder: "12",
  });
const serieendring = () =>
  skjema({ navn: "Kapret", ukedager: "", antallTellendeRunder: "1", status: "avsluttet" });
const deltakelse = () => [{ spillerId: t.b.spillerIder[0], kamp1: 1, kamp2: 1, kamp3: 1 }];

// Alle admin-actions mot klubb B, kalt med klubb Bs slug.
const angrepPåB = (): [string, () => Promise<unknown>][] => [
  ["createSerie", () => createSerie(t.b.slug, nySerie())],
  ["updateSerie", () => updateSerie(t.b.slug, t.b.serieId, serieendring())],
  ["createSpiller", () => createSpiller(t.b.slug, t.b.serieId, "Inntrenger")],
  ["sorterRunderEtterDato", () => sorterRunderEtterDato(t.b.slug, t.b.serieId)],
  ["createRunde", () => createRunde(t.b.slug, t.b.serieId, "2026-03-01", deltakelse())],
  ["updateRunde", () => updateRunde(t.b.slug, t.b.rundeId, "2026-03-01", deltakelse(), "")],
  ["tolkResultatark", () => tolkResultatark(t.b.slug, t.b.serieId, new FormData())],
];

describe("admin-actions mot en annen klubb avvises", () => {
  it.each([
    ["uten innlogging", () => loggUt()],
    ["innlogget i klubb A", () => loggInnSom(t.adminA.id, t.a)],
    ["demo-admin i klubb A", () => loggInnSom(t.demoA.id, t.a)],
    ["superadmin uten klubb (fra /superadmin)", () => loggInnSom(t.superadmin.id, null)],
  ])("%s", async (_navn, logg) => {
    const før = await tilstand(t.b.id);
    for (const [navn, angrep] of angrepPåB()) {
      logg();
      await expect(angrep(), navn).rejects.toThrow(/Ikke innlogget som admin i denne klubben/);
    }
    expect(await tilstand(t.b.id)).toEqual(før);
  });

  it("en cookie for klubb A som er endret til å peke på klubb B, avvises", async () => {
    // Sesjonen er signert for A. Å bytte klubb i innholdet ødelegger signaturen.
    loggInnSom(t.adminA.id, t.a);
    const [data, signatur] = cookieKrukke.get("sesjon")!.split(".");
    const innhold = JSON.parse(Buffer.from(data, "base64url").toString());
    innhold.klubb = { id: t.b.id, slug: t.b.slug };
    const forfalsket = Buffer.from(JSON.stringify(innhold)).toString("base64url");
    cookieKrukke.set("sesjon", `${forfalsket}.${signatur}`);
    await expect(createSpiller(t.b.slug, t.b.serieId, "Inntrenger")).rejects.toThrow(
      /Ikke innlogget/
    );
  });

  it("innlogget i A, men med klubb Bs id-er under As slug", async () => {
    loggInnSom(t.adminA.id, t.a);
    const før = await tilstand(t.b.id);
    await expect(createSpiller(t.a.slug, t.b.serieId, "Inntrenger")).rejects.toThrow(/finnes ikke/);
    await expect(updateSerie(t.a.slug, t.b.serieId, serieendring())).rejects.toThrow(/finnes ikke/);
    await expect(
      updateRunde(t.a.slug, t.b.rundeId, "2026-03-01", deltakelse(), "")
    ).rejects.toThrow(/finnes ikke/);
    await expect(tolkResultatark(t.a.slug, t.b.serieId, new FormData())).rejects.toThrow(
      /finnes ikke/
    );
    expect(await tilstand(t.b.id)).toEqual(før);
  });

  it("en admin som er fjernet fra klubben, mister tilgangen selv med gyldig cookie", async () => {
    const tidligere = await prisma.adminBruker.create({
      data: {
        epost: "fjernet@vitest.test",
        passordHash: "x",
        klubber: { create: { klubbId: t.b.id, rolle: "admin" } },
      },
    });
    loggInnSom(tidligere.id, t.b);
    await prisma.klubbAdmin.deleteMany({ where: { brukerId: tidligere.id } });
    await expect(createSpiller(t.b.slug, t.b.serieId, "Inntrenger")).rejects.toThrow(
      /Ikke innlogget/
    );
  });
});

describe("admin i egen klubb (kontroll)", () => {
  it("kan legge til spiller og registrere runde", async () => {
    loggInnSom(t.adminB.id, t.b);
    const spiller = await createSpiller(t.b.slug, t.b.serieId, "Ny i B");
    expect(spiller.serieId).toBe(t.b.serieId);
    const mål = await forventRedirect(
      createRunde(t.b.slug, t.b.serieId, "2026-03-01", [
        { spillerId: spiller.id, kamp1: 4, kamp2: null, kamp3: null },
      ])
    );
    expect(mål).toMatch(new RegExp(`^/${t.b.slug}/serie/${t.b.serieId}/runde/`));
  });

  it("tolkResultatark avviser manglende fil og feil filtype før modellen kalles", async () => {
    loggInnSom(t.adminB.id, t.b);
    await expect(tolkResultatark(t.b.slug, t.b.serieId, new FormData())).resolves.toEqual({
      feil: expect.stringMatching(/Velg et bilde/),
    });
    const skjema = new FormData();
    skjema.set("fil", new File(["hei"], "ark.txt", { type: "text/plain" }));
    await expect(tolkResultatark(t.b.slug, t.b.serieId, skjema)).resolves.toEqual({
      feil: expect.stringMatching(/Filtypen/),
    });
  });

  it("tolkResultatark er stengt for demo-admin (koster penger per kall)", async () => {
    loggInnSom(t.demoA.id, t.a);
    const skjema = new FormData();
    skjema.set("fil", new File(["x"], "ark.jpg", { type: "image/jpeg" }));
    await expect(tolkResultatark(t.a.slug, t.a.serieId, skjema)).resolves.toEqual({
      feil: expect.stringMatching(/ikke tilgjengelig i demo/),
    });
  });

  it("superadmin som har logget inn i klubben, har tilgang", async () => {
    loggInnSom(t.superadmin.id, t.b);
    await expect(createSpiller(t.b.slug, t.b.serieId, "Fra superadmin")).resolves.toBeTruthy();
  });

  it("demo-admin kan registrere resultater i sin egen klubb", async () => {
    loggInnSom(t.demoA.id, t.a);
    await expect(createSpiller(t.a.slug, t.a.serieId, "Fra demo")).resolves.toBeTruthy();
  });
});

describe("innlogging per klubb", () => {
  const forsøk = (slug: string, epost: string, passord = PASSORD) =>
    forventRedirect(loggInn(slug, skjema({ epost, passord, neste: `/${slug}/admin` })));

  it("admin i A kommer inn i A og får en sesjon", async () => {
    expect(await forsøk(t.a.slug, "admin-a@vitest.test")).toBe(`/${t.a.slug}/admin`);
    expect(cookieKrukke.has("sesjon")).toBe(true);
  });

  it("admin i A avvises på Bs innlogging", async () => {
    expect(await forsøk(t.b.slug, "admin-a@vitest.test")).toContain("feil=1");
    expect(cookieKrukke.has("sesjon")).toBe(false);
  });

  it("feil passord og ukjent e-post avvises", async () => {
    expect(await forsøk(t.a.slug, "admin-a@vitest.test", "feil-passord")).toContain("feil=1");
    expect(await forsøk(t.a.slug, "finnes-ikke@vitest.test")).toContain("feil=1");
  });

  it("superadmin kommer inn i alle klubber", async () => {
    expect(await forsøk(t.b.slug, "super@vitest.test")).toBe(`/${t.b.slug}/admin`);
  });

  it("«neste» utenfor klubbens admin ignoreres", async () => {
    const mål = await forventRedirect(
      loggInn(
        t.a.slug,
        skjema({ epost: "admin-a@vitest.test", passord: PASSORD, neste: "https://evil.example" })
      )
    );
    expect(mål).toBe(`/${t.a.slug}/admin`);
  });
});

describe("demo-rollen", () => {
  it("kan ikke bytte passord eller legge til admins", async () => {
    loggInnSom(t.demoA.id, t.a);
    const før = await tilstand(t.a.id);
    await expect(
      byttEgetPassord(
        t.a.slug,
        skjema({ gammelt: PASSORD, nytt: "kapret-passord", gjenta: "kapret-passord" })
      )
    ).rejects.toThrow(/Demo-admin kan ikke/);
    await expect(
      leggTilAdmin(t.a.slug, skjema({ epost: "kapret@vitest.test", passord: "kapret-passord" }))
    ).rejects.toThrow(/Demo-admin kan ikke/);
    expect(await tilstand(t.a.id)).toEqual(før);
    expect(
      await prisma.adminBruker.findUnique({ where: { epost: "kapret@vitest.test" } })
    ).toBeNull();
    // Passordet er uendret.
    const mål = await forventRedirect(
      loggInn(t.a.slug, skjema({ epost: "demo-a@vitest.test", passord: PASSORD }))
    );
    expect(mål).toBe(`/${t.a.slug}/admin`);
  });

  it("vanlig admin kan legge til admin (kontroll), men bare i egen klubb", async () => {
    loggInnSom(t.adminB.id, t.b);
    const mål = await forventRedirect(
      leggTilAdmin(t.b.slug, skjema({ epost: "kollega-b@vitest.test", passord: "kollega-passord" }))
    );
    expect(mål).toContain("ok=");
    await expect(
      leggTilAdmin(t.a.slug, skjema({ epost: "kollega-a@vitest.test", passord: "kollega-passord" }))
    ).rejects.toThrow(/Ikke innlogget/);

    const kollega = await prisma.adminBruker.findUniqueOrThrow({
      where: { epost: "kollega-b@vitest.test" },
      include: { klubber: true },
    });
    expect(kollega.erSuperadmin).toBe(false);
    expect(kollega.klubber.map((k) => [k.klubbId, k.rolle])).toEqual([[t.b.id, "admin"]]);
  });
});
