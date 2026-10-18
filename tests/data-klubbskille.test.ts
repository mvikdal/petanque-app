import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as data from "@/lib/data/serier";
import { lagTestdata, ryddTestdata, tilstand, type Testdata } from "./testdata";

// Datalaget skal aldri gi ut eller endre data fra en annen klubb, selv om
// man kjenner id-ene. Klubb A spør etter klubb B sine ting.
let t: Testdata;
beforeAll(async () => {
  t = await lagTestdata();
});
afterAll(ryddTestdata);

describe("lesing på tvers av klubber gir ingenting", () => {
  it("serier", async () => {
    expect(await data.hentSerie(t.a.id, t.b.serieId)).toBeNull();
    expect(await data.hentSerieMedResultater(t.a.id, t.b.serieId)).toBeNull();
    expect(await data.hentSerieMedRundeliste(t.a.id, t.b.serieId)).toBeNull();
    expect((await data.listSerier(t.a.id)).map((s) => s.id)).toEqual([t.a.serieId]);
  });

  it("runder og spillere", async () => {
    expect(await data.hentRundeMedSerie(t.a.id, t.b.serieId, t.b.rundeId)).toBeNull();
    expect(await data.hentRundeForRedigering(t.a.id, t.b.serieId, t.b.rundeId)).toBeNull();
    expect(await data.listSpillere(t.a.id, t.b.serieId)).toEqual([]);
  });

  it("riktig klubb får dataene sine (kontroll)", async () => {
    expect((await data.hentSerie(t.a.id, t.a.serieId))?.id).toBe(t.a.serieId);
    expect((await data.hentRundeMedSerie(t.a.id, t.a.serieId, t.a.rundeId))?.id).toBe(t.a.rundeId);
    expect(await data.listSpillere(t.a.id, t.a.serieId)).toHaveLength(2);
  });

  it("en runde fra egen klubb under en annen klubbs serie-id gir ingenting", async () => {
    expect(await data.hentRundeMedSerie(t.a.id, t.b.serieId, t.a.rundeId)).toBeNull();
  });
});

describe("skriving på tvers av klubber avvises og endrer ingenting", () => {
  const deltakelse = () => [{ spillerId: t.b.spillerIder[0], kamp1: 1, kamp2: 1, kamp3: 1 }];

  it.each([
    ["opprettSpiller", () => data.opprettSpiller(t.a.id, t.b.serieId, "Inntrenger")],
    [
      "oppdaterSerie",
      () =>
        data.oppdaterSerie(t.a.id, t.b.serieId, {
          navn: "Kapret",
          ukedager: "",
          antallTellendeRunder: 1,
          status: "avsluttet",
        }),
    ],
    ["opprettRunde", () => data.opprettRunde(t.a.id, t.b.serieId, new Date(), deltakelse())],
    ["oppdaterRunde", () => data.oppdaterRunde(t.a.id, t.b.rundeId, new Date(), deltakelse(), "")],
    ["sorterRunderEtterDato", () => data.sorterRunderEtterDato(t.a.id, t.b.serieId)],
  ])("%s", async (_navn, forsøk) => {
    const før = await tilstand(t.b.id);
    await expect(forsøk()).rejects.toThrow(/finnes ikke i denne klubben/);
    expect(await tilstand(t.b.id)).toEqual(før);
  });

  it("en runde kan ikke få spillere fra en annen klubbs serie", async () => {
    const før = await tilstand(t.a.id);
    await expect(
      data.opprettRunde(t.a.id, t.a.serieId, new Date(), [
        { spillerId: t.b.spillerIder[0], kamp1: 1, kamp2: 1, kamp3: 1 },
      ])
    ).rejects.toThrow(/hører ikke til denne serien/);
    expect(await tilstand(t.a.id)).toEqual(før);
  });
});
