import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateSerie } from "../../../actions";

export default async function RedigerSeriePage({
  params,
}: {
  params: Promise<{ serieId: string }>;
}) {
  const { serieId } = await params;
  const serie = await prisma.serie.findUnique({
    where: { id: serieId },
    include: { klubb: true, _count: { select: { runder: true } } },
  });
  if (!serie) notFound();

  const lagre = updateSerie.bind(null, serie.id);

  return (
    <div>
      <p className="text-sm mb-4">
        <Link href="/admin" className="text-indigo-700 font-medium hover:underline">
          ← Tilbake til admin
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Rediger serie</h1>
      <p className="text-sm text-neutral-600 mb-6">
        {serie.klubb.navn} · {serie._count.runder} runde(r) · poeng til {serie.poengGrense}
      </p>
      <form
        action={lagre}
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
            defaultValue={serie.navn}
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
            defaultValue={serie.ukedager}
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="antallTellendeRunder">
              Tellende runder
            </label>
            <input
              id="antallTellendeRunder"
              name="antallTellendeRunder"
              type="number"
              required
              min={1}
              defaultValue={serie.antallTellendeRunder}
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={serie.status}
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            >
              <option value="aktiv">aktiv</option>
              <option value="avsluttet">avsluttet</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-600">
          Endring av tellende runder slår straks inn i sesongtabellen og i markeringen av
          strøkne runder. Poenggrensen kan ikke endres, siden lagrede resultater er
          registrert etter den.
        </p>
        <button
          type="submit"
          className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
        >
          Lagre
        </button>
      </form>
    </div>
  );
}
