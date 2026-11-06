import Link from "next/link";
import { listKlubbAdmins } from "@/lib/data/brukere";
import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { adminUrl } from "@/lib/lenker";
import { leggTilAdmin } from "./actions";

const felt = "w-full border border-neutral-300 rounded px-3 py-2 text-sm";
const knapp =
  "bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800";
const overskrift =
  "font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3";
const skjemaboks = "bg-white border border-neutral-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm";

export default async function KontoPage({ params, searchParams }: PageProps<"/[klubb]/admin/konto">) {
  const k = await krevKlubbAdminSide((await params).klubb);
  const { ok, feil } = await searchParams;
  const admins = await listKlubbAdmins(k.id);
  const erDemo = k.rolle === "demo";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm mb-4">
          <Link href={adminUrl(k.slug)} className="text-indigo-700 font-medium hover:underline">
            ← Tilbake til admin
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">Konto og administratorer</h1>
      </section>

      {typeof ok === "string" && (
        <p className="text-sm font-medium text-green-900 bg-green-50 border border-green-300 rounded px-3 py-2">
          {ok}
        </p>
      )}
      {typeof feil === "string" && (
        <p className="text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">
          {feil}
        </p>
      )}

      <section>
        <h2 className={overskrift}>Administratorer i {k.navn}</h2>
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm text-sm max-w-md">
          {admins.map((a) => (
            <li key={a.bruker.id} className="px-4 py-2 text-neutral-900">
              {a.bruker.epost}
              {a.rolle === "demo" && <span className="ml-2 text-xs text-amber-800">demo</span>}
            </li>
          ))}
        </ul>
      </section>

      {erDemo ? (
        <p className="text-sm text-neutral-700 bg-amber-50 border border-amber-300 rounded px-3 py-2 max-w-md">
          Du er logget inn som demo-admin. Demo-admin kan registrere og rette
          resultater, men ikke legge til brukere.
        </p>
      ) : (
        <section>
          <h2 className={overskrift}>Legg til administrator</h2>
          <form action={leggTilAdmin.bind(null, k.slug)} className={skjemaboks}>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="epost">
                E-post
              </label>
              <input id="epost" name="epost" type="email" required className={felt} />
            </div>
            <p className="text-xs text-neutral-600">
              Personen logger inn med e-postadressen sin og får en kode tilsendt. Det
              trengs ikke passord.
            </p>
            <button type="submit" className={knapp}>
              Legg til
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
