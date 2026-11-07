import Link from "next/link";
import { notFound } from "next/navigation";
import { hentBackupStatus, listBackuper, MAKS_AUTOMATISKE_KOPIER } from "@/lib/data/backup";
import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { adminBackupUrl, adminRunderUrl, adminUrl } from "@/lib/lenker";
import { gjenopprettBackup, taBackupNå } from "../../../actions";

const GRUNN: Record<string, string> = {
  automatisk: "Automatisk (natt)",
  manuell: "Manuell",
  avsluttet: "Endelig (serien avsluttet)",
  "før gjenoppretting": "Før gjenoppretting",
};

function tid(d: Date | null) {
  return d
    ? d.toLocaleString("no-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" })
    : "aldri";
}

export default async function BackupPage({
  params,
  searchParams,
}: PageProps<"/[klubb]/admin/serie/[serieId]/backup">) {
  const { klubb: klubbSlug, serieId } = await params;
  const klubb = await krevKlubbAdminSide(klubbSlug);
  const serie = await hentBackupStatus(klubb.id, serieId);
  if (!serie) notFound();
  const kopier = await listBackuper(klubb.id, serieId);
  const { ok, feil } = await searchParams;
  const kanEndre = klubb.rolle !== "demo";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm mb-4 flex gap-4">
          <Link href={adminUrl(klubb.slug)} className="text-indigo-700 font-medium hover:underline">
            ← Tilbake til admin
          </Link>
          <Link
            href={adminRunderUrl(klubb.slug, serie.id)}
            className="text-indigo-700 font-medium hover:underline"
          >
            Runder
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Sikkerhetskopier – {serie.navn}</h1>
        <p className="text-sm text-neutral-700">
          Nå: {serie._count.runder} runder, {serie._count.spillere} spillere · sist endret{" "}
          {tid(serie.sistEndret)} · siste kopi {tid(serie.sistBackup)}
        </p>
      </section>

      {typeof ok === "string" && (
        <p className="text-sm font-medium text-green-900 bg-green-50 border border-green-300 rounded px-3 py-2">
          {ok}
        </p>
      )}
      {typeof feil === "string" && (
        <p className="text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">
          {feil}
        </p>
      )}

      <section className="text-sm text-neutral-700 space-y-2 max-w-2xl">
        <p>
          Det tas automatisk kopi hver natt av serier som er endret i løpet av dagen, og en
          endelig kopi når serien avsluttes. Kopiene sendes også på e-post til appens
          Gmail-konto. De {MAKS_AUTOMATISKE_KOPIER} siste automatiske kopiene beholdes; de andre
          beholdes alltid.
        </p>
        <p>
          Er det bare én runde som er feil, er det enklere å rette den under{" "}
          <Link href={adminRunderUrl(klubb.slug, serie.id)} className="text-indigo-700 hover:underline">
            Runder
          </Link>
          . Gjenoppretting setter hele serien tilbake, og alt som er registrert etter kopien
          forsvinner. Serien slik den er nå, lagres først som en egen kopi, så gjenopprettingen
          kan angres.
        </p>
        {kanEndre ? (
          <form action={taBackupNå.bind(null, klubb.slug, serie.id)}>
            <button
              type="submit"
              className="bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
            >
              Ta kopi nå
            </button>
          </form>
        ) : (
          <p className="bg-amber-50 border border-amber-300 rounded px-3 py-2">
            Demo-admin kan se og laste ned kopier, men ikke ta kopi eller gjenopprette.
          </p>
        )}
      </section>

      <section>
        {kopier.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen kopier ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {kopier.map((k) => (
              <li key={k.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-medium text-neutral-900">{tid(k.opprettet)}</span>
                    <span className="text-sm text-neutral-600 ml-2">
                      {GRUNN[k.grunn] ?? k.grunn} · {k.antallRunder} runder · {k.antallSpillere}{" "}
                      spillere
                      {k.serienavn !== serie.navn && ` · navn: ${k.serienavn}`}
                    </span>
                  </div>
                  <a
                    href={`${adminBackupUrl(klubb.slug, serie.id)}/${k.id}`}
                    className="text-sm text-indigo-700 font-medium hover:underline"
                  >
                    Last ned
                  </a>
                </div>
                {kanEndre && (
                  <details>
                    <summary className="text-sm text-indigo-700 font-medium cursor-pointer">
                      Gjenopprett denne
                    </summary>
                    <form
                      action={gjenopprettBackup.bind(null, klubb.slug, serie.id, k.id)}
                      className="mt-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm space-y-3"
                    >
                      <p>
                        Serien får {k.antallRunder} runder og {k.antallSpillere} spillere (nå:{" "}
                        {serie._count.runder} runder og {serie._count.spillere} spillere).
                      </p>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" name="bekreft" value="ja" required className="mt-1" />
                        <span>
                          Jeg forstår at alt som er registrert i serien etter {tid(k.opprettet)}{" "}
                          blir borte.
                        </span>
                      </label>
                      <button
                        type="submit"
                        className="bg-amber-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-amber-700"
                      >
                        Gjenopprett serien
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
