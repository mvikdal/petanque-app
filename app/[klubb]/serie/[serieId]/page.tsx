import Link from "next/link";
import { hentKlubbEllers404 } from "@/lib/data/klubber";
import { hentSerieMedResultater } from "@/lib/data/serier";
import { rundeUrl } from "@/lib/lenker";
import { notFound } from "next/navigation";
import {
  beregnRundeResultat,
  beregnSesongtabell,
  finnRundevinnere,
  rangerRunde,
  sammenlignRundeResultat,
  type RundeResultat,
  type SpillerMedRunder,
} from "@/lib/ranking";
import { TabellToggle } from "@/components/TabellToggle";

function formatPoeng(p: number) {
  return p > 0 ? `+${p}` : String(p);
}

// 0 vises dempet, slik at de som faktisk har seire/3-ere skiller seg ut.
function StatistikkTall({ verdi }: { verdi: number }) {
  return (
    <td
      className={`px-3 py-2 bg-green-50 text-center ${
        verdi > 0 ? "font-semibold text-green-900" : "text-neutral-400"
      }`}
    >
      {verdi > 0 ? verdi : "–"}
    </td>
  );
}

export default async function SeriePage({
  params,
}: {
  params: Promise<{ klubb: string; serieId: string }>;
}) {
  const { klubb: klubbSlug, serieId } = await params;
  const klubb = await hentKlubbEllers404(klubbSlug);
  const serie = await hentSerieMedResultater(klubb.id, serieId);
  if (!serie) notFound();

  const perSpiller = new Map<string, SpillerMedRunder>();
  for (const runde of serie.runder) {
    const vinnere = finnRundevinnere(
      runde.deltakelser.map((d) => ({ spillerId: d.spillerId, resultat: beregnRundeResultat(d) }))
    );
    for (const d of runde.deltakelser) {
      const eksisterende = perSpiller.get(d.spillerId) ?? {
        spillerId: d.spillerId,
        spillerNavn: d.spiller.navn,
        runder: [],
      };
      eksisterende.runder.push({
        ...beregnRundeResultat(d),
        rundeId: runde.id,
        vant: vinnere.has(d.spillerId),
      });
      perSpiller.set(d.spillerId, eksisterende);
    }
  }
  const sesongtabell = beregnSesongtabell(
    Array.from(perSpiller.values()),
    serie.antallTellendeRunder
  );

  // Serierekord: beste enkeltrunde-resultat (sumSeire, deretter sumPoengforskjell)
  // registrert i serien så langt. Flere kan dele rekorden.
  type Serierekord = RundeResultat & {
    spillerNavn: string;
    rundeId: string;
    rundenummer: number;
    dato: Date;
  };
  let serierekord: Serierekord[] = [];
  for (const runde of serie.runder) {
    for (const d of runde.deltakelser) {
      const resultat = beregnRundeResultat(d);
      const sammenligning =
        serierekord.length === 0
          ? -1
          : sammenlignRundeResultat(resultat, serierekord[0]);
      if (sammenligning < 0) {
        serierekord = [
          {
            spillerNavn: d.spiller.navn,
            rundeId: runde.id,
            rundenummer: runde.rundenummer,
            dato: runde.dato,
            ...resultat,
          },
        ];
      } else if (sammenligning === 0) {
        serierekord.push({
          spillerNavn: d.spiller.navn,
          rundeId: runde.id,
          rundenummer: runde.rundenummer,
          dato: runde.dato,
          ...resultat,
        });
      }
    }
  }

  // Totaltabell: spiller × runde-matrise med rått resultat for hver spilte
  // runde (ingen aggregering). Rundene vises eldst-til-nyest etter DATO
  // (ikke rundenummer - en rettet dato kan avvike fra rekkefølgen
  // rundene opprinnelig ble opprettet i), spillerne alfabetisk.
  // Vinneren(e) av hver runde markeres - likt-resultat deles
  // tiebreak-korrekt (samme logikk som serierekord over). Alle med
  // 3 seire («3-ere») markeres også, uavhengig av om de vant.
  type MatriseCelle = {
    sumSeire: number;
    sumPoengforskjell: number;
    erFullstendig: boolean;
    vant: boolean;
    treer: boolean;
  };
  const matrise = new Map<string, Map<string, MatriseCelle>>();
  const runderStigende = [...serie.runder].sort(
    (a, b) => a.dato.getTime() - b.dato.getTime()
  );

  for (const runde of runderStigende) {
    const resultaterIRunden = runde.deltakelser.map((d) => ({
      spillerId: d.spillerId,
      resultat: beregnRundeResultat(d),
    }));
    const vinnere = finnRundevinnere(resultaterIRunden);
    for (const { spillerId, resultat } of resultaterIRunden) {
      if (!matrise.has(spillerId)) matrise.set(spillerId, new Map());
      matrise.get(spillerId)!.set(runde.id, {
        ...resultat,
        vant: vinnere.has(spillerId),
        treer: resultat.sumSeire === 3,
      });
    }
  }

  // Antall 3-ere til sesongtabellen, telt fra matrisen. Rundeseiere
  // kommer fra sesongtabellen selv, siden de styrer rangeringen.
  const treere = new Map<string, number>();
  for (const [spillerId, celler] of matrise) {
    let antall = 0;
    for (const celle of celler.values()) {
      if (celle.treer) antall++;
    }
    treere.set(spillerId, antall);
  }

  const sesongPerSpiller = new Map(sesongtabell.map((s) => [s.spillerId, s]));

  // Vinner(e) av en avsluttet serie: alle som er like med førsteplassen på
  // alle sorteringskriteriene (se beregnSesongtabell).
  const erAvsluttet = serie.status === "avsluttet";
  const leder = sesongtabell[0];
  const vinnere =
    erAvsluttet && leder
      ? sesongtabell.filter(
          (s) =>
            s.antallKampseire === leder.antallKampseire &&
            s.blokkB.totaltPoeng === leder.blokkB.totaltPoeng &&
            s.blokkA.snittSeire === leder.blokkA.snittSeire
        )
      : [];

  const spillereAlfabetisk = Array.from(perSpiller.values())
    .map((s) => ({ spillerId: s.spillerId, spillerNavn: s.spillerNavn }))
    .sort((a, b) => a.spillerNavn.localeCompare(b.spillerNavn, "no"));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{serie.navn}</h1>
        <p className="text-sm text-neutral-700">{erAvsluttet ? "Avsluttet" : "Aktiv"}</p>
      </div>

      {(vinnere.length > 0 || serierekord.length > 0) && (
        <section className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 shadow-sm space-y-3">
          {vinnere.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
                🥇 {vinnere.length === 1 ? "Vinner av serien" : "Vinnere av serien"}
              </h2>
              {vinnere.map((v) => (
                <div key={v.spillerId} className="text-sm text-neutral-900">
                  <span className="font-bold">{v.spillerNavn}</span> – {v.antallKampseire} vunne
                  kamper,{" "}
                  <span className="font-semibold">{formatPoeng(v.blokkB.totaltPoeng)} poeng</span>
                </div>
              ))}
            </div>
          )}
          {serierekord.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
                🏆 Serierekord
              </h2>
              {serierekord.map((r) => (
                <div key={`${r.spillerNavn}-${r.rundeId}`} className="text-sm text-neutral-900">
                  <span className="font-bold">{r.spillerNavn}</span> –{" "}
                  <span className={r.erFullstendig ? "" : "italic"}>
                    {r.sumSeire} seire,{" "}
                    <span className="font-semibold">{formatPoeng(r.sumPoengforskjell)} poeng</span>
                  </span>{" "}
                  <Link
                    href={rundeUrl(klubb.slug, serie.id, r.rundeId)}
                    className="text-amber-800 hover:underline"
                  >
                    (runde {r.rundenummer} · {new Date(r.dato).toLocaleDateString("no-NO")})
                  </Link>
                  {!r.erFullstendig && (
                    <span className="text-xs text-neutral-500 italic"> – ufullstendig</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <TabellToggle
        sesongtabell={
          sesongtabell.length === 0 ? (
            <p className="text-sm text-neutral-700">Ingen fullførte runder ennå.</p>
          ) : (
            <div className="overflow-x-auto">
              <p className="text-xs text-neutral-700 mb-2">
                <span className="font-semibold">Sortering:</span> 1. Vunne kamper (✅) · 2. Poeng
                totalt (±) · 3. Snitt seire i tellende runder
              </p>
              <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg shadow-sm">
                <thead>
                  <tr className="text-left">
                    <th
                      className="sticky left-0 z-10 w-10 min-w-10 bg-white px-3 py-2 border-b border-neutral-200 text-neutral-700"
                      rowSpan={2}
                    >
                      #
                    </th>
                    <th
                      className="sticky left-10 z-10 bg-white px-3 py-2 border-b border-neutral-200 text-neutral-700"
                      rowSpan={2}
                    >
                      Spiller
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 font-semibold text-center border-b border-green-200"
                      colSpan={8}
                    >
                      Statistikk
                    </th>
                    <th
                      className="px-3 py-2 bg-indigo-100 text-indigo-900 font-semibold text-center border-b border-indigo-200"
                      colSpan={2}
                    >
                      Tellende {serie.antallTellendeRunder} runder
                    </th>
                    <th
                      className="px-3 py-2 bg-neutral-100 text-neutral-700 font-semibold text-center border-b border-neutral-300"
                      colSpan={2}
                    >
                      Alle {serie.runder.length} runder
                    </th>
                  </tr>
                  <tr className="text-left">
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Kamper spilt"
                    >
                      🎯
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Vunne kamper totalt"
                    >
                      ✅
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Poengforskjell totalt – alle runder"
                    >
                      ±
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Runder spilt"
                    >
                      📅
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Rundeseiere – antall runder med beste resultat"
                    >
                      🏆
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Antall runder med 3 seire"
                    >
                      3-ere
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Beste runde – klikk for å åpne runden"
                    >
                      ⭐
                    </th>
                    <th
                      className="px-3 py-2 bg-green-100 text-green-900 border-b border-green-200 text-center"
                      title="Neste strykbare runde – den svakeste tellende runden, som strykes når en bedre runde kommer"
                    >
                      ✂️
                    </th>
                    <th className="px-3 py-2 bg-indigo-100 text-indigo-900 border-b border-indigo-200">
                      Snitt seire
                    </th>
                    <th className="px-3 py-2 bg-indigo-100 text-indigo-900 border-b border-indigo-200">
                      Poeng
                    </th>
                    <th className="px-3 py-2 bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                      Snitt seire
                    </th>
                    <th className="px-3 py-2 bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                      Poeng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sesongtabell.map((s, i) => {
                    // Plass og navn holdes fast ved horisontal scrolling (som i
                    // «Alle runder»), og trenger derfor egen, tett bakgrunn.
                    const radBakgrunn = i % 2 === 1 ? "bg-neutral-50" : "bg-white";
                    return (
                    <tr
                      key={s.spillerId}
                      className={`border-b border-neutral-100 last:border-0 ${radBakgrunn}`}
                    >
                      <td className={`sticky left-0 w-10 min-w-10 ${radBakgrunn} px-3 py-2 text-neutral-900`}>
                        {i + 1}
                      </td>
                      <td
                        className={`sticky left-10 ${radBakgrunn} px-3 py-2 font-semibold text-neutral-900 whitespace-nowrap`}
                      >
                        {s.spillerNavn}
                      </td>
                      <td className="px-3 py-2 bg-green-50 text-center text-neutral-900">
                        {s.antallSpilteKamper}
                      </td>
                      <StatistikkTall verdi={s.antallKampseire} />
                      <td className="px-3 py-2 bg-green-50 text-center font-semibold text-green-900 whitespace-nowrap">
                        {formatPoeng(s.blokkB.totaltPoeng)}
                      </td>
                      <td className="px-3 py-2 bg-green-50 text-center text-neutral-900">
                        {s.antallSpilteRunder}
                      </td>
                      <StatistikkTall verdi={s.antallRundeseiere} />
                      <StatistikkTall verdi={treere.get(s.spillerId) ?? 0} />
                      <td
                        className={`px-3 py-2 bg-green-50 text-center whitespace-nowrap ${
                          s.besteRunde.erFullstendig ? "" : "italic"
                        }`}
                      >
                        <Link
                          href={rundeUrl(klubb.slug, serie.id, s.besteRunde.rundeId)}
                          className="text-green-900 underline decoration-green-300 underline-offset-2 hover:decoration-green-700"
                        >
                          {s.besteRunde.sumSeire} {formatPoeng(s.besteRunde.sumPoengforskjell)}
                        </Link>
                      </td>
                      {s.svakesteTellendeRunde ? (
                        <td
                          className={`px-3 py-2 bg-green-50 text-center whitespace-nowrap ${
                            s.svakesteTellendeRunde.erFullstendig ? "" : "italic"
                          }`}
                        >
                          <Link
                            href={rundeUrl(klubb.slug, serie.id, s.svakesteTellendeRunde.rundeId)}
                            className="text-red-900 underline decoration-red-300 underline-offset-2 hover:decoration-red-700"
                          >
                            {s.svakesteTellendeRunde.sumSeire}{" "}
                            {formatPoeng(s.svakesteTellendeRunde.sumPoengforskjell)}
                          </Link>
                        </td>
                      ) : (
                        // Ingenting strykes før spilleren har spilt N runder.
                        <td className="px-3 py-2 bg-green-50 text-center text-neutral-400">–</td>
                      )}
                      <td className="px-3 py-2 bg-indigo-50 font-medium text-neutral-900">
                        {s.blokkA.snittSeire.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 bg-indigo-50 font-medium text-neutral-900">
                        {s.blokkA.totaltPoeng}
                      </td>
                      <td className="px-3 py-2 bg-neutral-50 text-neutral-700">
                        {s.blokkB.snittSeire.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 bg-neutral-50 text-neutral-700">
                        {s.blokkB.totaltPoeng}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-neutral-700">
                <span>🎯 Kamper spilt</span>
                <span>✅ Vunne kamper</span>
                <span>± Poeng totalt</span>
                <span>📅 Runder spilt</span>
                <span>🏆 Rundeseier</span>
                <span>3-ere: runder med 3 seire</span>
                <span>⭐ Beste runde</span>
                <span>✂️ Neste strykbare runde</span>
              </div>
            </div>
          )
        }
        totaltabell={
          spillereAlfabetisk.length === 0 ? (
            <p className="text-sm text-neutral-700">Ingen fullførte runder ennå.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg shadow-sm">
                <thead>
                  <tr className="text-left">
                    <th className="sticky left-0 bg-neutral-50 px-3 py-2 border-b border-neutral-200 text-neutral-700">
                      Spiller
                    </th>
                    {runderStigende.map((runde) => (
                      <th
                        key={runde.id}
                        className="px-3 py-2 border-b border-neutral-200 text-neutral-700 text-center whitespace-nowrap"
                      >
                        <div>
                          {new Date(runde.dato).toLocaleDateString("no-NO", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                        <div className="text-[10px] font-normal text-neutral-500">
                          R{runde.rundenummer}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spillereAlfabetisk.map((s, i) => {
                    const radBakgrunn = i % 2 === 1 ? "bg-neutral-50" : "bg-white";
                    const sesong = sesongPerSpiller.get(s.spillerId);
                    return (
                    <tr key={s.spillerId} className="border-b border-neutral-100 last:border-0">
                      <td
                        className={`sticky left-0 ${radBakgrunn} px-3 py-2 font-semibold text-neutral-900 whitespace-nowrap`}
                      >
                        {s.spillerNavn}
                      </td>
                      {runderStigende.map((runde) => {
                        const celle = matrise.get(s.spillerId)?.get(runde.id);
                        const erStroket =
                          celle !== undefined && !sesong?.tellendeRundeIder.includes(runde.id);
                        const svakeste = sesong?.svakesteTellendeRunde?.rundeId === runde.id;
                        // Prioritet: svakeste tellende → vant → 3-er → radbakgrunn.
                        // Strøkne runder gjennomstrekes og dempes.
                        const farge = svakeste
                          ? "bg-red-100 text-red-900"
                          : celle?.vant
                            ? "bg-green-100 font-semibold text-green-900"
                            : celle?.treer
                              ? "bg-green-50 text-green-900"
                              : `${radBakgrunn} text-neutral-900`;
                        return (
                          <td
                            key={runde.id}
                            className={`px-3 py-2 text-center whitespace-nowrap ${farge} ${
                              erStroket ? "line-through text-neutral-400!" : ""
                            } ${celle && !celle.erFullstendig ? "italic" : ""}`}
                            title={
                              svakeste
                                ? "Svakeste tellende runde"
                                : erStroket
                                  ? "Strøket – teller ikke"
                                  : undefined
                            }
                          >
                            {celle
                              ? `${celle.sumSeire} ${formatPoeng(celle.sumPoengforskjell)}`
                              : ""}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-neutral-700">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
                  Vant runden
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-50 border border-green-200" />
                  3 seire
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
                  Svakeste tellende runde
                </span>
                <span>
                  <span className="line-through text-neutral-400">2 −5</span> Strøket – teller ikke
                </span>
              </div>
            </div>
          )
        }
      />

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Rundehistorikk
        </h2>
        {serie.runder.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen runder registrert ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {serie.runder.map((runde) => {
              const topp3 = rangerRunde(
                runde.deltakelser.map((d) => ({
                  spillerId: d.spillerId,
                  spillerNavn: d.spiller.navn,
                  kamp1: d.kamp1,
                  kamp2: d.kamp2,
                  kamp3: d.kamp3,
                }))
              ).slice(0, 3);
              return (
                <li key={runde.id}>
                  <Link
                    href={rundeUrl(klubb.slug, serie.id, runde.id)}
                    className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-900">
                      Runde {runde.rundenummer} ·{" "}
                      {new Date(runde.dato).toLocaleDateString("no-NO")}
                    </span>
                    <div className="text-sm text-neutral-700 text-right space-y-0.5">
                      {topp3.map((r) => (
                        <div
                          key={r.spillerId}
                          className={r.plass === 1 ? "font-bold text-amber-800" : undefined}
                        >
                          {r.plass}. {r.spillerNavn}{" "}
                          <span className={r.erFullstendig ? "" : "italic"}>
                            ({r.sumSeire}, {formatPoeng(r.sumPoengforskjell)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
