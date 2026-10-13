import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createKlubb } from "../actions";

export default async function AdminKlubberPage() {
  const klubber = await prisma.klubb.findMany({
    orderBy: { navn: "asc" },
    include: { _count: { select: { serier: true } } },
  });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Klubber</h1>
        <p className="text-sm text-neutral-700">
          <Link href="/admin" className="text-indigo-700 font-medium hover:underline">
            ← Tilbake til admin
          </Link>
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Eksisterende klubber
        </h2>
        {klubber.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen klubber opprettet ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {klubber.map((k) => (
              <li key={k.id} className="px-4 py-3">
                <div className="font-semibold text-neutral-900">{k.navn}</div>
                <div className="text-sm text-neutral-600">{k._count.serier} serie(r)</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Opprett ny klubb
        </h2>
        <form
          action={createKlubb}
          className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1" htmlFor="navn">
              Navn
            </label>
            <input
              id="navn"
              name="navn"
              required
              placeholder="F.eks. Grünerløkka"
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
          >
            Opprett klubb
          </button>
        </form>
      </section>
    </div>
  );
}
