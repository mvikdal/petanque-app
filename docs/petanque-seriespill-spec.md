# Spesifikasjon: Seriespill

Utvidelse av det eksisterende petanque-systemet (Next.js/Prisma/PostgreSQL/NextAuth/Vercel) med støtte for langtlevende seriespill, som et alternativ til sveitsisk turneringsformat.

## 1. Bakgrunn og formål

Klubben gjennomfører faste, ukentlige seriekvelder over en lang sesong (mange uker), i tillegg til enkeltstående sveitsiske turneringer. Seriespill skiller seg fra turnering på flere måter:

- **Varighet**: Går over en hel sesong, ikke én dag.
- **Flere parallelle serier**: F.eks. én serie mandag/onsdag, én annen tirsdag/torsdag. Antall serier og hvilke dager de går på skal være konfigurerbart, ikke hardkodet til to.
- **Frivillig, varierende oppmøte**: Ikke de samme deltakerne hver gang, men over tid stort sett samme personer. Løsningen må støtte å velge blant eksisterende spillere per oppmøte, samt legge til nye spillere som ikke finnes fra før.
- **Lagtrekning skjer utenfor systemet**: I motsetning til turneringsmodulen skal ikke seriespill-modulen foreslå eller styre laginndeling. Trekning gjøres manuelt av klubben.
- **Resultatregistrering er individbasert, ikke lagbasert**: Det som registreres i systemet er per spiller, ikke per lag.

## 2. Sentrale begreper

| Begrep | Betydning |
|---|---|
| **Serie** | En sesongvarig serie, f.eks. "Mandag/Onsdag-serien". Har egne innstillinger og egen sesong. |
| **Runde** | Én spillekveld/dag i en serie (f.eks. mandag 8. sept). Består av 3 kamper. |
| **Kamp** | Ett enkeltspill til 13 poeng, spilt med lag trukket utenfor systemet. Én runde = 3 kamper. |
| **Deltakelse** | En spillers oppmøte i én runde, med resultat fra alle 3 kampene. |
| **Spiller** | Medlem i klubbens spillerpool. Gjenbrukes på tvers av serier (og ideelt sett på tvers av turnerings- og seriemodulen). |

## 3. Datamodell (forslag)

### Serie
- `navn` (f.eks. "Mandag/Onsdag")
- `ukedager` (liste, f.eks. ["mandag", "onsdag"]) – kun til visning/planlegging, ikke låst logikk
- `sesongStart`, `sesongSlutt` (valgfritt sluttdato – serien kan være åpen)
- `poengGrense` – poeng en kamp spilles til (default 13, konfigurerbart per serie)
- `antallTellendeRunder` – hvor mange av de beste rundene som teller i sesongstatistikken (default 12). Settes ved opprettelse av serien, men kan justeres i ettertid av administrator. En endring gjelder fra det tidspunktet den gjøres – historiske sesongtabeller regnes på nytt med gjeldende verdi (ikke låst per runde).
- `status` (aktiv / avsluttet)

### Runde
- Tilhører én `Serie`
- `dato`
- `rundenummer` (fortløpende innenfor serien)
- `status` (åpen for registrering / fullført)
- Liste av `Deltakelse` (én per spiller som var med denne dagen)

### Deltakelse (per spiller, per runde)
- `spillerId`
- `rundeId`
- Resultat for kamp 1, 2 og 3, hver bestående av:
  - `poengforskjell` – signert heltall fra −13 til 13 (0 ikke gyldig). **Positivt tall = vant kampen, negativt tall = tapte kampen.** `seier` (0/1) avledes automatisk av fortegnet og trenger ikke registreres separat – dette hindrer at de to verdiene kan motsi hverandre.
- Beregnede felt (utledet, ikke lagret separat om ønskelig):
  - `sumSeire` = antall kamper med positiv poengforskjell, av de 3 kampene (0–3)
  - `sumPoengforskjell` = sum av (signert) poengforskjell over de 3 kampene – vil naturlig trekke fra ved tap og legge til ved seier

### Spiller
- `navn`
- Kan delta i én eller flere serier, uavhengig av hverandre
- Delt spillerregister på tvers av serier (vurder om dette også skal være samme register som brukes i turneringsmodulen – se pkt. 7)

## 4. Arbeidsflyt: registrering av en runde

1. Administrator oppretter en ny runde på en gitt serie (dato foreslås automatisk basert på forrige runde + ukedagsmønster, men kan endres).
2. Administrator velger hvilke spillere som deltar denne dagen:
   - Velger fra eksisterende spillerliste (avkrysning/søk)
   - Kan legge til ny spiller på stedet, som da også blir tilgjengelig for fremtidige runder og serier
3. Lagtrekning skjer utenfor systemet (papir/annen metode), ikke en del av løsningen.
4. Etter at alle 3 kampene er spilt, registrerer administrator **for hver deltakende spiller** poengforskjellen for kamp 1, 2 og 3 – ett signert tall per kamp (−13 til 13, 0 ikke gyldig). Positivt tall betyr seier, negativt betyr tap; dette vises tydelig i grensesnittet med en gang tallet fylles inn, men lagres kun som ett felt.
   
   Dette tilsvarer arket klubben i dag fører fortløpende og summerer manuelt til slutt – systemet skal erstatte det arket.
5. Runden lagres først når **alle** deltakende spillere har fullstendig registrering for alle 3 kamper (alt-eller-ingenting – ingen delvis lagring/kladd). Administrator fyller ut hele skjemaet og lagrer til slutt, tilsvarende at man i dag fullfører hele arket før man er ferdig for kvelden.

## 5. Rangering innad i en runde

For hver runde rangeres deltakerne seg imellom på:
1. Flest `sumSeire` (0–3)
2. Ved likt: best `sumPoengforskjell`

Dette gir en daglig "vinner" og en rangert liste for runden, som også vises i historikken.

## 6. Sesongstatistikk

For hver spiller, innenfor en serie, beregnes to parallelle sett med tall, vist side om side i sesongtabellen:

**A) Beste N runder (tellende, default N = 12)** – dette er grunnlaget for offisiell rangering:
1. Alle fullførte runder spilleren har deltatt i, sorteres etter rundescore (sumSeire, deretter sumPoengforskjell – se pkt. 5).
2. De N beste plukkes ut.
3. **Snitt seire** = gjennomsnittlig `sumSeire` over disse N rundene.
4. **Totalt poeng** = sum av `sumPoengforskjell` (signert – tap trekker fra, seire legger til) over disse N rundene.

**B) Alle spilte runder** – samme to nøkkeltall, men beregnet over **samtlige fullførte runder registrert i serien** som spilleren har deltatt i – altså både de N beste og de som faller utenfor. Vises som sammenligningsgrunnlag i tabellen, uten å påvirke rangeringen.

Spillere med færre enn N spilte runder får identiske tall i begge bolker (siden "beste N" da omfatter alle rundene deres).

**Avklart:** Siden poengforskjell nå er signert (positiv ved seier, negativ ved tap – se datamodell), vil "totalt poeng" naturlig reflektere både seiersmargin og tapsmargin uten behov for egen logikk rundt tapte kamper.

4. Det er **ikke** noe minstekrav til antall spilte runder – alle spillere med minst én fullført runde vises i sesongtabellen.
5. Sesongtabellen **rangeres på bolk A** (beste N runder): sortert på snitt seire, med totalt poeng som tiebreak. Bolk B vises kun til informasjon.

## 7. Grensesnitt mot eksisterende system

- **Spillerregister**: Holdes **separat** fra turneringsmodulen – egen `Spiller`-entitet for seriespill, ikke delt med turneringens spillerregister. Samme person kan altså måtte registreres i begge moduler uavhengig av hverandre.
- **Autentisering**: Gjenbruker eksisterende NextAuth-oppsett; kun administrator/organisator registrerer resultater.
- **Offentlig spectator-visning**: Som for turnering, bør det finnes en lesbar, innloggingsfri side som viser:
  - Aktiv sesongtabell per serie (snitt seire, totalt poeng, antall spilte runder)
  - Historikk over alle runder, med rundevinner og fullstendig resultatliste
  - Detaljvisning av én runde (alle spilleres 3 kamper)

## 8. Ting som bevisst IKKE er en del av denne modulen (foreløpig)

- Laginndeling/trekning – gjøres utenfor systemet
- Baneoppsett/kø – relevant for turnering, ikke identifisert som behov i seriespill foreløpig
- Sluttspill/cup – seriespill er løpende og har ingen definert sluttfase i dette forslaget

## 9. Beslutninger

| Spørsmål | Beslutning |
|---|---|
| Telles poengforskjell fra tapte kamper med i "totalt poeng"? | Ja – alle 3 kampers poengforskjell telles, uavhengig av seier/tap |
| Skal spillerregisteret deles med turneringsmodulen? | Nei – eget, separat spillerregister for seriespill |
| Skal en serie ha fast sesongslutt? | Valgfritt – en serie kan ha satt sluttdato, eller løpe åpent til den avsluttes manuelt |
| Kan en runde lagres delvis (kladd)? | Nei – alt-eller-ingenting, runden lagres først når alle 3 kamper er registrert for alle deltakere |
| Minstekrav til antall runder for å stå i sesongtabellen? | Nei – alle med minst én fullført runde vises |

Alle punktene som tidligere sto som åpne spørsmål er nå avklart og innarbeidet i spesifikasjonen over (seksjon 4, 6 og 7).

---

*Spesifikasjonen er nå avklart på de sentrale punktene. Neste steg er å ta den inn i Claude Code Desktop for implementasjon, i tråd med eksisterende arkitektur.*
