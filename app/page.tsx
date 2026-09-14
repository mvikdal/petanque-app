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
        <p className="text-sm text-neutral-500">
          Ingen serier er opprettet ennå. Gå til{" "}
          <Link href="/admin" className="text-blue-600 hover:underline">
            admin
          </Link>{" "}
          for å opprette en.
        </p>
      )}
      <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-md bg-white">
        {serier.map((s) => (
          <li key={s.id}>
            <Link
              href={`/serie/${s.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <span className="font-medium">{s.navn}</span>
              <span className="text-xs text-neutral-500">
                {s._count.runder} runde(r) spilt · {s.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
