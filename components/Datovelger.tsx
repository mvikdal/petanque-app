"use client";

import { useEffect, useRef, useState } from "react";

// Egen datovelger med norske navn og mandag som første ukedag (2026-11-07).
// Nettleserens <input type="date"> følger språket og ukestarten i
// nettleseren eller operativsystemet, ikke siden, så den kunne vise engelsk
// og søndag først. Verdien er alltid "ÅÅÅÅ-MM-DD", som før, og sendes i et
// skjult felt med samme name, så skjemaer og server actions er uendret.

const MÅNEDER = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];
const UKEDAGER = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
const UKEDAGER_KORT = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

type Dag = { år: number; måned: number; dag: number }; // måned 0-11

function tilTekst({ år, måned, dag }: Dag) {
  return `${år}-${String(måned + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

function fraTekst(verdi: string): Dag | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(verdi);
  return m ? { år: Number(m[1]), måned: Number(m[2]) - 1, dag: Number(m[3]) } : null;
}

// 0 = mandag ... 6 = søndag.
function ukedag({ år, måned, dag }: Dag) {
  return (new Date(år, måned, dag).getDay() + 6) % 7;
}

// Dagens dato i lokal tid. (toISOString() gir UTC, og dermed gårsdagens
// dato mellom midnatt og kl. 01/02 norsk tid.)
export function dagensDato(): string {
  const n = new Date();
  return tilTekst({ år: n.getFullYear(), måned: n.getMonth(), dag: n.getDate() });
}

export function formaterDato(verdi: string): string {
  const d = fraTekst(verdi);
  return d ? `${UKEDAGER[ukedag(d)]} ${d.dag}. ${MÅNEDER[d.måned]} ${d.år}` : "";
}

type Props = {
  id: string;
  name?: string;
  // Kontrollert bruk (value + onChange) eller ukontrollert (defaultValue).
  value?: string;
  defaultValue?: string;
  onChange?: (verdi: string) => void;
  required?: boolean;
  className?: string;
};

export function Datovelger({ id, name, value, defaultValue, onChange, required, className }: Props) {
  const [egenVerdi, setEgenVerdi] = useState(defaultValue ?? "");
  const verdi = value ?? egenVerdi;
  const [åpen, setÅpen] = useState(false);
  const [visning, setVisning] = useState<{ år: number; måned: number } | null>(null);
  const boks = useRef<HTMLDivElement>(null);

  // Lukk ved klikk utenfor eller Escape.
  useEffect(() => {
    if (!åpen) return;
    const klikk = (e: MouseEvent) => {
      if (!boks.current?.contains(e.target as Node)) setÅpen(false);
    };
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") setÅpen(false);
    };
    document.addEventListener("mousedown", klikk);
    document.addEventListener("keydown", tast);
    return () => {
      document.removeEventListener("mousedown", klikk);
      document.removeEventListener("keydown", tast);
    };
  }, [åpen]);

  function åpne() {
    const d = fraTekst(verdi) ?? fraTekst(dagensDato())!;
    setVisning({ år: d.år, måned: d.måned });
    setÅpen(!åpen);
  }

  function velg(ny: string) {
    if (value === undefined) setEgenVerdi(ny);
    onChange?.(ny);
    setÅpen(false);
  }

  function blaMåned(steg: number) {
    setVisning((v) => {
      if (!v) return v;
      const m = v.måned + steg;
      return { år: v.år + Math.floor(m / 12), måned: ((m % 12) + 12) % 12 };
    });
  }

  const valgt = fraTekst(verdi);
  const iDag = dagensDato();

  return (
    <div ref={boks} className="relative inline-block w-full max-w-xs">
      {/* Skjult felt som sendes med skjemaet. Ikke readOnly, så required
          stopper innsending og nettleseren viser beskjed ved feltet. */}
      {name && (
        <input
          name={name}
          value={verdi}
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 opacity-0 pointer-events-none"
        />
      )}
      <button
        id={id}
        type="button"
        onClick={åpne}
        aria-haspopup="dialog"
        aria-expanded={åpen}
        className={`${className ?? ""} relative w-full text-left bg-white`}
      >
        {verdi ? formaterDato(verdi) : <span className="text-neutral-500">Velg dato</span>}
      </button>

      {åpen && visning && (
        <div
          role="dialog"
          aria-label="Velg dato"
          className="absolute z-20 mt-1 w-72 bg-white border border-neutral-300 rounded-lg shadow-lg p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => blaMåned(-1)}
              aria-label="Forrige måned"
              className="px-2 py-1 rounded hover:bg-neutral-100 text-neutral-900"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-neutral-900">
              {MÅNEDER[visning.måned]} {visning.år}
            </span>
            <button
              type="button"
              onClick={() => blaMåned(1)}
              aria-label="Neste måned"
              className="px-2 py-1 rounded hover:bg-neutral-100 text-neutral-900"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-600 mb-1">
            {UKEDAGER_KORT.map((u) => (
              <span key={u}>{u}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {Array.from({ length: ukedag({ ...visning, dag: 1 }) }, (_, i) => (
              <span key={`tom-${i}`} />
            ))}
            {Array.from(
              { length: new Date(visning.år, visning.måned + 1, 0).getDate() },
              (_, i) => {
                const tekst = tilTekst({ ...visning, dag: i + 1 });
                const erValgt = valgt !== null && tekst === verdi;
                return (
                  <button
                    key={tekst}
                    type="button"
                    onClick={() => velg(tekst)}
                    aria-label={formaterDato(tekst)}
                    aria-pressed={erValgt}
                    className={`rounded py-1 ${
                      erValgt
                        ? "bg-indigo-700 text-white font-semibold"
                        : tekst === iDag
                          ? "border border-indigo-600 text-neutral-900 hover:bg-indigo-50"
                          : "text-neutral-900 hover:bg-indigo-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              }
            )}
          </div>
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => velg(iDag)}
              className="text-sm text-indigo-700 font-medium hover:underline"
            >
              I dag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
