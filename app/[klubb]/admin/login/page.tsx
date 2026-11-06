import { KodeInnlogging } from "@/components/admin/KodeInnlogging";
import { hentKlubbEllers404 } from "@/lib/data/klubber";
import { adminUrl } from "@/lib/lenker";
import { bekreftKode, loggInnSomDemo, sendKode } from "./actions";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[klubb]/admin/login">) {
  const klubb = await hentKlubbEllers404((await params).klubb);
  const { feil, neste, steg, epost } = await searchParams;
  const erDemo = klubb.slug === "demo";

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Logg inn</h1>
      <p className="text-sm text-neutral-700 mb-6">Admin for {klubb.navn}</p>
      {/* Demo-klubben kan prøves av hvem som helst (instruks §6), uten e-post. */}
      {erDemo && (
        <form
          action={loggInnSomDemo.bind(null, klubb.slug)}
          className="mb-6 text-sm text-neutral-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-2"
        >
          <p className="font-semibold">Prøv admin selv</p>
          <button
            type="submit"
            className="w-full bg-amber-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-amber-700"
          >
            Prøv som demo
          </button>
          <p className="text-xs text-neutral-600">
            Demo-klubben er til utprøving. Alt du registrerer kan endres av andre.
          </p>
          {feil === "demo" && (
            <p className="text-xs font-medium text-red-800">Demo-innloggingen er ikke satt opp.</p>
          )}
        </form>
      )}
      <KodeInnlogging
        sendKode={sendKode.bind(null, klubb.slug)}
        bekreftKode={bekreftKode.bind(null, klubb.slug)}
        steg={steg === "kode" ? "kode" : "epost"}
        epost={typeof epost === "string" ? epost : ""}
        neste={typeof neste === "string" ? neste : adminUrl(klubb.slug)}
        feil={typeof feil === "string" ? feil : undefined}
        hvem={`er admin i ${klubb.navn}`}
      />
    </div>
  );
}
