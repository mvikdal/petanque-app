import Link from "next/link";
import { MIN_PASSORDLENGDE } from "@/lib/auth/passord";
import { listKlubbAdmins } from "@/lib/data/brukere";
import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { adminUrl } from "@/lib/lenker";
import { byttEgetPassord, leggTilAdmin } from "./actions";

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
          resultater, men ikke bytte passord eller legge til brukere.
        </p>
      ) : (
        <>
          <section>
            <h2 className={overskrift}>Bytt passord</h2>
            <form action={byttEgetPassord.bind(null, k.slug)} className={skjemaboks}>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="gammelt">
                  Nåværende passord
                </label>
                <input id="gammelt" name="gammelt" type="password" autoComplete="current-password" required className={felt} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="nytt">
                  Nytt passord (minst {MIN_PASSORDLENGDE} tegn)
                </label>
                <input id="nytt" name="nytt" type="password" autoComplete="new-password" required minLength={MIN_PASSORDLENGDE} className={felt} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="gjenta">
                  Gjenta nytt passord
                </label>
                <input id="gjenta" name="gjenta" type="password" autoComplete="new-password" required minLength={MIN_PASSORDLENGDE} className={felt} />
              </div>
              <button type="submit" className={knapp}>
                Bytt passord
              </button>
            </form>
          </section>

          <section>
            <h2 className={overskrift}>Legg til administrator</h2>
            <form action={leggTilAdmin.bind(null, k.slug)} className={skjemaboks}>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="epost">
                  E-post
                </label>
                <input id="epost" name="epost" type="email" required className={felt} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="passord">
                  Midlertidig passord (minst {MIN_PASSORDLENGDE} tegn)
                </label>
                <input id="passord" name="passord" type="text" autoComplete="off" className={felt} />
              </div>
              <p className="text-xs text-neutral-600">
                Finnes e-posten fra før (for eksempel som admin i en annen klubb), beholder
                personen sitt eksisterende passord.
              </p>
              <button type="submit" className={knapp}>
                Legg til
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
