"use client";

import { useState, useTransition } from "react";
import { createRunde, createSpiller } from "@/app/admin/actions";

type Spiller = { id: string; navn: string };

type Scores = Record<string, [string, string, string]>;

export function NyRundeForm({
  serieId,
  poengGrense,
  spillere: initialSpillere,
}: {
  serieId: string;
  poengGrense: number;
  spillere: Spiller[];
}) {
  const [spillere, setSpillere] = useState(initialSpillere);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Scores>({});
  const [dato, setDato] = useState(() => new Date().toISOString().slice(0, 10));
  const [nyttNavn, setNyttNavn] = useState("");
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      const spiller = await createSpiller(serieId, nyttNavn);
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

    const deltakelser: { spillerId: string; kamp1: number; kamp2: number; kamp3: number }[] = [];

    for (const spillerId of valgte) {
      const rad = scores[spillerId];
      if (!rad || rad.some((v) => v.trim() === "")) {
        const navn = spillere.find((s) => s.id === spillerId)?.navn ?? spillerId;
        setFeilmelding(`${navn} mangler resultat for alle 3 kamper.`);
        return;
      }
      const tall = rad.map((v) => Number(v)) as [number, number, number];
      for (const t of tall) {
        if (!Number.isInteger(t) || t === 0 || Math.abs(t) > poengGrense) {
          const navn = spillere.find((s) => s.id === spillerId)?.navn ?? spillerId;
          setFeilmelding(
            `${navn} har en ugyldig poengforskjell. Må være et heltall mellom -${poengGrense} og ${poengGrense}, ulik 0.`
          );
          return;
        }
      }
      deltakelser.push({ spillerId, kamp1: tall[0], kamp2: tall[1], kamp3: tall[2] });
    }

    startTransition(async () => {
      try {
        await createRunde(serieId, dato, deltakelser);
      } catch (e) {
        setFeilmelding(e instanceof Error ? e.message : "Kunne ikke lagre runden.");
      }
    });
  }

  const valgteSpillere = spillere.filter((s) => valgte.has(s.id));

  return (
    <div className="space-y-8">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="dato">
          Dato
        </label>
        <input
          id="dato"
          type="date"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <h2 className="font-medium mb-2">1. Velg deltakere</h2>
        <div className="bg-white border border-neutral-200 rounded-md p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {spillere.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={valgte.has(s.id)}
                onChange={() => toggleSpiller(s.id)}
              />
              {s.navn}
            </label>
          ))}
          {spillere.length === 0 && (
            <p className="text-sm text-neutral-500 col-span-full">
              Ingen spillere registrert ennå.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={nyttNavn}
            onChange={(e) => setNyttNavn(e.target.value)}
            placeholder="Navn på ny spiller"
            className="border border-neutral-300 rounded px-3 py-2 text-sm flex-1 max-w-xs"
          />
          <button
            type="button"
            onClick={leggTilSpiller}
            className="border border-neutral-300 rounded px-3 py-2 text-sm hover:bg-neutral-100"
          >
            Legg til spiller
          </button>
        </div>
      </div>

      {valgteSpillere.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">2. Registrer poengforskjell per kamp</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-neutral-200 rounded-md">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="px-3 py-2">Spiller</th>
                  <th className="px-3 py-2">Kamp 1</th>
                  <th className="px-3 py-2">Kamp 2</th>
                  <th className="px-3 py-2">Kamp 3</th>
                </tr>
              </thead>
              <tbody>
                {valgteSpillere.map((s) => {
                  const rad = scores[s.id] ?? ["", "", ""];
                  return (
                    <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-3 py-2">{s.navn}</td>
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
                            className="w-20 border border-neutral-300 rounded px-2 py-1"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Positivt tall = vant kampen, negativt tall = tapte kampen.
          </p>
        </div>
      )}

      {feilmelding && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {feilmelding}
        </p>
      )}

      <button
        type="button"
        onClick={validerOgLagre}
        disabled={pending}
        className="bg-neutral-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? "Lagrer…" : "Lagre runde"}
      </button>
    </div>
  );
}
