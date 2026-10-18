import Link from "next/link";
import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { listSerier } from "@/lib/data/serier";
import {
  adminGuideUrl,
  adminKontoUrl,
  adminNyRundeUrl,
  adminRedigerSerieUrl,
  adminRunderUrl,
  serieUrl,
} from "@/lib/lenker";
import { createSerie } from "./actions";
import { loggUt } from "./login/actions";

export default async function AdminPage({ params }: PageProps<"/[klubb]/admin">) {
  const klubb = await krevKlubbAdminSide((await params).klubb);
  const serier = await listSerier(klubb.id);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-neutral-900 mb-4">Admin – {klubb.navn}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-neutral-700">
          <Link href={adminGuideUrl(klubb.slug)} className="text-indigo-700 font-medium hover:underline">
            Brukerguide →
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={adminKontoUrl(klubb.slug)} className="text-indigo-700 font-medium hover:underline">
            Konto og administratorer →
          </Link>
          <span aria-hidden="true">·</span>
          <form action={loggUt.bind(null, klubb.slug)}>
            <button type="submit" className="text-indigo-700 font-medium hover:underline">
              Logg ut
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Serier
        </h2>
        {serier.length === 0 && (
          <p className="text-sm text-neutral-700">Ingen serier opprettet ennå.</p>
        )}
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
          {serier.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-semibold text-neutral-900">{s.navn}</div>
                <div className="text-sm text-neutral-600">
                  {s._count.runder} runde(r) · poeng til {s.poengGrense} · beste{" "}
                  {s.antallTellendeRunder} teller · {s.status}
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <Link
                  className="text-indigo-700 font-medium hover:underline"
                  href={adminNyRundeUrl(klubb.slug, s.id)}
                >
                  Ny runde
                </Link>
                <Link
                  className="text-indigo-700 font-medium hover:underline"
                  href={adminRunderUrl(klubb.slug, s.id)}
                >
                  Runder
                </Link>
                <Link
                  className="text-indigo-700 font-medium hover:underline"
                  href={adminRedigerSerieUrl(klubb.slug, s.id)}
                >
                  Rediger
                </Link>
                <Link className="text-neutral-600 hover:underline" href={serieUrl(klubb.slug, s.id)}>
                  Offentlig side
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Opprett ny serie
        </h2>
        <form
          action={createSerie.bind(null, klubb.slug)}
          className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="navn">
              Navn
            </label>
            <input
              id="navn"
              name="navn"
              required
              placeholder="Mandag/Onsdag-serien"
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="ukedager">
              Ukedager (kun til visning)
            </label>
            <input
              id="ukedager"
              name="ukedager"
              placeholder="mandag, onsdag"
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="sesongStart">
              Sesongstart
            </label>
            <input
              id="sesongStart"
              name="sesongStart"
              type="date"
              required
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="poengGrense">
                Poeng til
              </label>
              <input
                id="poengGrense"
                name="poengGrense"
                type="number"
                defaultValue={13}
                min={1}
                className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="antallTellendeRunder"
              >
                Tellende runder
              </label>
              <input
                id="antallTellendeRunder"
                name="antallTellendeRunder"
                type="number"
                defaultValue={12}
                min={1}
                className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
          >
            Opprett serie
          </button>
        </form>
      </section>
    </div>
  );
}
