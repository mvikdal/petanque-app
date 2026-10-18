import Link from "next/link";
import { MIN_PASSORDLENGDE } from "@/lib/auth/passord";
import { listKlubberMedAdmins } from "@/lib/data/superadmin";
import { adminUrl, klubbUrl } from "@/lib/lenker";
import { krevSuperadminSide } from "@/lib/superadmin";
import { leggTilAdmin, opprettKlubbMedAdmin, tilbakestillPassord } from "./actions";
import { loggUtSuperadmin } from "./login/actions";

const felt = "w-full border border-neutral-300 rounded px-3 py-2 text-sm";
const knapp =
  "bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800";
const overskrift =
  "font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3";

// Superadmin håndterer bare klubber og brukere - ingen serier eller
// resultater vises eller kan endres herfra (instruks §5).
export default async function SuperadminPage({ searchParams }: PageProps<"/superadmin">) {
  await krevSuperadminSide();
  const { ok, feil } = await searchParams;
  const klubber = await listKlubberMedAdmins();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Klubber og brukere</h1>
        <form action={loggUtSuperadmin}>
          <button type="submit" className="text-sm text-indigo-700 font-medium hover:underline">
            Logg ut
          </button>
        </form>
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
        <h2 className={overskrift}>Klubber</h2>
        <ul className="space-y-4">
          {klubber.map((k) => (
            <li key={k.id} className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-semibold text-neutral-900">{k.navn}</span>{" "}
                  <span className="text-sm text-neutral-600">
                    · {k._count.serier} serie(r)
                  </span>
                </div>
                <div className="flex gap-3 text-sm">
                  <Link href={klubbUrl(k.slug)} className="text-indigo-700 hover:underline">
                    /{k.slug}
                  </Link>
                  <Link
                    href={`${adminUrl(k.slug)}/login`}
                    className="text-indigo-700 hover:underline"
                  >
                    Admin-innlogging
                  </Link>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-neutral-900 mt-4 mb-2">Administratorer</h3>
              {k.admins.length === 0 ? (
                <p className="text-sm text-neutral-600">Ingen administratorer ennå.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 text-sm">
                  {k.admins.map((a) => (
                    <li
                      key={a.bruker.id}
                      className="py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-neutral-900">
                        {a.bruker.epost}
                        {a.rolle === "demo" && (
                          <span className="ml-2 text-xs text-amber-800">demo</span>
                        )}
                        {a.bruker.erSuperadmin && (
                          <span className="ml-2 text-xs text-indigo-800">superadmin</span>
                        )}
                      </span>
                      {!a.bruker.erSuperadmin && (
                        <form
                          action={tilbakestillPassord.bind(null, a.bruker.id)}
                          className="flex gap-2"
                        >
                          <input
                            name="passord"
                            type="text"
                            required
                            minLength={MIN_PASSORDLENGDE}
                            autoComplete="off"
                            placeholder="Nytt midlertidig passord"
                            aria-label={`Nytt passord for ${a.bruker.epost}`}
                            className="border border-neutral-300 rounded px-2 py-1 text-sm w-52"
                          />
                          <button
                            type="submit"
                            className="border border-indigo-700 text-indigo-700 rounded px-3 py-1 text-sm font-medium hover:bg-indigo-50"
                          >
                            Tilbakestill passord
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <details className="mt-3">
                <summary className="text-sm text-indigo-700 font-medium cursor-pointer">
                  Legg til administrator
                </summary>
                <form
                  action={leggTilAdmin.bind(null, k.id)}
                  className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end"
                >
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor={`epost-${k.id}`}>
                      E-post
                    </label>
                    <input id={`epost-${k.id}`} name="epost" type="email" required className={felt} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor={`passord-${k.id}`}>
                      Midlertidig passord
                    </label>
                    <input
                      id={`passord-${k.id}`}
                      name="passord"
                      type="text"
                      autoComplete="off"
                      className={felt}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor={`rolle-${k.id}`}>
                      Rolle
                    </label>
                    <select id={`rolle-${k.id}`} name="rolle" defaultValue="admin" className={felt}>
                      <option value="admin">admin</option>
                      <option value="demo">demo</option>
                    </select>
                  </div>
                  <button type="submit" className={knapp}>
                    Legg til
                  </button>
                </form>
                <p className="text-xs text-neutral-600 mt-2">
                  Finnes e-posten fra før, beholder brukeren sitt eksisterende passord.
                  Demo-rollen kan registrere resultater, men ikke bytte passord eller
                  opprette brukere.
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={overskrift}>Opprett ny klubb</h2>
        <form
          action={opprettKlubbMedAdmin}
          className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="navn">
              Navn
            </label>
            <input id="navn" name="navn" required placeholder="F.eks. Grünerløkka" className={felt} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="slug">
              Slug (adressen, f.eks. grunerlokka)
            </label>
            <input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Små bokstaver a-z, tall og bindestrek"
              className={felt}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="epost">
              E-post til første admin
            </label>
            <input id="epost" name="epost" type="email" required className={felt} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="passord">
              Midlertidig passord (minst {MIN_PASSORDLENGDE} tegn)
            </label>
            <input
              id="passord"
              name="passord"
              type="text"
              required
              minLength={MIN_PASSORDLENGDE}
              autoComplete="off"
              className={felt}
            />
          </div>
          <button type="submit" className={knapp}>
            Opprett klubb
          </button>
        </form>
      </section>
    </div>
  );
}
