import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  leggTilAdmin,
  opprettKlubbMedAdmin,
  tilbakestillPassord,
} from "@/app/superadmin/actions";
import { loggInn } from "@/app/[klubb]/admin/login/actions";
import { loggInnSuperadmin } from "@/app/superadmin/login/actions";
import { createSpiller } from "@/app/[klubb]/admin/actions";
import { prisma } from "@/lib/prisma";
import {
  forventRedirect,
  lagTestdata,
  loggInnSom,
  loggUt,
  PASSORD,
  ryddTestdata,
  skjema,
  type Testdata,
} from "./testdata";

let t: Testdata;
beforeAll(async () => {
  t = await lagTestdata();
});
afterAll(ryddTestdata);
afterEach(loggUt);

const nyKlubb = (slug: string, epost = `forste-${slug}@vitest.test`) =>
  skjema({ navn: `Vitest ${slug}`, slug, epost, passord: "midlertidig-1" });

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
      leggTilAdmin(t.b.id, skjema({ epost: "kapret@vitest.test", passord: "kapret-passord" }))
    ).rejects.toThrow(/Krever superadmin/);
    logg();
    await expect(
      tilbakestillPassord(t.adminB.id, skjema({ passord: "kapret-passord" }))
    ).rejects.toThrow(/Krever superadmin/);

    expect(await prisma.klubb.findUnique({ where: { slug: "vitest-inntrenger" } })).toBeNull();
    expect(await prisma.adminBruker.findUnique({ where: { epost: "kapret@vitest.test" } })).toBeNull();
  });

  it("superadmin-innloggingen godtar ikke vanlig admin", async () => {
    const mål = await forventRedirect(
      loggInnSuperadmin(skjema({ epost: "admin-a@vitest.test", passord: PASSORD }))
    );
    expect(mål).toContain("feil=1");
  });
});

describe("superadmin oppretter klubb med admin", () => {
  it("den nye adminen kommer bare inn i sin egen klubb", async () => {
    loggInnSom(t.superadmin.id, null);
    expect(await forventRedirect(opprettKlubbMedAdmin(nyKlubb("vitest-ny")))).toContain("ok=");

    const ny = await prisma.klubb.findUniqueOrThrow({ where: { slug: "vitest-ny" } });
    const logg = (slug: string) =>
      forventRedirect(
        loggInn(slug, skjema({ epost: "forste-vitest-ny@vitest.test", passord: "midlertidig-1" }))
      );
    expect(await logg("vitest-ny")).toBe("/vitest-ny/admin");
    expect(await logg(t.a.slug)).toContain("feil=1");

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

describe("tilbakestilling av passord", () => {
  it("gammelt passord slutter å virke, nytt virker", async () => {
    loggInnSom(t.superadmin.id, null);
    expect(
      await forventRedirect(tilbakestillPassord(t.adminB.id, skjema({ passord: "helt-nytt-1" })))
    ).toContain("ok=");
    const logg = (passord: string) =>
      forventRedirect(loggInn(t.b.slug, skjema({ epost: "admin-b@vitest.test", passord })));
    expect(await logg(PASSORD)).toContain("feil=1");
    expect(await logg("helt-nytt-1")).toBe(`/${t.b.slug}/admin`);
  });

  it("superadmins passord kan ikke tilbakestilles herfra", async () => {
    loggInnSom(t.superadmin.id, null);
    expect(
      await forventRedirect(tilbakestillPassord(t.superadmin.id, skjema({ passord: "kapret-1234" })))
    ).toContain("feil=");
  });
});
