import Link from "next/link";

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
        {tittel}
      </h2>
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-2 text-sm text-neutral-900">
        {children}
      </div>
    </section>
  );
}

export default function AdminGuidePage() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Brukerguide</h1>
        <p className="text-sm text-neutral-700">
          <Link href="/admin" className="text-indigo-700 font-medium hover:underline">
            ← Tilbake til admin
          </Link>
        </p>
      </section>

      <Seksjon tittel="Oppbygning">
        <p>
          Alt er bygget opp i fire nivåer:{" "}
          <strong>Klubb → Serie → Runde → Deltakelse</strong>.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Klubb</strong> – toppnivå, f.eks. «Sinsen». Flere klubber kan opprettes.</li>
          <li><strong>Serie</strong> – en sesongvarig serie, f.eks. «Lillekula». Hører til én klubb.</li>
          <li><strong>Runde</strong> – én spillekveld i en serie, med 3 kamper per spiller.</li>
          <li><strong>Deltakelse</strong> – én spillers resultat i én runde.</li>
        </ul>
      </Seksjon>

      <Seksjon tittel="Offentlige sider (ingen innlogging)">
        <p>Alle kan se resultater uten å logge inn:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Forsiden</strong> – lister serier, gruppert under sin klubb.</li>
          <li>
            <strong>Serieside</strong> – viser serierekord, og en veksling mellom to tabeller:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li><strong>Sesongtabell</strong> – rangert på snitt seire og poeng, med egne kolonner for «beste N runder» (tellende) og «alle runder». Til slutt kommer «Statistikk»: runder spilt (📅), kamper spilt (🎯 – kan være færre enn 3 per runde hvis en spiller må gå), antall rundeseiere (🏆, delt seier teller for alle), antall 3-ere (runder med 3 seire) og spillerens beste runde (⭐ – klikk på resultatet for å åpne runden). Symbolene er forklart under tabellen.</li>
              <li><strong>Alle runder</strong> – en matrise med alle spillere og alle runder, der du ser hver enkelt runde-score direkte. Rundevinneren er markert med sterk grønn, og alle med 3 seire i runden med lys grønn. Runder som er strøket (ikke blant de beste N) er gjennomstreket, og spillerens svakeste tellende runde – den en ny runde må slå – har rød bakgrunn. Den røde markeringen vises først når spilleren har spilt minst N runder.</li>
            </ul>
          </li>
          <li><strong>Rundeside</strong> – detaljert resultat for én runde, alle spilleres 3 kamper.</li>
        </ul>
      </Seksjon>

      <Seksjon tittel="Admin (krever passord)">
        <p>
          Admin-sidene (<code>/admin</code> og underliggende sider) krever admin-passord. Du kommer dit via tannhjulet øverst til høyre.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Admin → Klubber</strong> – opprett nye klubber.</li>
          <li><strong>Admin</strong> – opprett nye serier (velg klubb, poenggrense, antall tellende runder), og se oversikt over eksisterende serier.</li>
          <li><strong>Ny runde</strong> – registrer resultatene for en spillekveld (se under).</li>
          <li><strong>Runder</strong> – liste over alle runder i en serie, med lenke til å rette en allerede lagret runde.</li>
        </ul>
      </Seksjon>

      <Seksjon tittel="Slik registrerer du en ny runde">
        <ol className="list-decimal list-inside space-y-1">
          <li>Gå til <strong>Admin</strong>, finn serien, klikk <strong>Ny runde</strong>.</li>
          <li>Velg hvilke spillere som deltok (huk av i listen), eller legg til en helt ny spiller med navnefeltet under.</li>
          <li>
            Fyll inn poengforskjell for hver av de 3 kampene per spiller. Positivt tall
            = vant kampen, negativt = tapte.
          </li>
          <li>
            Fikk en spiller ikke spilt alle 3 kampene? La feltet stå tomt - resultatet
            lagres likevel, men vises i <em>kursiv</em> som ufullstendig overalt det
            forekommer.
          </li>
          <li>Trykk <strong>Lagre runde</strong>.</li>
        </ol>
      </Seksjon>

      <Seksjon tittel="Slik retter du en runde i etterkant">
        <p>
          Under <strong>Admin → [en serie] → Runder</strong> kan du klikke{" "}
          <strong>Rediger</strong> på hvilken som helst runde, uansett hvor gammel den er.
        </p>
        <p>
          Skjemaet er likt som ved registrering, men har i tillegg et kommentarfelt der du
          bør skrive hvorfor du retter. Endringen logges med tidspunkt og kommentar, og
          vises nederst på rundens offentlige side som «Rettet i etterkant».
        </p>
      </Seksjon>

      <Seksjon tittel="Spillerregister">
        <p>
          Hver serie har sitt eget spillerregister - samme person må legges til på nytt i
          hver serie den deltar i. To spillere i samme serie kan ikke ha identisk navn.
        </p>
      </Seksjon>
    </div>
  );
}
