import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { leggTilAdmin, opprettKlubbMedAdmin } from "@/app/superadmin/actions";
import { bekreftKode, sendKode } from "@/app/[klubb]/admin/login/actions";
import { bekreftKodeSuperadmin, sendKodeSuperadmin } from "@/app/superadmin/login/actions";
import { createSpiller } from "@/app/[klubb]/admin/actions";
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
  type Testdata,
} from "./testdata";

let t: Testdata;
beforeAll(async () => {
  t = await lagTestdata();
});
afterAll(ryddTestdata);
afterEach(async () => {
  loggUt();
  await slettKoder();
});

const nyKlubb = (slug: string, epost = `forste-${slug}@vitest.test`) =>
  skjema({ navn: `Vitest ${slug}`, slug, epost });

describe("bare superadmin kommer til", () => {
  it.each([
    ["uten innlogging", () => loggUt()],
    ["vanlig klubbadmin", () => loggInnSom(t.adminA.id, t.a)],
    ["demo-admin", () => loggInnSom(t.demoA.id, t.a)],
  ])("%s avvises", async (_navn, logg) => {
    logg();
    await expect(opprettKlubbMedAdmin(nyKlubb("vitest-inntrenger"))).rejects.toThrow(
      /Krever superadmin/
    );
    logg();
    await expect(
      leggTilAdmin(t.b.id, skjema({ epost: "kapret@vitest.test" }))
    ).rejects.toThrow(/Krever superadmin/);

    expect(await prisma.klubb.findUnique({ where: { slug: "vitest-inntrenger" } })).toBeNull();
    expect(await prisma.adminBruker.findUnique({ where: { epost: "kapret@vitest.test" } })).toBeNull();
  });

  it("superadmin-innloggingen sender ikke kode til vanlig admin", async () => {
    const mål = await forventRedirect(
      sendKodeSuperadmin(skjema({ epost: "admin-a@vitest.test" }))
    );
    expect(mål).toContain("steg=kode");
    expect(sendteKoder).toHaveLength(0);
  });

  it("en gyldig klubbkode gir ikke superadmin-tilgang", async () => {
    await forventRedirect(
      sendKode(t.a.slug, skjema({ epost: "admin-a@vitest.test", neste: "" }))
    );
    const kode = sisteKode("admin-a@vitest.test")!;
    const mål = await forventRedirect(
      bekreftKodeSuperadmin(skjema({ epost: "admin-a@vitest.test", kode }))
    );
    expect(mål).toContain("feil=kode");
    expect(cookieKrukke.has("sesjon")).toBe(false);
  });

  it("superadmin logger inn med kode og får en sesjon uten klubb", async () => {
    await forventRedirect(sendKodeSuperadmin(skjema({ epost: "super@vitest.test" })));
    const kode = sisteKode("super@vitest.test")!;
    expect(
      await forventRedirect(bekreftKodeSuperadmin(skjema({ epost: "super@vitest.test", kode })))
    ).toBe("/superadmin");
    expect(cookieKrukke.has("sesjon")).toBe(true);
  });
});

describe("superadmin oppretter klubb med admin", () => {
  it("den nye adminen kommer bare inn i sin egen klubb", async () => {
    loggInnSom(t.superadmin.id, null);
    expect(await forventRedirect(opprettKlubbMedAdmin(nyKlubb("vitest-ny")))).toContain("ok=");

    const ny = await prisma.klubb.findUniqueOrThrow({ where: { slug: "vitest-ny" } });
    const epost = "forste-vitest-ny@vitest.test";
    const logg = async (slug: string) => {
      await forventRedirect(sendKode(slug, skjema({ epost, neste: "" })));
      return forventRedirect(
        bekreftKode(slug, skjema({ epost, kode: sisteKode(epost) ?? "000000", neste: "" }))
      );
    };
    expect(await logg("vitest-ny")).toBe("/vitest-ny/admin");
    loggUt();
    expect(await logg(t.a.slug)).toContain("feil=kode");

    // Med sesjonen for den nye klubben: ingen tilgang til A.
    const bruker = await prisma.adminBruker.findUniqueOrThrow({
      where: { epost: "forste-vitest-ny@vitest.test" },
    });
    loggInnSom(bruker.id, ny);
    await expect(createSpiller(t.a.slug, t.a.serieId, "Inntrenger")).rejects.toThrow(
      /Ikke innlogget/
    );
  });

  it.each([
    ["reservert ord", "admin"],
    ["store bokstaver", "Vitest-Stor"],
    ["mellomrom", "vitest feil"],
  ])("ugyldig slug avvises: %s", async (_navn, slug) => {
    loggInnSom(t.superadmin.id, null);
    expect(await forventRedirect(opprettKlubbMedAdmin(nyKlubb(slug)))).toContain("feil=");
    expect(await prisma.klubb.findUnique({ where: { slug } })).toBeNull();
  });

  it("slug som er i bruk avvises", async () => {
    loggInnSom(t.superadmin.id, null);
    const skjemaet = nyKlubb(t.a.slug);
    skjemaet.set("navn", "Vitest helt nytt navn");
    expect(await forventRedirect(opprettKlubbMedAdmin(skjemaet))).toContain("allerede i bruk");
    expect(await prisma.klubb.findUnique({ where: { navn: "Vitest helt nytt navn" } })).toBeNull();
  });

  it("superadmin-sesjonen fra /superadmin gir ikke klubbdata", async () => {
    loggInnSom(t.superadmin.id, null);
    await expect(createSpiller(t.a.slug, t.a.serieId, "Inntrenger")).rejects.toThrow(
      /Ikke innlogget/
    );
  });
});
