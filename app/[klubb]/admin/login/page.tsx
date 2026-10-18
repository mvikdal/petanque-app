import { hentKlubbEllers404 } from "@/lib/data/klubber";
import { adminUrl } from "@/lib/lenker";
import { loggInn } from "./actions";

// Demo-klubbens innlogging vises åpent, slik at hvem som helst kan prøve
// admin (instruks §6). Verdiene ligger i miljøvariabler, ikke i koden, og
// brukeren opprettes med scripts/opprett-demo-admin.ts.
function hentDemoInnlogging(slug: string) {
  const epost = process.env.DEMO_ADMIN_EPOST;
  const passord = process.env.DEMO_ADMIN_PASSORD;
  return slug === "demo" && epost && passord ? { epost, passord } : null;
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[klubb]/admin/login">) {
  const klubb = await hentKlubbEllers404((await params).klubb);
  const { feil, neste } = await searchParams;
  const demoInnlogging = hentDemoInnlogging(klubb.slug);

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Logg inn</h1>
      <p className="text-sm text-neutral-700 mb-6">Admin for {klubb.navn}</p>
      {demoInnlogging && (
        <div className="mb-6 text-sm text-neutral-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
          <p className="font-semibold mb-1">Prøv admin selv</p>
          <p>
            E-post: <code className="font-mono">{demoInnlogging.epost}</code>
            <br />
            Passord: <code className="font-mono">{demoInnlogging.passord}</code>
          </p>
          <p className="text-xs text-neutral-600 mt-2">
            Demo-klubben er til utprøving. Alt du registrerer kan endres av andre.
          </p>
        </div>
      )}
      <form
        action={loggInn.bind(null, klubb.slug)}
        className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 shadow-sm"
      >
        <input
          type="hidden"
          name="neste"
          value={typeof neste === "string" ? neste : adminUrl(klubb.slug)}
        />
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="epost">
            E-post
          </label>
          <input
            id="epost"
            name="epost"
            type="email"
            autoComplete="username"
            required
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="passord">
            Passord
          </label>
          <input
            id="passord"
            name="passord"
            type="password"
            autoComplete="current-password"
            required
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
        </div>
        {feil && (
          <p className="text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">
            Feil e-post eller passord, eller du er ikke admin i {klubb.navn}.
          </p>
        )}
        <button
          type="submit"
          className="w-full bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
        >
          Logg inn
        </button>
      </form>
    </div>
  );
}
