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
        <h1 className="text-xl font-semibold mb-4">Admin</h1>
        <p className="text-sm text-neutral-500">
          Ingen innlogging er satt opp i denne lokale prototypen. Legg til
          passordbeskyttelse før dette publiseres på nett.
        </p>
      </section>

      <section>
        <h2 className="font-medium mb-3">Serier</h2>
        {serier.length === 0 && (
          <p className="text-sm text-neutral-500">Ingen serier opprettet ennå.</p>
        )}
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-md bg-white">
          {serier.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{s.navn}</div>
                <div className="text-xs text-neutral-500">
                  {s._count.runder} runde(r) · poeng til {s.poengGrense} · {s.status}
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <Link
                  className="text-blue-600 hover:underline"
                  href={`/admin/serie/${s.id}/ny-runde`}
                >
                  Ny runde
                </Link>
                <Link className="text-neutral-500 hover:underline" href={`/serie/${s.id}`}>
                  Offentlig side
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-3">Opprett ny serie</h2>
        <form
          action={createSerie}
          className="bg-white border border-neutral-200 rounded-md p-4 space-y-4 max-w-md"
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
            className="bg-neutral-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-neutral-700"
          >
            Opprett serie
          </button>
        </form>
      </section>
    </div>
  );
}
