import { filnavnForKopi, type LagretKopi } from "@/lib/data/backup";
import { sendEpost } from "@/lib/epost";

// Sender sikkerhetskopier som JSON-vedlegg til appens egen Gmail-konto
// (EPOST_BRUKER), så det finnes en kopi utenfor databasen. Demo-klubben
// sendes ikke - den kan endres av hvem som helst og gir bare støy.

export async function sendKopierPåEpost(kopier: LagretKopi[]) {
  const aktuelle = kopier.filter((k) => k.klubbSlug !== "demo");
  if (aktuelle.length === 0) return;

  const dato = aktuelle[0].opprettet.toLocaleDateString("no-NO", { timeZone: "Europe/Oslo" });
  await sendEpost({
    til: process.env.EPOST_BRUKER ?? "lokal-utvikling",
    emne: `Sikkerhetskopi ${dato}: ${aktuelle.length} serie(r)`,
    tekst:
      `Sikkerhetskopi av serier som er endret:\n\n` +
      aktuelle
        .map(
          (k) =>
            `- ${k.klubbSlug} / ${k.serienavn}: ${k.antallRunder} runder, ` +
            `${k.antallSpillere} spillere (${k.grunn})`
        )
        .join("\n") +
      `\n\nKopiene ligger også i appen under Admin → serien → Sikkerhetskopier, ` +
      `og kan gjenopprettes derfra.`,
    vedlegg: aktuelle.map((k) => ({
      filnavn: filnavnForKopi(k),
      innhold: k.data,
      type: "application/json",
    })),
  });
}
