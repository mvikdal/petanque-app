// Ren beregningslogikk for seriespill, se docs/petanque-seriespill-spec.md §5-6.
// Ingen avhengighet til Prisma-typer, slik at funksjonene er lette å teste isolert.

// En spiller har ikke alltid anledning til å spille alle 3 kampene i en
// runde (avklart 2026-10-13) - null betyr "ikke spilt", ikke 0-1-0 tap.
export type KampResultat = {
  kamp1: number | null;
  kamp2: number | null;
  kamp3: number | null;
};

export type RundeResultat = {
  sumSeire: number; // 0-3, kun av spilte kamper
  sumPoengforskjell: number; // signert sum over de spilte kampene
  erFullstendig: boolean; // true kun hvis alle 3 kampene er spilt
  antallKamper: number; // 0-3, antall kamper faktisk spilt
};

export function beregnRundeResultat(k: KampResultat): RundeResultat {
  const kamper = [k.kamp1, k.kamp2, k.kamp3];
  const spilteKamper = kamper.filter((p): p is number => p !== null);
  return {
    sumSeire: spilteKamper.filter((p) => p > 0).length,
    sumPoengforskjell: spilteKamper.reduce((sum, p) => sum + p, 0),
    erFullstendig: spilteKamper.length === 3,
    antallKamper: spilteKamper.length,
  };
}

// Sorterer rundescore høyest først: flest sumSeire, ved likt best sumPoengforskjell (spec §5).
export function sammenlignRundeResultat(a: RundeResultat, b: RundeResultat): number {
  if (b.sumSeire !== a.sumSeire) return b.sumSeire - a.sumSeire;
  return b.sumPoengforskjell - a.sumPoengforskjell;
}

// Vinner(e) av én runde: alle med beste resultat - likt resultat gir delt seier.
export function finnRundevinnere(
  resultater: { spillerId: string; resultat: RundeResultat }[]
): Set<string> {
  let beste: RundeResultat | null = null;
  for (const { resultat } of resultater) {
    if (beste === null || sammenlignRundeResultat(resultat, beste) < 0) {
      beste = resultat;
    }
  }
  const vinnerResultat = beste;
  if (vinnerResultat === null) return new Set();
  return new Set(
    resultater
      .filter(({ resultat }) => sammenlignRundeResultat(resultat, vinnerResultat) === 0)
      .map(({ spillerId }) => spillerId)
  );
}

export type SpillerIRunde = {
  spillerId: string;
  spillerNavn: string;
} & KampResultat;

export type RangertSpillerIRunde = SpillerIRunde &
  RundeResultat & { plass: number };

// Rangering innad i én runde, spec §5. Likt resultat gir delt plass, og
// neste plass hoppes over (1, 1, 3 - avklart 2026-10-15).
export function rangerRunde(deltakelser: SpillerIRunde[]): RangertSpillerIRunde[] {
  const sortert = deltakelser
    .map((d) => ({ ...d, ...beregnRundeResultat(d) }))
    .sort(sammenlignRundeResultat);
  return sortert.map((d) => ({
    ...d,
    plass: 1 + sortert.filter((annen) => sammenlignRundeResultat(annen, d) < 0).length,
  }));
}

export type SpillerSesongBlokk = {
  snittSeire: number;
  totaltPoeng: number;
  antallRunder: number;
};

export type SpillerSesongResultat = {
  spillerId: string;
  spillerNavn: string;
  antallSpilteRunder: number;
  antallSpilteKamper: number;
  antallRundeseiere: number; // runder vunnet (også delt seier), over alle spilte runder
  blokkA: SpillerSesongBlokk; // beste N runder - grunnlag for rangering
  blokkB: SpillerSesongBlokk; // alle spilte runder - kun til sammenligning
  besteRunde: RundeResultatMedId; // personlig rekord i serien
  tellendeRundeIder: string[]; // rundene i blokk A - resten er strøket
  // Den svakeste tellende runden - den en ny runde må slå for å forbedre
  // snittet. Kun satt når spilleren har spilt minst N runder.
  svakesteTellendeRundeId: string | null;
};

function beregnBlokk(runder: RundeResultat[]): SpillerSesongBlokk {
  if (runder.length === 0) {
    return { snittSeire: 0, totaltPoeng: 0, antallRunder: 0 };
  }
  const totaltPoeng = runder.reduce((sum, r) => sum + r.sumPoengforskjell, 0);
  const totalSeire = runder.reduce((sum, r) => sum + r.sumSeire, 0);
  return {
    snittSeire: totalSeire / runder.length,
    totaltPoeng,
    antallRunder: runder.length,
  };
}

// vant: spilleren vant runden (eller delte seieren), se finnRundevinnere.
export type RundeResultatMedId = RundeResultat & { rundeId: string; vant: boolean };

export type SpillerMedRunder = {
  spillerId: string;
  spillerNavn: string;
  runder: RundeResultatMedId[]; // én per fullført runde spilleren deltok i
};

// Sesongtabell, spec §6: rangert på antall rundeseiere, deretter totalt poeng
// i blokk A (beste N runder) - avklart 2026-10-16. Blokk B kun informativ.
export function beregnSesongtabell(
  spillere: SpillerMedRunder[],
  antallTellendeRunder: number
): SpillerSesongResultat[] {
  return spillere
    .map((s) => {
      const sortert = [...s.runder].sort(sammenlignRundeResultat);
      const besteN = sortert.slice(0, antallTellendeRunder);
      return {
        spillerId: s.spillerId,
        spillerNavn: s.spillerNavn,
        antallSpilteRunder: s.runder.length,
        antallSpilteKamper: s.runder.reduce((sum, r) => sum + r.antallKamper, 0),
        antallRundeseiere: s.runder.filter((r) => r.vant).length,
        blokkA: beregnBlokk(besteN),
        blokkB: beregnBlokk(sortert),
        besteRunde: sortert[0],
        tellendeRundeIder: besteN.map((r) => r.rundeId),
        svakesteTellendeRundeId:
          s.runder.length >= antallTellendeRunder && besteN.length > 0
            ? besteN[besteN.length - 1].rundeId
            : null,
      };
    })
    .sort((a, b) => {
      if (b.antallRundeseiere !== a.antallRundeseiere) {
        return b.antallRundeseiere - a.antallRundeseiere;
      }
      return b.blokkA.totaltPoeng - a.blokkA.totaltPoeng;
    });
}

export type RundeISerie = {
  rundeId: string;
  dato: Date;
  rundenummer: number;
  deltakelser: SpillerIRunde[];
};

export type PlassBevegelse = {
  før: number | null; // null = spillerens første runde i serien
  etter: number;
};

export type Pallplass = {
  plass: number;
  spillerNavn: string[]; // flere ved delt plass
  resultat: RundeResultat;
};

export type Rundeoppsummering = {
  antallDeltakere: number;
  pall: Pallplass[]; // plass 1-3, med delte plasser
  vinnere: { spillerNavn: string; resultat: RundeResultat }[];
  serierekord: "ny" | "tangert" | null;
  personligeRekorder: { spillerNavn: string; resultat: RundeResultat }[];
  bevegelse: Map<string, PlassBevegelse>;
  leder: { før: string | null; etter: string } | null;
  ukensKlatrere: { spillerNavn: string; opp: number; plassEtter: number }[];
  erFørsteRunde: boolean;
};

function sesongplasseringer(
  runder: RundeISerie[],
  antallTellendeRunder: number
): SpillerSesongResultat[] {
  const perSpiller = new Map<string, SpillerMedRunder>();
  for (const runde of runder) {
    const vinnere = finnRundevinnere(
      runde.deltakelser.map((d) => ({ spillerId: d.spillerId, resultat: beregnRundeResultat(d) }))
    );
    for (const d of runde.deltakelser) {
      const s = perSpiller.get(d.spillerId) ?? {
        spillerId: d.spillerId,
        spillerNavn: d.spillerNavn,
        runder: [],
      };
      s.runder.push({
        ...beregnRundeResultat(d),
        rundeId: runde.rundeId,
        vant: vinnere.has(d.spillerId),
      });
      perSpiller.set(d.spillerId, s);
    }
  }
  return beregnSesongtabell(Array.from(perSpiller.values()), antallTellendeRunder);
}

// Automatisk oppsummering av én runde (lagt til 2026-10-15): vinner(e),
// 3-ere, rekorder, og hvordan runden endret sesongtabellen. Plassering er
// indeks + 1 i sesongtabellen, akkurat som den vises på seriesiden.
export function beregnRundeoppsummering(
  alleRunder: RundeISerie[],
  rundeId: string,
  antallTellendeRunder: number
): Rundeoppsummering {
  const kronologisk = [...alleRunder].sort(
    (a, b) => a.dato.getTime() - b.dato.getTime() || a.rundenummer - b.rundenummer
  );
  const indeks = kronologisk.findIndex((r) => r.rundeId === rundeId);
  if (indeks === -1) throw new Error("Runden finnes ikke i serien");
  const runde = kronologisk[indeks];
  const tidligere = kronologisk.slice(0, indeks);

  const resultater = runde.deltakelser.map((d) => ({
    spillerId: d.spillerId,
    spillerNavn: d.spillerNavn,
    resultat: beregnRundeResultat(d),
  }));

  const vinnerIder = finnRundevinnere(resultater);
  const vinnere = resultater
    .filter((r) => vinnerIder.has(r.spillerId))
    .map(({ spillerNavn, resultat }) => ({ spillerNavn, resultat }));

  // Beste tidligere resultat - totalt og per spiller.
  let tidligereSerierekord: RundeResultat | null = null;
  const tidligereBestePerSpiller = new Map<string, RundeResultat>();
  for (const r of tidligere) {
    for (const d of r.deltakelser) {
      const res = beregnRundeResultat(d);
      if (!tidligereSerierekord || sammenlignRundeResultat(res, tidligereSerierekord) < 0) {
        tidligereSerierekord = res;
      }
      const forrige = tidligereBestePerSpiller.get(d.spillerId);
      if (!forrige || sammenlignRundeResultat(res, forrige) < 0) {
        tidligereBestePerSpiller.set(d.spillerId, res);
      }
    }
  }

  let serierekord: Rundeoppsummering["serierekord"] = null;
  if (vinnere.length > 0 && tidligereSerierekord) {
    const sammenligning = sammenlignRundeResultat(vinnere[0].resultat, tidligereSerierekord);
    serierekord = sammenligning < 0 ? "ny" : sammenligning === 0 ? "tangert" : null;
  }

  const personligeRekorder = resultater
    .filter((r) => {
      const forrige = tidligereBestePerSpiller.get(r.spillerId);
      return forrige !== undefined && sammenlignRundeResultat(r.resultat, forrige) < 0;
    })
    .sort((a, b) => sammenlignRundeResultat(a.resultat, b.resultat))
    .map(({ spillerNavn, resultat }) => ({ spillerNavn, resultat }));

  const før = sesongplasseringer(tidligere, antallTellendeRunder);
  const etter = sesongplasseringer(kronologisk.slice(0, indeks + 1), antallTellendeRunder);
  const plassFør = new Map(før.map((s, i) => [s.spillerId, i + 1]));

  const bevegelse = new Map<string, PlassBevegelse>();
  etter.forEach((s, i) => {
    bevegelse.set(s.spillerId, { før: plassFør.get(s.spillerId) ?? null, etter: i + 1 });
  });

  const erFørsteRunde = tidligere.length === 0;

  const klatrere = erFørsteRunde
    ? []
    : etter
        .map((s, i) => {
          const fra = plassFør.get(s.spillerId);
          return {
            spillerNavn: s.spillerNavn,
            opp: fra === undefined ? 0 : fra - (i + 1),
            plassEtter: i + 1,
          };
        })
        .filter((k) => k.opp > 0);
  const størsteHopp = Math.max(0, ...klatrere.map((k) => k.opp));
  const ukensKlatrere = klatrere.filter((k) => k.opp === størsteHopp);

  const pall: Pallplass[] = [];
  for (const r of rangerRunde(runde.deltakelser)) {
    if (r.plass > 3) break;
    const eksisterende = pall.find((p) => p.plass === r.plass);
    if (eksisterende) {
      eksisterende.spillerNavn.push(r.spillerNavn);
    } else {
      pall.push({ plass: r.plass, spillerNavn: [r.spillerNavn], resultat: r });
    }
  }

  return {
    antallDeltakere: runde.deltakelser.length,
    pall,
    vinnere,
    serierekord,
    personligeRekorder,
    bevegelse,
    leder:
      etter.length > 0
        ? { før: før[0]?.spillerNavn ?? null, etter: etter[0].spillerNavn }
        : null,
    ukensKlatrere,
    erFørsteRunde,
  };
}

// Gyldig poengforskjell-område følger seriens poengGrense (avklart 2026-09-14).
export function erGyldigPoengforskjell(verdi: number, poengGrense: number): boolean {
  return Number.isInteger(verdi) && verdi !== 0 && Math.abs(verdi) <= poengGrense;
}
