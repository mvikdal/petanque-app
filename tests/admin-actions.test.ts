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
import { leggTilAdmin } from "@/app/[klubb]/admin/konto/actions";
import { bekreftKode, loggInnSomDemo, sendKode } from "@/app/[klubb]/admin/login/actions";
import { MAKS_FEIL_PER_KODE, MAKS_KODER_PER_TIME } from "@/lib/auth/engangskode";
import { finnDemoAdmin } from "@/lib/data/brukere";
import { prisma } from "@/lib/prisma";
import { cookieKrukke, sendteKoder } from "./oppsett";
import {
  forventRedirect,
  lagTestdata,
  loggInnSom,
  loggUt,
  ryddTestdata,
  sisteKode,
  skjema,
  slettKoder,
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

describe("innlogging med engangskode per klubb", () => {
  afterEach(slettKoder);

  const send = (slug: string, epost: string, neste = `/${slug}/admin`) =>
    forventRedirect(sendKode(slug, skjema({ epost, neste })));
  const bekreft = (slug: string, epost: string, kode: string, neste = `/${slug}/admin`) =>
    forventRedirect(bekreftKode(slug, skjema({ epost, kode, neste })));
  const annenKode = (kode: string) => (kode === "000000" ? "111111" : "000000");

  it("admin i A får en kode og kommer inn i A med den", async () => {
    expect(await send(t.a.slug, "admin-a@vitest.test")).toContain("steg=kode");
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(kode).toMatch(/^\d{6}$/);
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toBe(`/${t.a.slug}/admin`);
    expect(cookieKrukke.has("sesjon")).toBe(true);
  });

  it("e-posten skiller ikke på store og små bokstaver, og koden tåler mellomrom", async () => {
    await send(t.a.slug, "Admin-A@vitest.test");
    const kode = sisteKode("admin-a@vitest.test")!;
    const medMellomrom = `${kode.slice(0, 3)} ${kode.slice(3)}`;
    expect(await bekreft(t.a.slug, " Admin-A@vitest.test ", medMellomrom)).toBe(
      `/${t.a.slug}/admin`
    );
  });

  it("admin i A får ingen kode på Bs innlogging, og en kode fra A virker ikke i B", async () => {
    expect(await send(t.b.slug, "admin-a@vitest.test")).toContain("steg=kode");
    expect(sendteKoder).toHaveLength(0);

    await send(t.a.slug, "admin-a@vitest.test");
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(await bekreft(t.b.slug, "admin-a@vitest.test", kode)).toContain("feil=kode");
    expect(cookieKrukke.has("sesjon")).toBe(false);
  });

  it("ukjent e-post får samme svar som en ekte admin, men ingen e-post sendes", async () => {
    const ekte = await send(t.a.slug, "admin-a@vitest.test");
    const ukjent = await send(t.a.slug, "finnes-ikke@vitest.test");
    expect(ukjent).toBe(ekte.replace("admin-a", "finnes-ikke"));
    expect(sendteKoder.map((k) => k.til)).toEqual(["admin-a@vitest.test"]);
    expect(await bekreft(t.a.slug, "finnes-ikke@vitest.test", "123456")).toContain("feil=kode");
  });

  it("feil kode avvises, og riktig kode virker etterpå", async () => {
    await send(t.a.slug, "admin-a@vitest.test");
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", annenKode(kode))).toContain("feil=kode");
    expect(cookieKrukke.has("sesjon")).toBe(false);
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toBe(`/${t.a.slug}/admin`);
  });

  it(`koden sperres etter ${MAKS_FEIL_PER_KODE} feil forsøk`, async () => {
    await send(t.a.slug, "admin-a@vitest.test");
    const kode = sisteKode("admin-a@vitest.test")!;
    for (let i = 0; i < MAKS_FEIL_PER_KODE; i++) {
      await bekreft(t.a.slug, "admin-a@vitest.test", annenKode(kode));
    }
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toContain("feil=kode");
  });

  it("utløpt kode avvises", async () => {
    await send(t.a.slug, "admin-a@vitest.test");
    await prisma.innloggingskode.updateMany({
      where: { brukerId: t.adminA.id },
      data: { gyldigTil: new Date(Date.now() - 1000) },
    });
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toContain("feil=kode");
  });

  it("en ny kode gjør den forrige ugyldig", async () => {
    await send(t.a.slug, "admin-a@vitest.test");
    const første = sisteKode("admin-a@vitest.test")!;
    await send(t.a.slug, "admin-a@vitest.test");
    const andre = sisteKode("admin-a@vitest.test")!;
    // Kodene er tilfeldige og kan i sjeldne tilfeller være like.
    if (første !== andre) {
      expect(await bekreft(t.a.slug, "admin-a@vitest.test", første)).toContain("feil=kode");
    }
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", andre)).toBe(`/${t.a.slug}/admin`);
  });

  it("en kode kan bare brukes én gang", async () => {
    await send(t.a.slug, "admin-a@vitest.test");
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toBe(`/${t.a.slug}/admin`);
    loggUt();
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode)).toContain("feil=kode");
  });

  it(`høyst ${MAKS_KODER_PER_TIME} koder i timen, uten at svaret avslører det`, async () => {
    for (let i = 0; i < MAKS_KODER_PER_TIME + 2; i++) {
      expect(await send(t.a.slug, "admin-a@vitest.test")).toContain("steg=kode");
    }
    expect(sendteKoder).toHaveLength(MAKS_KODER_PER_TIME);
  });

  it("superadmin kommer inn i alle klubber", async () => {
    await send(t.b.slug, "super@vitest.test");
    const kode = sisteKode("super@vitest.test")!;
    expect(await bekreft(t.b.slug, "super@vitest.test", kode)).toBe(`/${t.b.slug}/admin`);
  });

  it("«neste» utenfor klubbens admin ignoreres", async () => {
    expect(await send(t.a.slug, "admin-a@vitest.test", "https://evil.example")).not.toContain(
      "evil"
    );
    const kode = sisteKode("admin-a@vitest.test")!;
    expect(await bekreft(t.a.slug, "admin-a@vitest.test", kode, "https://evil.example")).toBe(
      `/${t.a.slug}/admin`
    );
  });
});

describe("demo-rollen", () => {
  it("«Prøv som demo» virker bare i demo-klubben", async () => {
    expect(await forventRedirect(loggInnSomDemo(t.a.slug))).toBe("/");
    expect(cookieKrukke.has("sesjon")).toBe(false);
  });

  it("demo-knappen finner klubbens demo-admin, ikke vanlige admins", async () => {
    expect(await finnDemoAdmin(t.a.id)).toEqual({ brukerId: t.demoA.id });
    expect(await finnDemoAdmin(t.b.id)).toBeNull();
  });

  it("kan ikke legge til admins", async () => {
    loggInnSom(t.demoA.id, t.a);
    const før = await tilstand(t.a.id);
    await expect(leggTilAdmin(t.a.slug, skjema({ epost: "kapret@vitest.test" }))).rejects.toThrow(
      /Demo-admin kan ikke/
    );
    expect(await tilstand(t.a.id)).toEqual(før);
    expect(
      await prisma.adminBruker.findUnique({ where: { epost: "kapret@vitest.test" } })
    ).toBeNull();
  });

  it("vanlig admin kan legge til admin (kontroll), men bare i egen klubb", async () => {
    loggInnSom(t.adminB.id, t.b);
    const mål = await forventRedirect(
      leggTilAdmin(t.b.slug, skjema({ epost: "kollega-b@vitest.test" }))
    );
    expect(mål).toContain("ok=");
    await expect(
      leggTilAdmin(t.a.slug, skjema({ epost: "kollega-a@vitest.test" }))
    ).rejects.toThrow(/Ikke innlogget/);

    const kollega = await prisma.adminBruker.findUniqueOrThrow({
      where: { epost: "kollega-b@vitest.test" },
      include: { klubber: true },
    });
    expect(kollega.erSuperadmin).toBe(false);
    expect(kollega.klubber.map((k) => [k.klubbId, k.rolle])).toEqual([[t.b.id, "admin"]]);
  });
});
