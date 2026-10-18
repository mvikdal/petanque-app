import Link from "next/link";
import { Topplinje } from "@/components/Topplinje";
import { listKlubber } from "@/lib/data/klubber";
import { klubbUrl } from "@/lib/lenker";

// Klubbvelger. Hver klubb har sin egen side på /[slug].
export default async function Home() {
  const klubber = await listKlubber();

  return (
    <>
      <Topplinje tittel="Petanque Seriespill" hjemUrl="/" />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold mb-4">Velg klubb</h1>
        {klubber.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen klubber er opprettet ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {klubber.map((k) => (
              <li key={k.id}>
                <Link
                  href={klubbUrl(k.slug)}
                  className="flex items-center justify-between px-4 py-4 hover:bg-neutral-50"
                >
                  <span className="font-semibold text-neutral-900">{k.navn}</span>
                  <span className="text-sm text-neutral-600">{k._count.serier} serie(r)</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
