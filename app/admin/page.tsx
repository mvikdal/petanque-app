import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSerie } from "./actions";

export default async function AdminPage() {
  const serier = await prisma.serie.findMany({
    orderBy: { opprettet: "desc" },
    include: { _count: { select: { runder: true } } },
  });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-neutral-900 mb-4">Admin</h1>
        <p className="text-sm text-neutral-700">
          Beskyttet med admin-passord. Denne siden er ikke lenket fra de
          offentlige sidene.
        </p>
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
                  {s._count.runder} runde(r) · poeng til {s.poengGrense} · {s.status}
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <Link
                  className="text-indigo-700 font-medium hover:underline"
                  href={`/admin/serie/${s.id}/ny-runde`}
                >
                  Ny runde
                </Link>
                <Link
                  className="text-indigo-700 font-medium hover:underline"
                  href={`/admin/serie/${s.id}/runder`}
                >
                  Runder
                </Link>
                <Link className="text-neutral-600 hover:underline" href={`/serie/${s.id}`}>
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
          action={createSerie}
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
