"use client";

import { useState, useTransition } from "react";
import {
  createRunde,
  createSpiller,
  tolkResultatark,
  updateRunde,
} from "@/app/[klubb]/admin/actions";
import type { TolketRad } from "@/lib/resultatark";

type Spiller = { id: string; navn: string };

type Scores = Record<string, [string, string, string]>;

const tilScore = (kamper: TolketRad["kamper"]) =>
  kamper.map((k) => (k === null ? "" : String(k))) as [string, string, string];

const visKamper = (kamper: TolketRad["kamper"]) =>
  kamper.map((k) => (k === null ? "–" : k > 0 ? `+${k}` : String(k))).join("  ");

// Bilder skaleres ned i nettleseren før opplasting - mobilbilder er ofte
// over grensen for server actions, og modellen trenger ikke full oppløsning.
// Klarer ikke nettleseren å lese bildet (f.eks. HEIC), sendes originalen.
async function forminskBilde(fil: File): Promise<File> {
  if (!fil.type.startsWith("image/")) return fil;
  try {
    const bilde = await createImageBitmap(fil);
    const skala = Math.min(1, 2000 / Math.max(bilde.width, bilde.height));
    const lerret = document.createElement("canvas");
    lerret.width = Math.round(bilde.width * skala);
    lerret.height = Math.round(bilde.height * skala);
    lerret.getContext("2d")!.drawImage(bilde, 0, 0, lerret.width, lerret.height);
    const blob = await new Promise<Blob | null>((ok) => lerret.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], "resultatark.jpg", { type: "image/jpeg" }) : fil;
  } catch {
    return fil;
  }
}

export function RundeForm(
  props:
    | {
        mode: "ny";
        klubbSlug: string;
        serieId: string;
        poengGrense: number;
        spillere: Spiller[];
        bildetolkning: boolean;
      }
    | {
        mode: "rediger";
        klubbSlug: string;
        serieId: string;
        rundeId: string;
        poengGrense: number;
        spillere: Spiller[];
        initialDato: string;
        initialDeltakelser: {
          spillerId: string;
          kamp1: number | null;
          kamp2: number | null;
          kamp3: number | null;
        }[];
      }
) {
  const { mode, klubbSlug, serieId, poengGrense, spillere: initialSpillere } = props;

  const [spillere, setSpillere] = useState(initialSpillere);
  const [valgte, setValgte] = useState<Set<string>>(
    () => new Set(mode === "rediger" ? props.initialDeltakelser.map((d) => d.spillerId) : [])
  );
  const [scores, setScores] = useState<Scores>(() => {
    if (mode !== "rediger") return {};
    const initial: Scores = {};
    for (const d of props.initialDeltakelser) {
      initial[d.spillerId] = [
        d.kamp1 === null ? "" : String(d.kamp1),
        d.kamp2 === null ? "" : String(d.kamp2),
        d.kamp3 === null ? "" : String(d.kamp3),
      ];
    }
    return initial;
  });
  const [dato, setDato] = useState(() =>
    mode === "rediger" ? props.initialDato : new Date().toISOString().slice(0, 10)
  );
  const [kommentar, setKommentar] = useState("");
  const [nyttNavn, setNyttNavn] = useState("");
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Innlesing fra bilde/PDF av arket (kun ny runde).
  const [tolker, startTolking] = useTransition();
  const [arkfil, setArkfil] = useState<{ url: string; navn: string; erBilde: boolean } | null>(
    null
  );
  const [tolkInfo, setTolkInfo] = useState<string | null>(null);
  const [tolketFra, setTolketFra] = useState<Record<string, TolketRad>>({});
  const [umatchede, setUmatchede] = useState<TolketRad[]>([]);

  function lesArk(fil: File | undefined) {
    if (!fil) return;
    setFeilmelding(null);
    setTolkInfo(null);
    if (arkfil) URL.revokeObjectURL(arkfil.url);
    setArkfil({ url: URL.createObjectURL(fil), navn: fil.name, erBilde: fil.type.startsWith("image/") });

    startTolking(async () => {
      const skjema = new FormData();
      skjema.set("fil", await forminskBilde(fil));
      let svar;
      try {
        svar = await tolkResultatark(klubbSlug, serieId, skjema);
      } catch (e) {
        setFeilmelding(e instanceof Error ? e.message : "Kunne ikke tolke arket.");
        return;
      }
      if ("feil" in svar) {
        setFeilmelding(svar.feil);
        return;
      }

      const matchede = svar.rader.filter((r) => r.spillerId !== null);
      setValgte(new Set(matchede.map((r) => r.spillerId!)));
      setScores(Object.fromEntries(matchede.map((r) => [r.spillerId!, tilScore(r.kamper)])));
      setTolketFra(Object.fromEntries(matchede.map((r) => [r.spillerId!, r])));
      setUmatchede(svar.rader.filter((r) => r.spillerId === null));
      if (svar.dato) setDato(svar.dato);

      const info = [`Leste ${svar.rader.length} spillere fra arket.`];
      if (svar.datoTekst && !svar.dato) info.push(`Fant ikke datoen ut fra «${svar.datoTekst}».`);
      if (svar.merknad) info.push(svar.merknad);
      setTolkInfo(info.join(" "));
    });
  }

  // Et navn fra arket som ikke ble gjenkjent, kobles til en spiller.
  function kobleUmatchet(rad: TolketRad, spillerId: string) {
    setUmatchede((prev) => prev.filter((r) => r !== rad));
    setValgte((prev) => new Set(prev).add(spillerId));
    setScores((prev) => ({ ...prev, [spillerId]: tilScore(rad.kamper) }));
    setTolketFra((prev) => ({ ...prev, [spillerId]: { ...rad, spillerId } }));
  }

  async function opprettFraArk(rad: TolketRad) {
    setFeilmelding(null);
    try {
      const spiller = await createSpiller(klubbSlug, serieId, rad.navnPaaArk);
      setSpillere((prev) => [...prev, spiller].sort((a, b) => a.navn.localeCompare(b.navn)));
      kobleUmatchet(rad, spiller.id);
    } catch (e) {
      setFeilmelding(e instanceof Error ? e.message : "Kunne ikke legge til spiller.");
    }
  }

  function toggleSpiller(id: string) {
    setValgte((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) {
        neste.delete(id);
      } else {
        neste.add(id);
      }
      return neste;
    });
  }

  function settScore(spillerId: string, kampIndex: 0 | 1 | 2, verdi: string) {
    setScores((prev) => {
      const eksisterende = prev[spillerId] ?? ["", "", ""];
      const oppdatert = [...eksisterende] as [string, string, string];
      oppdatert[kampIndex] = verdi;
      return { ...prev, [spillerId]: oppdatert };
    });
  }

  async function leggTilSpiller() {
    if (!nyttNavn.trim()) return;
    setFeilmelding(null);
    try {
      const spiller = await createSpiller(klubbSlug, serieId, nyttNavn);
      setSpillere((prev) =>
        [...prev, spiller].sort((a, b) => a.navn.localeCompare(b.navn))
      );
      setValgte((prev) => new Set(prev).add(spiller.id));
      setNyttNavn("");
    } catch (e) {
      setFeilmelding(e instanceof Error ? e.message : "Kunne ikke legge til spiller.");
    }
  }

  function validerOgLagre() {
    setFeilmelding(null);

    if (valgte.size === 0) {
      setFeilmelding("Velg minst én spiller.");
      return;
    }

    const deltakelser: {
      spillerId: string;
      kamp1: number | null;
      kamp2: number | null;
      kamp3: number | null;
    }[] = [];

    for (const spillerId of valgte) {
      const rad = scores[spillerId] ?? ["", "", ""];
      const navn = spillere.find((s) => s.id === spillerId)?.navn ?? spillerId;

      if (rad.every((v) => v.trim() === "")) {
        setFeilmelding(`${navn} mangler resultat for minst én kamp.`);
        return;
      }

      const tall = rad.map((v) => {
        if (v.trim() === "") return null;
        return Number(v);
      }) as [number | null, number | null, number | null];

      for (const t of tall) {
        if (t !== null && (!Number.isInteger(t) || t === 0 || Math.abs(t) > poengGrense)) {
          setFeilmelding(
            `${navn} har en ugyldig poengforskjell. Må være et heltall mellom -${poengGrense} og ${poengGrense}, ulik 0, eller stå tomt hvis kampen ikke ble spilt.`
          );
          return;
        }
      }
      deltakelser.push({ spillerId, kamp1: tall[0], kamp2: tall[1], kamp3: tall[2] });
    }

    startTransition(async () => {
      try {
        if (mode === "ny") {
          await createRunde(klubbSlug, serieId, dato, deltakelser);
        } else {
          await updateRunde(klubbSlug, props.rundeId, dato, deltakelser, kommentar);
        }
      } catch (e) {
        setFeilmelding(e instanceof Error ? e.message : "Kunne ikke lagre runden.");
      }
    });
  }

  const valgteSpillere = spillere.filter((s) => valgte.has(s.id));

  const knappeklasse =
    "border border-indigo-700 text-indigo-700 rounded px-3 py-2 text-sm font-medium hover:bg-indigo-50 cursor-pointer";

  return (
    <div className="space-y-8">
      {mode === "ny" && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold text-neutral-900 mb-1">Les inn fra arket (valgfritt)</h2>
          <p className="text-sm text-neutral-700 mb-3">
            Ta bilde av resultatarket eller importer et bilde/PDF du har fått tilsendt.
            Skjemaet under fylles ut, og du kontrollerer før du lagrer.
          </p>
          {!props.bildetolkning ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2">
              Denne funksjonen er ikke tilgjengelig i demo.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <label className={knappeklasse}>
                Ta bilde
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={tolker}
                  onChange={(e) => {
                    lesArk(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className={knappeklasse}>
                Importer fil
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  disabled={tolker}
                  onChange={(e) => {
                    lesArk(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
          {tolker && <p className="text-sm text-neutral-700 mt-3">Tolker arket … (kan ta litt tid)</p>}
          {tolkInfo && !tolker && (
            <p className="text-sm text-indigo-900 bg-indigo-50 border border-indigo-200 rounded px-3 py-2 mt-3">
              {tolkInfo} Sjekk alle tall mot arket før du lagrer.
            </p>
          )}
          {arkfil &&
            (arkfil.erBilde ? (
              <details className="mt-3" open>
                <summary className="text-sm text-neutral-700 cursor-pointer">Vis arket</summary>
                {/* eslint-disable-next-line @next/next/no-img-element -- lokal forhåndsvisning (blob-URL) */}
                <img
                  src={arkfil.url}
                  alt="Resultatarket"
                  className="mt-2 max-h-[32rem] w-auto border border-neutral-200 rounded"
                />
              </details>
            ) : (
              <p className="text-sm text-neutral-700 mt-3">
                Fil:{" "}
                <a href={arkfil.url} target="_blank" rel="noreferrer" className="underline">
                  {arkfil.navn}
                </a>
              </p>
            ))}
          {umatchede.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">
                Navn som ikke ble gjenkjent
              </h3>
              <ul className="space-y-2">
                {umatchede.map((rad, i) => (
                  <li
                    key={`${rad.navnPaaArk}-${i}`}
                    className="flex flex-wrap items-center gap-2 text-sm text-neutral-900 bg-amber-50 border border-amber-300 rounded px-3 py-2"
                  >
                    <span className="font-medium">«{rad.navnPaaArk}»</span>
                    <span className="font-mono text-neutral-700">{visKamper(rad.kamper)}</span>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && kobleUmatchet(rad, e.target.value)}
                      className="border border-neutral-300 rounded px-2 py-1 text-sm ml-auto"
                    >
                      <option value="">Velg spiller …</option>
                      {spillere
                        .filter((s) => !valgte.has(s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.navn}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => opprettFraArk(rad)}
                      className="border border-indigo-700 text-indigo-700 rounded px-2 py-1 text-sm font-medium hover:bg-indigo-50"
                    >
                      Opprett som ny
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-900 mb-1" htmlFor="dato">
          Dato
        </label>
        <input
          id="dato"
          type="date"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900"
        />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-2">1. Velg deltakere</h2>
        <div className="bg-white border border-neutral-200 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 shadow-sm">
          {spillere.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-neutral-900">
              <input
                type="checkbox"
                checked={valgte.has(s.id)}
                onChange={() => toggleSpiller(s.id)}
                className="h-4 w-4 accent-indigo-700"
              />
              {s.navn}
            </label>
          ))}
          {spillere.length === 0 && (
            <p className="text-sm text-neutral-700 col-span-full">
              Ingen spillere registrert ennå.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={nyttNavn}
            onChange={(e) => setNyttNavn(e.target.value)}
            placeholder="Navn på ny spiller"
            className="border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900 flex-1 max-w-xs"
          />
          <button
            type="button"
            onClick={leggTilSpiller}
            className="border border-indigo-700 text-indigo-700 rounded px-3 py-2 text-sm font-medium hover:bg-indigo-50"
          >
            Legg til spiller
          </button>
        </div>
      </div>

      {valgteSpillere.length > 0 && (
        <div>
          <h2 className="font-semibold text-neutral-900 mb-2">
            2. Registrer poengforskjell per kamp
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg shadow-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="px-3 py-2 text-neutral-700">Spiller</th>
                  <th className="px-3 py-2 text-neutral-700">Kamp 1</th>
                  <th className="px-3 py-2 text-neutral-700">Kamp 2</th>
                  <th className="px-3 py-2 text-neutral-700">Kamp 3</th>
                </tr>
              </thead>
              <tbody>
                {valgteSpillere.map((s) => {
                  const rad = scores[s.id] ?? ["", "", ""];
                  const fra = tolketFra[s.id];
                  const sjekk = fra && (fra.usikkert || fra.advarsler.length > 0 || fra.sikkerhet !== "eksakt");
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-neutral-100 last:border-0 ${sjekk ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-neutral-900">
                        {s.navn}
                        {fra && fra.navnPaaArk !== s.navn && (
                          <span className="block text-xs font-normal text-neutral-700">
                            Står som «{fra.navnPaaArk}» på arket
                          </span>
                        )}
                        {fra?.usikkert && (
                          <span className="block text-xs font-normal text-amber-900">
                            Vanskelig å lese – sjekk mot arket
                          </span>
                        )}
                        {fra?.advarsler.map((a) => (
                          <span key={a} className="block text-xs font-normal text-amber-900">
                            {a}
                          </span>
                        ))}
                      </td>
                      {[0, 1, 2].map((i) => (
                        <td key={i} className="px-3 py-2">
                          <input
                            type="number"
                            value={rad[i]}
                            onChange={(e) =>
                              settScore(s.id, i as 0 | 1 | 2, e.target.value)
                            }
                            min={-poengGrense}
                            max={poengGrense}
                            placeholder="–"
                            className="w-20 border border-neutral-300 rounded px-2 py-1.5 text-neutral-900 font-medium focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-neutral-700 mt-2">
            Positivt tall = vant kampen, negativt tall = tapte kampen. La et
            felt stå tomt hvis spilleren ikke fikk spilt den kampen -
            resultatet vises da i kursiv som ufullstendig.
          </p>
        </div>
      )}

      {mode === "rediger" && (
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1" htmlFor="kommentar">
            Kommentar (hvorfor retter du denne runden?)
          </label>
          <textarea
            id="kommentar"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="F.eks. «Feilregistrert kamp 2 for Marius, skulle vært +7 ikke -7»"
            rows={2}
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900"
          />
        </div>
      )}

      {feilmelding && (
        <p className="text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">
          {feilmelding}
        </p>
      )}

      <button
        type="button"
        onClick={validerOgLagre}
        disabled={pending}
        className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800 disabled:opacity-50"
      >
        {pending ? "Lagrer…" : mode === "ny" ? "Lagre runde" : "Lagre retting"}
      </button>
    </div>
  );
}
