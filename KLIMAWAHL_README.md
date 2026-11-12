# Klimawahlcheck — Anleitung

Der Klimawahlcheck verbindet die kommunale Maßnahmenbewertung mit Thesen für
Kandidierende oder Parteien. Die konkrete Wahl wird in Directus unter `elections`
verwaltet; Thesen und Kandidierende gehören zu dieser Wahl.

## Wahl vorbereiten

1. Öffne die Wahl deines Lokalteams in Directus und prüfe die zugrunde liegende
   Maßnahmenbewertung und Katalogversion.
2. Nutze **Thesen generieren** in den Wahlaktionen. Die Generierung wählt bis zu
   zehn priorisierte Maßnahmen und verwendet `measure_questions_template` für die
   Thesentexte. Prüfe die Thesen redaktionell und veröffentliche die vorgesehenen
   Fragen.
3. Erfasse Kandidierende beziehungsweise Parteien mit gültiger E-Mail-Adresse und
   der passenden Wahlzuordnung. Bei Personen ist die Anrede erforderlich.
4. Setze das Antwortdatum `response_cutoff_date`. Die Frist endet um 23:59 Uhr des
   gewählten Kalendertages in Europe/Berlin.
5. Nutze **Review der Thesen anfragen**. Ein:e WahlcheckAdmin muss die Wahl
   freigeben, bevor die Versandaktionen in der Oberfläche angeboten werden.

Die Priorisierung berücksichtigt Verbesserungspotenzial, Umsetzbarkeit und die
stabile Maßnahmenkennung. Die Implementierung liegt in
`src/directus/extensions/election-check/src/generate-questions/api.ts`; die
Website nutzt die gepflegten Bewertungs-/Sortierhilfen. Änderungen an beiden
Darstellungen müssen die bestehenden fachlichen Unterschiede berücksichtigen.

## E-Mails versenden

Prüfe die HTML-Vorlage, den Betreff, Platzhalter, Antworten-Frist und Empfänger in
der Wahl. Kandidierende und Parteien werden in diesen Nachrichten mit **Sie**
angesprochen. Ein normaler Versand benötigt mindestens sieben veröffentlichte
Fragen und zwei Kandidierende sowie die konfigurierte Frist. Die Versandübersicht
unterscheidet gesendete, fehlgeschlagene und übersprungene Empfänger.

**Test-E-Mail senden** verwendet den festgelegten Testempfänger; prüfe diese
Konfiguration vor dem Versand. Erinnerungen richten sich an noch nicht
antwortende Personen/Parteien, Dankesnachrichten an diejenigen mit Antworten.
Bereits abgeschlossene Versandarten werden durch die bestehenden Wahlflags
begrenzt. Reale Zustellung und Darstellung in Mailprogrammen bleiben manuell zu
prüfen.

## Antworten und Veröffentlichung

Neue persönliche Links verwenden `/elections/thesen#token=<UUID>`. Der Browser
tauscht den Link gegen eine geschützte Sitzung und entfernt das Fragment.
Bestehende persönliche Links bleiben unterstützt. Kandidierende können ihre
Antworten bis zum Stichtag über denselben Zugang ändern. Die fünfstufige Antwort
wird als 0–4 gespeichert; eine Begründung darf höchstens 500 Zeichen enthalten.
Serverseitige Prüfungen binden Antworten an die Person, Wahl und veröffentlichten
Fragen. Persönliche Links gehören nicht in öffentliche Inhalte oder Protokolle.

Veröffentlichte Wahlen erscheinen unter `/elections/wahlcheck`; der öffentliche
Fragebogen liegt unter `/elections/wahlcheck/<municipalitySlug>`. Wähler:innen
beantworten die Thesen, können Fragen höher gewichten und vergleichen anschließend
die Ergebnisse. Der einbettbare Fragebogen nutzt
`/embed/wahlcheck/<municipalitySlug>` und die ausdrücklich zugelassenen Partner.

## Prüfung

Die gepflegte Ablaufbeschreibung ist
[Rating/Wahlcheck-Test](bin/test_suite/rating_wahlcheck_flow/TEST_DESCRIPTION.md),
ausgeführt durch `bin/test_suite/src/flows/ratingWahlcheckFlow.ts` im vollständigen
Testprofil. [FEATURES.md](FEATURES.md) nennt ergänzende Kandidaten-, Versand- und
Berechtigungstests samt manuellen Grenzen. Sicherheits- und Rollenentscheidungen
stehen in [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md).
