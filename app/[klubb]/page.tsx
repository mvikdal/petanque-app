import Link from "next/link";
import { hentKlubbEllers404 } from "@/lib/data/klubber";
import { listSerier } from "@/lib/data/serier";
import { adminUrl, serieUrl } from "@/lib/lenker";

// Klubbens offentlige side - lenken som deles med spillerne.
export default async function KlubbPage({ params }: PageProps<"/[klubb]">) {
  const klubb = await hentKlubbEllers404((await params).klubb);
  const serier = await listSerier(klubb.id);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-xl font-semibold mb-4">Serier</h1>
        {serier.length === 0 ? (
          <p className="text-sm text-neutral-700">
            Ingen serier er opprettet ennå. Gå til{" "}
            <Link
              href={adminUrl(klubb.slug)}
              prefetch={false}
              className="text-indigo-700 font-medium hover:underline"
            >
              admin
            </Link>{" "}
            for å opprette en.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {serier.map((s) => (
              <li key={s.id}>
                <Link
                  href={serieUrl(klubb.slug, s.id)}
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
        )}
      </section>
    </div>
  );
}
