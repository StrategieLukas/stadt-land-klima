# Blökkli: Inhaltszuordnung und sichere Veröffentlichung

## Analysierte Fehlerursachen

### Inhalte wurden über den Slug verknüpft

`blocks.entity_uuid` und `edit_states.entity_uuid` enthielten bisher den Slug
einer Seite oder Neuigkeit. Ein Slug ist jedoch veränderbar und kann nach dem
Löschen eines Eintrags erneut vergeben werden. Dadurch konnten verwaiste Blöcke
eines älteren Eintrags unter einem neu angelegten Eintrag mit demselben Slug
erscheinen. Eine Umbenennung änderte die Zuordnung erneut und ließ den Effekt
verschwinden.

Blöcke und Bearbeitungszustände werden nun ausschließlich über die
unveränderliche UUID aus `pages.id` beziehungsweise `news_items.id` zugeordnet.
Slugs dienen nur noch dem Routing.

Die Migration `20260813A-use-stable-blokkli-entity-ids.js` löst bestehende,
eindeutige Slug-Zuordnungen zu UUIDs auf. Blöcke, deren protokollierte Erstellung
vor der Erstellung des aktuell gleichnamigen Eintrags liegt, werden bewusst
nicht zugeordnet: Sie gehören nachweislich zu einem gelöschten oder ersetzten
Eintrag. Auch bei doppeldeutigen Seiten-Slugs bleibt die alte Zuordnung zur
manuellen Prüfung erhalten. So wird kein Altinhalt unbemerkt auf einen neuen
Eintrag übertragen.

Nach der Migration zeigt folgende Abfrage noch zu prüfende Altzuordnungen:

```sql
SELECT id, entity_type, entity_uuid, field_name, bundle, status
FROM blocks
WHERE entity_type IN ('pages', 'news_items')
  AND entity_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ORDER BY entity_type, entity_uuid, sort_order;
```

### Der Publish-Vorgang konnte Teilstände hinterlassen

Der alte Frontend-Adapter löschte entfernte Blöcke zuerst und führte danach für
jeden Block einen eigenen Create- oder Update-Request aus. Jeder Fehler wurde
nur in der Browserkonsole protokolliert. Anschließend setzte der Adapter seinen
Änderungszustand zurück und meldete unabhängig vom Ergebnis Erfolg. Ein Timeout,
ein abgelaufenes Token oder ein einzelner Validierungsfehler konnte deshalb
bereits gelöschte Inhalte, nur teilweise aktualisierte Daten und einen verlorenen
lokalen Bearbeitungsstand hinterlassen.

Der Endpoint `blokkli-persistence` validiert jetzt den gesamten Stand und führt
alle Änderungen in einer PostgreSQL-Transaktion aus. Entfernte Blöcke werden
reversibel archiviert. Schlägt eine Operation fehl, wird die vollständige
Transaktion zurückgerollt und Blökkli behält den Entwurf. Eine Revisionsprüfung
verhindert außerdem, dass eine zwischenzeitlich von einer anderen Sitzung
veröffentlichte Seite überschrieben wird.

Nur Benutzer:innen mit der Directus-Policy `Blokkli-Editor` sowie
Administrator:innen dürfen den Publish-Endpoint verwenden. Der statische
Frontend-Token besitzt nur noch Leserechte auf `blocks` und keinerlei Zugriff
auf `edit_states`. Zuvor enthielt die öffentlich ausgelieferte Policy vollständige
Schreibrechte auf beide Collections.

### Längere Bearbeitungen hatten keine Wiederherstellung

Der bisherige `edit_states`-Datensatz war lediglich eine Sperre. Die eigentlichen
Blöcke und die Mutationshistorie blieben bis zum Publish ausschließlich im
Arbeitsspeicher des Tabs.

Nach jeder Änderung wird nun verzögert ein vollständiger Entwurf in
`edit_states.draft_blocks` gespeichert. Zusätzlich liegt eine gleichartige
Sicherung im `localStorage` des Browsers, falls Directus kurzzeitig nicht
erreichbar ist. Beim erneuten Öffnen wird der neuere passende Entwurf geladen.
Die gespeicherte Ausgangsrevision bleibt erhalten, sodass eine Wiederherstellung
keine neueren Veröffentlichungen überschreiben kann. Erst nach einer vollständig
erfolgreichen Veröffentlichung werden beide Sicherungen entfernt.

### Nach dem Publish blieb die Anzeige veraltet

Der Adapter aktualisierte nur den Cache-Key `blocks-<slug>`. Die News-Seite
verwendete jedoch `blocks-news-<slug>`. Außerdem konnte ein sofortiger erneuter
Directus-Request bei aktiviertem Redis-Cache den alten Stand zurückgeben.

Alle drei Blökkli-Seitentypen verwenden nun denselben, UUID-basierten Key. Nach
dem Commit wird die kanonische Antwort der Transaktion direkt in den passenden
Nuxt-Datensatz geschrieben. Für andere Requests muss in Produktion außerdem
`CACHE_AUTO_PURGE=true` gesetzt sein; Docker Compose erzwingt diese Einstellung
jetzt zusätzlich zur aktualisierten Beispielkonfiguration.

Der Suchindex löst die UUID nach einem erfolgreichen Commit wieder zum aktuellen
Slug und Seitentitel auf. Seine Block-Dokument-IDs verwenden nun das von
Meilisearch erlaubte Format `block_<uuid>`. Der alte Doppelpunkt in `block:<uuid>`
führte dazu, dass Meilisearch die Aktualisierungsaufträge ablehnte.

## Deployment

Die Migration darf wegen der bestehenden Blockdaten nicht ausgelassen werden.
Der vorgesehene Produktionsablauf erstellt zuerst eine Datenbanksicherung,
importiert Schema, Policies und Übersetzungen und führt danach alle Migrationen
aus:

```bash
./bin/run_directus_migrations.sh production
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --force-recreate directus
```

Vor dem Neustart muss die neue Extension gebaut beziehungsweise das eingecheckte
`dist/` ausgeliefert sein. Nach einer Änderung der Compose-Konfiguration ist der
Directus-Container neu zu erstellen, damit `CACHE_AUTO_PURGE=true` übernommen
wird.

## Geprüfte Fehlerszenarien

- atomare Erstellung und Entfernung eines Blockstands,
- Ablehnung einer Veröffentlichung mit veralteter Ausgangsrevision (`409`),
- vollständiger Rollback, wenn ein später Block im Publish-Payload ungültig ist,
- unveränderter veröffentlichter Inhalt nach dem provozierten Fehler,
- Schreibschutz des Endpoints für den statischen Frontend-Token,
- Anlage und Entfernung eines Block-Suchtreffers mit korrekter Slug-URL,
- Produktionsbuild der Directus-Extension und des Nuxt-Frontends,
- HTTP-Aufrufe der betroffenen Seiten über `localhost:8080`.
