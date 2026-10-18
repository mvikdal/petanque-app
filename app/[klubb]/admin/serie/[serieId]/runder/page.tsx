import Link from "next/link";
import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { hentSerieMedRundeliste } from "@/lib/data/serier";
import { adminNyRundeUrl, adminRedigerRundeUrl, rundeUrl } from "@/lib/lenker";
import { notFound } from "next/navigation";
import { sorterRunderEtterDato } from "../../../actions";

export default async function AdminRunderPage({
  params,
}: {
  params: Promise<{ klubb: string; serieId: string }>;
}) {
  const { klubb: klubbSlug, serieId } = await params;
  const klubb = await krevKlubbAdminSide(klubbSlug);
  const serie = await hentSerieMedRundeliste(klubb.id, serieId);
  if (!serie) notFound();

  // Runder registrert før automatisk renummerering (2026-10-15) kan ha
  // rundenummer i utakt med datoen.
  const etterDato = [...serie.runder].sort(
    (a, b) => a.dato.getTime() - b.dato.getTime() || a.rundenummer - b.rundenummer
  );
  const iUtakt = etterDato.some((r, i) => r.rundenummer !== i + 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Runder – {serie.navn}</h1>
      <p className="text-sm mb-6">
        <Link href={adminNyRundeUrl(klubb.slug, serie.id)} className="text-indigo-700 font-medium hover:underline">
          + Ny runde
        </Link>
      </p>
      {iUtakt && (
        <form
          action={sorterRunderEtterDato.bind(null, klubb.slug, serie.id)}
          className="mb-6 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-neutral-900 flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            Rundenumrene følger ikke datoene. Nummerer om slik at eldste runde blir runde 1?
          </span>
          <button
            type="submit"
            className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
          >
            Sorter runder etter dato
          </button>
        </form>
      )}
      {serie.runder.length === 0 ? (
        <p className="text-sm text-neutral-700">Ingen runder registrert ennå.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
          {serie.runder.map((runde) => (
            <li key={runde.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium text-neutral-900">
                  Runde {runde.rundenummer} · {new Date(runde.dato).toLocaleDateString("no-NO")}
                </span>
                <span className="text-sm text-neutral-600 ml-2">
                  {runde._count.deltakelser} deltaker(e)
                  {runde._count.endringer > 0 &&
                    ` · rettet ${runde._count.endringer} gang(er)`}
                </span>
              </div>
              <div className="flex gap-3 text-sm">
                <Link
                  href={adminRedigerRundeUrl(klubb.slug, serie.id, runde.id)}
                  className="text-indigo-700 font-medium hover:underline"
                >
                  Rediger
                </Link>
                <Link
                  href={rundeUrl(klubb.slug, serie.id, runde.id)}
                  className="text-neutral-600 hover:underline"
                >
                  Offentlig side
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
