import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function AdminRunderPage({
  params,
}: {
  params: Promise<{ serieId: string }>;
}) {
  const { serieId } = await params;
  const serie = await prisma.serie.findUnique({
    where: { id: serieId },
    include: {
      runder: {
        orderBy: { rundenummer: "desc" },
        include: { _count: { select: { deltakelser: true, endringer: true } } },
      },
    },
  });
  if (!serie) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Runder – {serie.navn}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        <Link href={`/admin/serie/${serie.id}/ny-runde`} className="text-blue-600 hover:underline">
          + Ny runde
        </Link>
      </p>
      {serie.runder.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen runder registrert ennå.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-md bg-white">
          {serie.runder.map((runde) => (
            <li key={runde.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span>
                  Runde {runde.rundenummer} · {new Date(runde.dato).toLocaleDateString("no-NO")}
                </span>
                <span className="text-xs text-neutral-500 ml-2">
                  {runde._count.deltakelser} deltaker(e)
                  {runde._count.endringer > 0 &&
                    ` · rettet ${runde._count.endringer} gang(er)`}
                </span>
              </div>
              <div className="flex gap-3 text-sm">
                <Link
                  href={`/admin/serie/${serie.id}/runde/${runde.id}/rediger`}
                  className="text-blue-600 hover:underline"
                >
                  Rediger
                </Link>
                <Link
                  href={`/serie/${serie.id}/runde/${runde.id}`}
                  className="text-neutral-500 hover:underline"
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
