import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const serier = await prisma.serie.findMany({
    orderBy: { opprettet: "desc" },
    include: { _count: { select: { runder: true } } },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Serier</h1>
      {serier.length === 0 && (
        <p className="text-sm text-neutral-700">
          Ingen serier er opprettet ennå. Gå til{" "}
          <Link href="/admin" className="text-indigo-700 font-medium hover:underline">
            admin
          </Link>{" "}
          for å opprette en.
        </p>
      )}
      <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
        {serier.map((s) => (
          <li key={s.id}>
            <Link
              href={`/serie/${s.id}`}
              className="flex items-center justify-between px-4 py-4 hover:bg-neutral-50"
            >
              <span className="font-semibold text-neutral-900">{s.navn}</span>
              <span className="text-sm text-neutral-600">
                {s._count.runder} runde(r) spilt · {s.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
