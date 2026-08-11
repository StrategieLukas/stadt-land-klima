# Lokalteam gründen: Kommunenauswahl und Bewertungsstatus

## Zusammenfassung

Das Formular unter `/register_localteam` vermischte bisher nicht bewertbare
Verwaltungsebenen mit Kommunen und leitete den Lokalteam- beziehungsweise
Bewertungsstatus aus mehreren uneinheitlichen Quellen ab. Dadurch konnten unter
anderem Bundesländer und Regierungsbezirke in der Kommunenauswahl erscheinen,
vorhandene oder fehlende Lokalteams falsch erkannt und unveröffentlichte
Bewertungen als abgeschlossen angezeigt werden.

Die Statuslogik verwendet nun ausschließlich die als `isCurrentBackend: true`
markierte Version des Maßnahmenkatalogs. Eine Bewertung gilt genau dann als
abgeschlossen, wenn der zugehörige Datensatz in dieser Katalogversion
veröffentlicht ist.

## Ursachen des vorherigen Verhaltens

### Gemischte Verwaltungsebenen in der Suche

Das Formular verwendete den Suchmodus `normal`. Dieser Modus liefert sowohl
Verwaltungsebenen 1 bis 3 als auch bewertbare Kommunen. Deshalb wurden neben
Gemeinden und Städten beispielsweise Bundesländer und Regierungsbezirke
angezeigt.

### Katalogunabhängige Bewertungsermittlung

Der Bewertungsstatus wurde teilweise aus externen StadtLandZahl-Daten, globalen
Listen veröffentlichter Slugs oder dem höchsten beziehungsweise ersten
gefundenen Bewertungsfortschritt abgeleitet. Diese Daten mussten nicht zur
aktuellen Backend-Version des Maßnahmenkatalogs gehören.

### Prozentwert als Abschlusskriterium

Ein Bewertungsfortschritt ab 98 Prozent wurde als abgeschlossen behandelt. Das
Feld `published` wurde dabei nicht zuverlässig berücksichtigt. Somit konnte eine
unveröffentlichte Bewertung als fertig erscheinen, während eine veröffentlichte
Bewertung unterhalb des Grenzwerts weiterhin als in Arbeit galt.

### Slug als Ersatz für die Teamexistenz

Die Existenz eines Lokalteams wurde teilweise über einen vorhandenen Slug
abgeleitet. Das führte in beide Richtungen zu Fehlern:

- Ein Slug aus der URL oder aus externen Bewertungsdaten konnte ein nicht
  vorhandenes Lokalteam vortäuschen.
- Ein vorhandenes Lokalteam ohne Municipality-Slug konnte als nicht existent
  behandelt werden.

Insbesondere ein veralteter oder manipulierter `slug`-Query-Parameter konnte das
Gründungsformular fälschlich durch den Hinweis auf ein bestehendes Team ersetzen.

### Kein eigener Zustand für null Prozent

Ein vorhandenes Lokalteam mit fehlendem Bewertungsdatensatz oder null Prozent
Fortschritt wurde genauso dargestellt wie eine tatsächlich begonnene Bewertung.

## Neue fachliche Regeln

Die Seite lädt genau eine sichtbare Katalogversion mit
`isCurrentBackend: true`. Ist die Directus-Konfiguration nicht eindeutig, wird
ein Fehler ausgelöst, statt stillschweigend eine beliebige Version zu verwenden.

Der Formularstatus wird anschließend nach folgender Reihenfolge bestimmt:

| Voraussetzung | Status | Darstellung und Aktion |
|---|---|---|
| Kein `localteam_id` vorhanden | `none` | Gründungsformular beziehungsweise „Jetzt Lokalteam gründen“ |
| Lokalteam vorhanden und Bewertung der aktuellen Version veröffentlicht | `complete` | „Bewertung abgeschlossen“, Bewertungslink soweit ein Slug vorhanden ist, zusätzlich Kontaktmöglichkeit |
| Lokalteam vorhanden, aktuelle Bewertung unveröffentlicht und Fortschritt größer als 0 Prozent | `in-progress` | „Lokalteam aktiv – Bewertung läuft“ und Kontaktmöglichkeit |
| Lokalteam vorhanden, aktuelle Bewertung fehlt oder steht bei 0 Prozent | `not-started` | „Lokalteam aktiv – Bewertung noch nicht begonnen“ und Kontaktmöglichkeit |

`published: true` hat Vorrang vor dem Prozentwert. Damit gilt auch eine
veröffentlichte Bewertung mit einem ungewöhnlich niedrigen Prozentwert als
abgeschlossen. Umgekehrt bleibt eine unveröffentlichte Bewertung selbst bei 98
oder 100 Prozent in Arbeit.

Bewertungen älterer oder zukünftiger Katalogversionen beeinflussen keinen dieser
Zustände.

## Verhalten vorher und jetzt

| Fall | Vorher | Jetzt |
|---|---|---|
| Suche nach „Bayern“ | Bundesland und Regierungsbezirke konnten erscheinen | Keine nicht bewertbaren höheren Ebenen |
| Bewertbarer Stadtstaat | Konnte wegen seiner Verwaltungsebene uneindeutig sein | Bleibt enthalten, wenn `isReasonableForMunicipalRating: true` gesetzt ist |
| Kommune ohne Lokalteam | Externer oder übergebener Slug konnte ein Team vortäuschen | Gründungsformular wird angezeigt, solange Directus keinen `localteam_id` bestätigt |
| Lokalteam ohne Slug | Konnte als nicht vorhanden gelten | Wird über `localteam_id` erkannt; nur der Bewertungslink entfällt |
| Lokalteam ohne Bewertung der aktuellen Version | Beliebige andere Version konnte den Status beeinflussen | „Bewertung noch nicht begonnen“ |
| Aktuelle Bewertung bei 0 Prozent, unveröffentlicht | „Bewertung läuft“ | „Bewertung noch nicht begonnen“ |
| Aktuelle Bewertung über 0 Prozent, unveröffentlicht | In Arbeit; ab 98 Prozent teilweise abgeschlossen | Immer „Bewertung läuft“ |
| Aktuelle Bewertung veröffentlicht | Unter 98 Prozent teilweise noch in Arbeit | Immer „Bewertung abgeschlossen“ |
| Nur eine ältere Version ist veröffentlicht | Konnte als abgeschlossen erscheinen | Aktuelle Backend-Version bestimmt den Status |
| Veralteter oder manipulierter URL-Slug | Konnte ein bestehendes Team vortäuschen | Wird nicht als Identitätsnachweis verwendet |

## Kommunenauswahl

Das Formular verwendet nun den Suchmodus `reasonable`. Dieser beschränkt die
Ergebnisse auf administrative Gebiete, die für eine kommunale Bewertung
vorgesehen sind.

Stadtstaaten wie Berlin können weiterhin erscheinen, obwohl sie technisch eine
höhere Verwaltungsebene besitzen. Sie sind gleichzeitig bewertbare Kommunen und
werden von StadtLandZahl entsprechend mit
`isReasonableForMunicipalRating: true` gekennzeichnet.

## Erkennung eines bestehenden Lokalteams

Ein Lokalteam gilt nur als vorhanden, wenn ein passender Municipality-Datensatz
in Directus einen nicht leeren `localteam_id` besitzt.

Zur Zuordnung werden verwendet:

1. Slugs aus dem StadtLandZahl-Suchergebnis beziehungsweise aus der über die ARS
   geladenen StadtLandZahl-Antwort.
2. Die amtliche ARS als Fallback.

Ein über die Seiten-URL gelieferter Slug wird bewusst ignoriert. Damit können
veraltete Links und frei manipulierbare Query-Parameter keine fremde Kommune oder
kein fremdes Lokalteam zuordnen.

Die Slug-Zuordnung bleibt notwendig, weil ältere durch Directus-Flows erzeugte
Municipality-Datensätze teilweise keine ARS besitzen.

## Änderungen im Code

- `src/frontend/pages/register_localteam.vue`
  - verwendet `currentVersionBackend`;
  - verwendet die eingeschränkte Kommunensuche;
  - führt die vier expliziten Zustände `none`, `not-started`, `in-progress` und
    `complete` ein;
  - prüft die Teamexistenz über `localteam_id`;
  - ignoriert URL-Slugs als Identitätsnachweis;
  - liest ausschließlich den Score der aktuellen Backend-Katalogversion.
- `src/frontend/composables/useAreaSearch.js`
  - kann Team- und Bewertungsstatus für eine konkrete Directus-Katalogversion
    anreichern;
  - unterscheidet in Suchergebnissen zwischen nicht begonnen, in Arbeit,
    veröffentlicht und ohne Team.
- `src/frontend/components/AreaSearchResult.vue`
  - zeigt einen eigenen Chip für „Bewertung noch nicht begonnen“.
- `src/frontend/composables/getCatalogVersion.js`
  - stellt eine eindeutige Abfrage für die aktuelle Backend-Katalogversion bereit.
- `src/directus/translations/{de-DE,en-GB,it-IT}/`
  - enthält die neuen Texte in Deutsch, Englisch und Italienisch.
- `bin/test_suite/src/flows/registerLocalteamFlow.ts`
  - deckt die Kommunensuche, null Prozent, begonnene unveröffentlichte
    Bewertungen, veröffentlichte Bewertungen und manipulierte URL-Slugs ab.

## Verifikation

Folgende Prüfungen wurden erfolgreich durchgeführt:

- Directus-Übersetzungen über `import-all.sh` importiert;
- Register-Flow einschließlich Setup und Cleanup: 8 von 8 Schritten erfolgreich;
- Nuxt-Produktionsbuild erfolgreich;
- TypeScript-Prüfung erfolgreich;
- JavaScript-Syntax- und Git-Diff-Prüfungen erfolgreich;
- `/register_localteam` auf `localhost:8080` antwortet mit HTTP 200;
- `/api/area-search?term=Bayern&mode=reasonable` liefert keine nicht
  bewertbaren höheren Verwaltungsebenen.

Der vollständige Lauf von `bin/test_dev.sh` wurde mehrfach gestartet. Er blieb
in zwei Folgeläufen in einem unveränderten Wahlcheck-Browsertest hängen, bevor
die Register-Tests erreicht wurden. Dort wurde ein dynamisch erzeugtes
`question-…`-Eingabefeld nicht innerhalb von 30 Sekunden sichtbar. Derselbe
Wahlcheck-Schritt war im ersten Lauf erfolgreich. Die separat ausgeführten neuen
Register-Szenarien sind vollständig grün.
