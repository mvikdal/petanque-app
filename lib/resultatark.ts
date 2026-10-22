import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";

// Tolking av bilde/PDF av resultatarket for én kveld (2026-10-22). Modellen
// leser bare av arket - matching mot spillere (lib/navnematch.ts) og
// kontrollen av tallene skjer her i koden, og admin godkjenner alltid i
// rundeskjemaet før noe lagres.
//
// Begge arkformatene klubben bruker, har per kamp et seier-flagg (1/0) og
// en poengforskjell med fortegn, og en total per spiller. Flagget og
// totalen brukes som sjekksum mot feiltolkninger.

const kampSkjema = z.object({
  seier: z
    .number()
    .int()
    .nullable()
    .describe("1 = vant, 0 = tapte, null = ikke oppgitt"),
  forskjell: z
    .number()
    .int()
    .nullable()
    .describe("Poengforskjell med fortegn, f.eks. 5 eller -7. null = ikke spilt / tomt"),
});

const arkSkjema = z.object({
  datoTekst: z
    .string()
    .nullable()
    .describe("Datoen nøyaktig slik den står på arket, f.eks. «14. okt.». null hvis ingen dato."),
  rader: z.array(
    z.object({
      navnPaaArk: z.string().describe("Navnet slik det står skrevet"),
      kamp1: kampSkjema,
      kamp2: kampSkjema,
      kamp3: kampSkjema,
      total: z
        .object({ seire: z.number().int().nullable(), forskjell: z.number().int().nullable() })
        .nullable()
        .describe("Totalen for spilleren hvis den står på arket, ellers null"),
      usikkert: z
        .boolean()
        .describe("true hvis noe i raden var vanskelig å lese, overskrevet eller rettet"),
    })
  ),
  merknad: z
    .string()
    .nullable()
    .describe("Kort merknad på norsk om noe var uklart, ellers null"),
});

export type LestArk = z.infer<typeof arkSkjema>;
export type LestRad = LestArk["rader"][number];

// Det rundeskjemaet får tilbake (se tolkResultatark i admin/actions.ts).
export type TolketRad = {
  navnPaaArk: string;
  spillerId: string | null;
  sikkerhet: "eksakt" | "sannsynlig" | null;
  kamper: [number | null, number | null, number | null];
  usikkert: boolean;
  advarsler: string[];
};
export type TolketArk = {
  dato: string | null;
  datoTekst: string | null;
  merknad: string | null;
  rader: TolketRad[];
};

const instruks = (spillernavn: string[], poengGrense: number) => `
Du leser resultatarket fra én kveld med petanque-seriespill. Hver spiller
spiller tre kamper. Les av hver spiller-rad på arket.

Kjente formater:
1. Tabell (maskinskrevet): kolonnene Navn, så Kamp 1, Kamp 2 og Kamp 3 med
   hver sin «Poeng» (1 = seier, 0 = tap) og «Score» (poengforskjell med
   fortegn), deretter «Totalt» (Poeng og Score) og «Plassering».
   seier = Poeng, forskjell = Score. Totalt er total. Ignorer Plassering.
2. Håndskrevet: navn, en loddrett strek, og så fire par per rad, f.eks.
   «0-7  1+5  0-10  1-12». Første siffer i paret er seier (1) eller tap (0),
   resten er poengforskjellen med fortegn. «1+5» betyr seier og +5, IKKE 15.
   «0-10» betyr tap og -10. De tre første parene er kamp 1-3, det fjerde
   paret er totalen (antall seire og sum poengforskjell).
Andre oppsett kan forekomme - les dem etter samme prinsipp.

Regler:
- Poengforskjellen er et heltall mellom -${poengGrense} og ${poengGrense}, aldri 0.
  Seier har positiv forskjell, tap negativ.
- Står det ingenting for en kamp (tomt, strek), er seier og forskjell null.
- Er et tall overskrevet eller rettet, bruk den siste/tydeligste verdien
  og sett usikkert = true for raden.
- Skriv navnet slik det står. Hvis det tydelig er et av disse kjente
  navnene, bruk den stavemåten: ${spillernavn.length ? spillernavn.join(", ") : "(ingen ennå)"}.
- Ta ikke med overskrifter, tomme rader eller summeringsrader for hele arket.
- Ikke regn ut eller gjett tall som ikke står på arket.
`.trim();

// Kaller Anthropic direkte (nøkkel i ANTHROPIC_API_KEY), ikke via AI Gateway.
const MODELL = anthropic(process.env.RESULTATARK_MODELL ?? "claude-sonnet-5-5");

export async function lesResultatark(input: {
  fil: Uint8Array;
  mediaType: string;
  spillernavn: string[];
  poengGrense: number;
}): Promise<LestArk> {
  const { output } = await generateText({
    model: MODELL,
    output: Output.object({ schema: arkSkjema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: instruks(input.spillernavn, input.poengGrense) },
          { type: "file", mediaType: input.mediaType, data: input.fil },
        ],
      },
    ],
  });
  return output;
}

// ---------- Kontroll av tallene ----------

export function kamperFraRad(rad: LestRad) {
  return [rad.kamp1, rad.kamp2, rad.kamp3];
}

// Returnerer en liste med advarsler (tom hvis raden går opp).
export function kontrollerRad(rad: LestRad, poengGrense: number): string[] {
  const advarsler: string[] = [];
  const kamper = kamperFraRad(rad);

  kamper.forEach((k, i) => {
    if (k.forskjell === null) return;
    if (k.forskjell === 0 || Math.abs(k.forskjell) > poengGrense) {
      advarsler.push(`Kamp ${i + 1}: ugyldig poengforskjell (${k.forskjell}).`);
    } else if (k.seier !== null && (k.seier === 1) !== k.forskjell > 0) {
      advarsler.push(`Kamp ${i + 1}: fortegnet stemmer ikke med seier/tap.`);
    }
  });

  const forskjeller = kamper.map((k) => k.forskjell).filter((f) => f !== null);
  if (forskjeller.length === 0) {
    advarsler.push("Fant ingen resultater i raden.");
  } else if (rad.total) {
    const sum = forskjeller.reduce((a, b) => a + b, 0);
    if (rad.total.forskjell !== null && sum !== rad.total.forskjell) {
      advarsler.push(`Summen (${sum}) stemmer ikke med totalen på arket (${rad.total.forskjell}).`);
    }
    const seire = forskjeller.filter((f) => f > 0).length;
    if (rad.total.seire !== null && seire !== rad.total.seire) {
      advarsler.push(`Antall seire (${seire}) stemmer ikke med totalen på arket (${rad.total.seire}).`);
    }
  }
  return advarsler;
}

// ---------- Dato ----------

const MÅNEDER = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function iso(år: number, måned: number, dag: number) {
  const d = new Date(Date.UTC(år, måned - 1, dag));
  if (d.getUTCMonth() !== måned - 1 || d.getUTCDate() !== dag) return null;
  return d.toISOString().slice(0, 10);
}

// «14. okt.», «21 okt», «14.10», «14.10.2026» eller «2026-10-14» -> ISO-dato.
// Uten årstall velges året som legger datoen innenfor sesongen, ellers
// året som gir datoen nærmest i dag.
export function tolkDato(
  datoTekst: string | null,
  sesongStart: Date,
  sesongSlutt: Date | null,
  idag = new Date()
): string | null {
  if (!datoTekst) return null;
  const tekst = datoTekst.toLowerCase();

  const isoTreff = tekst.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoTreff) return iso(+isoTreff[1], +isoTreff[2], +isoTreff[3]);

  let dag: number | null = null;
  let måned: number | null = null;
  let år: number | null = null;

  const tallTreff = tekst.match(/(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]\s*(\d{2,4}))?/);
  const navnTreff = tekst.match(/(\d{1,2})\.?\s*([a-zæøå]{3})[a-zæøå]*\.?(?:\s*(\d{2,4}))?/);
  if (navnTreff && MÅNEDER.includes(navnTreff[2])) {
    dag = +navnTreff[1];
    måned = MÅNEDER.indexOf(navnTreff[2]) + 1;
    if (navnTreff[3]) år = +navnTreff[3];
  } else if (tallTreff) {
    dag = +tallTreff[1];
    måned = +tallTreff[2];
    if (tallTreff[3]) år = +tallTreff[3];
  }
  if (dag === null || måned === null) return null;
  if (år !== null) return iso(år < 100 ? 2000 + år : år, måned, dag);

  const start = sesongStart.getTime();
  const slutt = sesongSlutt
    ? sesongSlutt.getTime()
    : Date.UTC(sesongStart.getUTCFullYear() + 1, sesongStart.getUTCMonth(), sesongStart.getUTCDate());
  const kandidater = [-1, 0, 1, 2]
    .map((d) => iso(sesongStart.getUTCFullYear() + d, måned, dag))
    .filter((k): k is string => k !== null);
  const iSesongen = kandidater.find((k) => {
    const t = Date.parse(k);
    return t >= start && t <= slutt;
  });
  if (iSesongen) return iSesongen;
  if (kandidater.length === 0) return null;
  return kandidater.reduce((best, k) =>
    Math.abs(Date.parse(k) - idag.getTime()) < Math.abs(Date.parse(best) - idag.getTime()) ? k : best
  );
}
