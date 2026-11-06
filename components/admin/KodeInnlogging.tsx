import { KODE_LEVETID_MINUTTER, KODELENGDE } from "@/lib/auth/engangskode";

// Skjemaene for innlogging med engangskode, brukt både av klubbenes admin
// og /superadmin. Steg 1 ber om e-post og sender koden, steg 2 tar imot
// koden. Alt styres av URL-en (?steg=kode&epost=...), uten klientkode.

const felt = "w-full border border-neutral-300 rounded px-3 py-2 text-sm";
const knapp =
  "w-full bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800";
const boks = "bg-white border border-neutral-200 rounded-lg p-4 space-y-4 shadow-sm";
const feilboks =
  "text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2";

type Props = {
  sendKode: (formData: FormData) => Promise<void>;
  bekreftKode: (formData: FormData) => Promise<void>;
  steg: "epost" | "kode";
  epost: string;
  neste?: string;
  feil?: string;
  // Hvem som kan logge inn, til feilmeldingen ved feil kode.
  hvem: string;
};

export function KodeInnlogging({ sendKode, bekreftKode, steg, epost, neste, feil, hvem }: Props) {
  const nesteFelt = neste !== undefined && <input type="hidden" name="neste" value={neste} />;

  if (steg === "kode") {
    return (
      <div className="space-y-4">
        <form action={bekreftKode} className={boks}>
          {nesteFelt}
          <input type="hidden" name="epost" value={epost} />
          <p className="text-sm text-neutral-900">
            Hvis <strong>{epost}</strong> {hvem}, er det sendt en kode dit. Den gjelder i{" "}
            {KODE_LEVETID_MINUTTER} minutter.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="kode">
              Kode fra e-posten
            </label>
            <input
              id="kode"
              name="kode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={KODELENGDE + 2}
              required
              autoFocus
              className={`${felt} font-mono tracking-widest text-lg`}
            />
          </div>
          {feil === "kode" && (
            <p className={feilboks}>
              Koden er feil eller utløpt. Etter flere feil forsøk må du be om en ny kode.
            </p>
          )}
          <button type="submit" className={knapp}>
            Logg inn
          </button>
        </form>
        <form action={sendKode} className="text-sm text-neutral-700">
          {nesteFelt}
          <input type="hidden" name="epost" value={epost} />
          Fikk du ingen e-post? Sjekk søppelpost, eller{" "}
          <button type="submit" className="text-indigo-700 font-medium hover:underline">
            send en ny kode
          </button>
          . Du kan be om høyst fem koder i timen.
        </form>
      </div>
    );
  }

  return (
    <form action={sendKode} className={boks}>
      {nesteFelt}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="epost">
          E-post
        </label>
        <input
          id="epost"
          name="epost"
          type="email"
          autoComplete="email"
          defaultValue={epost}
          required
          className={felt}
        />
      </div>
      <p className="text-xs text-neutral-600">
        Du får en kode på e-post som du taster inn i neste steg. Det trengs ikke passord.
      </p>
      {feil === "sending" && (
        <p className={feilboks}>Kunne ikke sende e-post akkurat nå. Prøv igjen litt senere.</p>
      )}
      <button type="submit" className={knapp}>
        Send kode
      </button>
    </form>
  );
}
