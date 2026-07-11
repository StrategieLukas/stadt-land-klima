# Software-relevantes Feedback: Übersicht und Empfehlungen

Stand: 2026-07-04
Geprüfter Commit: `1df3b7b9` (`Feedback umsezen`)

Dieses Dokument filtert die gelieferten Feedback-Einträge auf Themen, die Änderungen an Software, Datenmodell, Importlogik, CMS-Konfiguration oder Frontend-UX nahelegen. Nicht aufgenommen wurden reine Kooperationsanfragen, offensichtliche Test-/Spam-Einträge und rein redaktionelle Rückfragen ohne Systembezug.

## Umsetzungsüberblick nach letztem Commit

| Feedback / Anfrage | Worum ging es? | Was wurde getan oder nicht getan? |
|---|---|---|
| Erweiterung der Aggregation von kommunalen Daten | Kommunale Wärmeplanung, direkte Quellenlinks und SDG-Indikatoren sollten als Bewertungsgrundlage geprüft bzw. ergänzt werden. | Nicht umgesetzt. Der Commit ergänzt keine Wärmeplan-, Quellen- oder SDG-Datenmodelle und keine Importlogik. Das bleibt eine fachliche Daten-/Lizenz- und Modellierungsaufgabe. |
| Unklares Bewertungsschema | Bewertungskriterien mit mehreren Beratungsformen waren als Fließtext schwer lesbar. | Teilweise umgesetzt. `StaticMeasureDetails` sanitisiert die Bewertungskriterien jetzt und erhält Zeilenumbrüche mit `whitespace-pre-line`. Eine strukturierte Erfassung einzelner Kriterienpunkte wurde nicht umgesetzt. |
| Feedback für Feedback | Nutzer:innen sollten auf Wunsch eine Kopie ihres abgeschickten Feedbacks per E-Mail erhalten. | Umgesetzt. Das Formular hat eine Checkbox, die Server-API speichert `send_copy`, Directus bekommt das Feld `feedback.send_copy`, und der Feedback-Mail-Flow sendet bei aktivierter Checkbox eine Kopie an die Absenderadresse. |
| Entwicklung der Abfallmenge | Es sollte geklärt werden, ob das SDG-Portal als Quelle für Abfallmengen akzeptiert werden kann. | Nicht umgesetzt. Es wurde keine kuratierte Quellenliste und keine Anzeige akzeptierter Quellen ergänzt. Das bleibt eine fachliche Quellen- und Lizenzentscheidung. |
| Fehler bei Filtern für Vorschau für Ranking 2026 | `/municipalities?v=v1.0` sollte beim Aktivieren von Gemeindetyp-Filtern nicht auf Beta-Daten zurückfallen. | Nicht umgesetzt. Laut Prüfung war der Fehler im aktuellen Code nicht mehr reproduzierbar, und der Commit ändert keine Ranking-/Municipality-Filterlogik. Ein Regressionstest fehlt weiterhin. |
| ÖPNV-Score intransparent | Scoreänderungen sollten nachvollziehbar sein; gewünscht waren Historie und Benachrichtigung bei Schwellenwechseln. | Nicht umgesetzt. Es wurde keine Score-Historie, keine Schwellenereignis-Logik und kein Benachrichtigungssystem ergänzt. |
| Inkonsistente Unterstützung von Markdown | „Infos zur Kommune“ sah im CMS nach Markdown aus, wurde im Frontend aber als Plain Text ausgegeben. | Umgesetzt. `DetailMunicipalityQuickInfoDesktop` rendert die Kommune-Beschreibung jetzt mit `markdown-it`, Linkify und Sanitizing. |
| Frage zu Treemap-Ansicht | In der Treemap war unklar, wofür Fläche und Farbe einer Maßnahme stehen. | Umgesetzt. Es gibt eine neue `MunicipalityTreemapLegend`, sie wird in der Kommune-Detailansicht für Mobile und Desktop angezeigt, und der Tooltip verwendet nun den übersetzten Gewichtungsbegriff. |
| Antwortformat des Fragekatalogs zur Wahl in Bayern | Manche Wahlcheck-Fragen passten nicht gut in das bestehende Antwortschema. | Teilweise adressiert, aber nicht als Antwortformat-Änderung. Der Commit ergänzt eine Begründungsanzeige für Kandidat:innenantworten und verbessert die Ergebnisdetails. Ein Antworttyp pro Frage oder ein neues Wahlcheck-Datenmodell wurde nicht umgesetzt. |
| Bewertung korrekt? | Feedback zu einer konkreten Bewertung sollte besser mit Kommune, Maßnahme, Katalogversion und aktuellem Stand verknüpft werden. | Nicht umgesetzt. Es wurde kein Review-Workflow und keine automatische Kontextübernahme für Bewertungsfeedback ergänzt. |
| Erlangen Eintrag | Die Lokalteam-Registrierung meldete „Eintrag schon vorhanden“, obwohl öffentlich kein Eintrag sichtbar war. | Teilweise umgesetzt. Die Fehlermeldung unterscheidet nun besser zwischen sichtbarem Lokalteam und noch nicht veröffentlichter Registrierung. Die Dublettenlogik selbst wurde nicht geändert. |

## Relevante Einträge

### 2025-12-07: Erweiterung der Aggregation von kommunalen Daten

**Softwarebezug:** Datenimport, Bewertungslogik, Quellenverwaltung, Frontend-Anzeige von Quellenlinks.

**Feedback-Kern:**
- Stand der kommunalen Wärmeplanung als Bewertungskriterium aufnehmen.
- Direkte Links zu Wärmeplänen anzeigen, wenn verfügbar.
- Geeignete SDG-Portal-Indikatoren als Bewertungsgrundlage prüfen.

**Empfohlene Systemänderungen:**
- Eine Datenquellen-Schicht für externe Indikatoren einführen oder erweitern: Quelle, Abrufdatum, Lizenz-/Nutzungsstatus, Kommune, Indikatorwert, Rohstatus, normalisierte Bewertung.
- Kommunale Wärmeplanung als eigenes maschinenlesbares Datenfeld pro Kommune modellieren, z. B. `not_started`, `in_progress`, `completed`, plus `source_url` und optional `heat_plan_url`.
- Direkte Quellenlinks in der Kommune-/Maßnahmenansicht anzeigen.
- Vor automatischer Bewertung erst klären, ob KWW/SDG-Daten stabil und rechtlich nutzbar automatisiert abrufbar sind.

**Beispiel-Prompt:**
```text
Analysiere im bestehenden Stadt-Land-Klima-Code, wie externe kommunale Daten importiert und in Bewertungen umgerechnet werden. Erstelle einen Vorschlag für eine code-first Directus-Erweiterung, um den Status der kommunalen Wärmeplanung inklusive Quellenlink und optionalem PDF-Link pro Kommune zu speichern und im Frontend anzuzeigen. Implementiere nur die Datenmodell- und Anzeigeänderung, keine automatische Bewertung.
```

### 2025-12-07: Unklares Bewertungsschema

**Softwarebezug:** Darstellung von Bewertungskriterien im Frontend oder CMS; strukturierte Textpflege.

**Feedback-Kern:** Bei einem Bewertungsschema sind mehrere Beratungsformen schwer unterscheidbar, weil Zeilenumbrüche bzw. Struktur fehlen.

**Empfohlene Systemänderungen:**
- Bewertungskriterien, die mehrere Optionen enthalten, als Listen darstellen statt als Fließtext.
- Prüfen, ob die betroffenen Directus-Felder Markdown/HTML erlauben und im Frontend gerendert werden.
- Langfristig: Bewertungsstufen strukturiert erfassen, z. B. einzelne Kriterienpunkte statt ein Textblock.

**Beispiel-Prompt:**
```text
Finde die Frontend-Komponente, die Bewertungsschema-Texte für Maßnahmen aus Directus darstellt. Prüfe, ob Zeilenumbrüche, Markdown-Listen oder HTML konsistent gerendert werden. Passe die Darstellung so an, dass mehrzeilige Bewertungskriterien lesbar bleiben, ohne unsichere HTML-Ausgabe einzuführen.
```

### 2025-12-09: Feedback für Feedback

**Softwarebezug:** Feedbackformular, E-Mail-Versand, Directus-Feedbackschema.

**Feedback-Kern:** Nutzer:innen können später nicht nachvollziehen, welches Feedback sie gesendet haben. Gewünscht ist eine Checkbox, um eine Kopie an die eigene E-Mailadresse zu erhalten.

**Empfohlene Systemänderungen:**
- Im Feedbackformular eine optionale Checkbox „Kopie an mich senden“ ergänzen.
- Nur anzeigen/aktivieren, wenn eine gültige E-Mailadresse im Kontaktfeld steht oder ein separates E-Mailfeld gepflegt wird.
- Server-seitig eine Bestätigungsmail mit Titel, Typ und Inhalt senden.
- Missbrauchsschutz beachten: Rate-Limit, keine beliebigen Empfängerlisten, keine HTML-Injektion.

**Beispiel-Prompt:**
```text
Erweitere das bestehende Feedbackformular um eine optionale Checkbox, mit der Nutzer:innen eine Kopie ihres Feedbacks per E-Mail erhalten können. Nutze vorhandene Übersetzungsdateien, Directus-/Server-Patterns und die bestehende Feedback-API. Validierung und Versand müssen serverseitig erfolgen.
```

### 2025-12-13: Entwicklung der Abfallmenge

**Softwarebezug:** Quellenverwaltung und Bewertungsnachweise.

**Feedback-Kern:** Frage, ob das SDG-Portal als Quelle für Abfallmengen akzeptiert werden kann.

**Empfohlene Systemänderungen:**
- Eine kuratierte Quellenliste pro Maßnahme/Kriterium im CMS pflegen.
- Im Frontend bei Maßnahmen anzeigen, welche Quellen akzeptiert oder empfohlen sind.
- Optional: Feedback- oder Review-Workflow, um neue Quellenvorschläge direkt an ein Maßnahmenteam weiterzuleiten.

**Beispiel-Prompt:**
```text
Untersuche, wie Quellenhinweise für Maßnahmen aktuell in Directus modelliert und im Frontend angezeigt werden. Entwirf eine kleine Erweiterung, mit der pro Maßnahme akzeptierte externe Quellen hinterlegt und auf der Detailseite sichtbar gemacht werden können.
```

### 2025-12-14: Fehler bei Filtern für Vorschau für Ranking 2026

**Softwarebezug:** Frontend-Bug in Ranking-/Municipalities-Ansicht, vermutlich Filterzustand und Katalogversion.

**Feedback-Kern:** `/municipalities?v=v1.0` zeigt zunächst korrekt die Ranking-2026-Vorschau. Nach Aktivierung der Filter „Großstädte“ oder „Städte & Gemeinden“ fällt die Ansicht zurück auf Beta-Phase-Daten.

**Empfohlene Systemänderungen:**
- Filterlogik muss die gewählte Katalogversion aus Query-State oder globalem State konsequent mitführen.
- Regressionstest für `v=v1.0` plus Gemeindetyp-Filter ergänzen.
- Prüfen, ob API-Calls, Computed Filters oder URL-Updates den Katalogparameter überschreiben.

**Beispiel-Prompt:**
```text
Reproduziere den Bug auf /municipalities?v=v1.0: Nach Auswahl von „Großstädte“ oder „Städte & Gemeinden“ darf die Ansicht nicht auf Beta-Daten zurückfallen. Finde die Filterlogik, behebe die Weitergabe der Katalogversion und verifiziere die Seite per curl gegen localhost:8080.
```

### 2025-12-14: ÖPNV-Score intransparent

**Softwarebezug:** Datenhistorie, Transparenz der Bewertung, Benachrichtigungen.

**Feedback-Kern:**
- Scoreänderung ist nicht nachvollziehbar.
- Wunsch nach historischen Daten.
- Wunsch nach Benachrichtigung, wenn eine Bewertungsschwelle über- oder unterschritten wird.

**Empfohlene Systemänderungen:**
- Score-Historie pro Kommune und Maßnahme speichern oder vorhandene Snapshots sichtbar machen.
- In der Detailansicht eine kurze Quellen-/Berechnungsbeschreibung und „zuletzt aktualisiert“ anzeigen.
- Benachrichtigungen als späteres Feature behandeln: erst stabile Historie und Schwellenereignisse modellieren, dann Opt-in anbieten.

**Beispiel-Prompt:**
```text
Analysiere, ob ÖPNV-Scores historisiert gespeichert werden. Falls ja, zeige in der Kommune-Detailansicht einen Verlauf und das letzte Aktualisierungsdatum. Falls nein, entwirf ein minimales Schema für Score-Snapshots und Schwellenereignisse, ohne sofort ein Benachrichtigungssystem zu bauen.
```

### 2025-12-14: Inkonsistente Unterstützung von Markdown

**Softwarebezug:** CMS-Felder und Frontend-Rendering.

**Feedback-Kern:** „Infos zur Kommune“ wirkt im Backoffice wie Markdown, wird im Frontend aber als einfacher Text gerendert. Andere Felder rendern Markdown bereits korrekt.

**Empfohlene Systemänderungen:**
- Feldinterface und Frontend-Rendering für „Infos zur Kommune“ angleichen.
- Entscheiden: Entweder Markdown wirklich rendern oder im CMS ein Plain-Text-Interface verwenden.
- Markdown-Sanitizing zentral nutzen, damit Rendering konsistent und sicher bleibt.

**Beispiel-Prompt:**
```text
Finde das Directus-Feld und die Frontend-Ausgabe für „Infos zur Kommune“. Vergleiche sie mit Feldern, bei denen Markdown bereits funktioniert. Sorge für konsistentes, sanitisiertes Markdown-Rendering oder stelle das CMS-Interface auf Plain Text um, wenn Markdown dort nicht unterstützt werden soll.
```

### 2025-12-14: Frage zu Treemap-Ansicht

**Softwarebezug:** Visualisierung, Legende, Gewichtungstransparenz.

**Feedback-Kern:** Unklar, wofür die Fläche einer Maßnahme in der Treemap steht. Es fehlt eine Legende.

**Empfohlene Systemänderungen:**
- Treemap mit Legende und kurzer Erklärung ergänzen: Fläche, Farbe und ggf. Gewichtung.
- Tooltip erweitern, damit Gewichtung, Score und Sektor sichtbar sind.
- Prüfen, ob die Gewichtung fachlich korrekt oder nur visuell missverständlich ist.

**Beispiel-Prompt:**
```text
Öffne die Treemap-Komponente der Kommune-Detailseite. Ergänze eine kompakte Legende und Tooltips, die erklären, was Flächengröße und Farbe bedeuten. Nutze Übersetzungsschlüssel für Deutsch, Englisch und Italienisch.
```

### 2026-01-04: Antwortformat des Fragekatalogs zur Wahl in Bayern

**Softwarebezug:** Wahlcheck-Datenmodell und Antwortoptionen.

**Feedback-Kern:** Einige Wahlcheck-Fragen passen nicht gut ins „Ja/Teilweise/Nein“-Format.

**Empfohlene Systemänderungen:**
- Wahlcheck-Fragen sollten optional eigene Antworttypen unterstützen: Zustimmungsskala, Ja/Teilweise/Nein, Mehrfachauswahl oder Freitext-Hinweis.
- Kurzfristig: Fragekatalog redaktionell an bestehendes Antwortformat anpassen.
- Mittelfristig: Antwortmodus pro Wahl oder pro Frage im CMS modellieren.

**Beispiel-Prompt:**
```text
Prüfe die aktuelle Wahlcheck-Antwortlogik. Entwirf eine kleine Erweiterung, mit der entweder eine Wahl oder einzelne Fragen zwischen einfachem Ja/Teilweise/Nein und differenzierter Zustimmungsskala wechseln können. Achte darauf, dass Auswertung und Vergleich weiterhin funktionieren.
```

### 2026-01-28: Bewertung korrekt?

**Softwarebezug:** Review-Workflow für Bewertungen und Hinweise.

**Feedback-Kern:** Nutzer:in hinterfragt eine konkrete Bewertung anhand des erklärenden Textes.

**Empfohlene Systemänderungen:**
- Im Backoffice Feedback besser mit Kommune, Maßnahme, Katalogversion und aktueller Bewertung verknüpfen.
- Optional eine „Bewertung prüfen“-Aktion oder Status im Feedback-Workflow ergänzen.
- Frontend könnte auf Bewertungsseiten gezielt „Feedback zu dieser Bewertung“ mit Kontextdaten vorausfüllen.

**Beispiel-Prompt:**
```text
Untersuche den bestehenden Feedback-Link für Bewertungen. Erweitere ihn so, dass Feedback automatisch Kommune, Maßnahme, Katalogversion und aktuelle Bewertung referenziert. Im Directus-Feedbackeintrag sollen diese Kontextdaten für Review sichtbar sein.
```

### 2026-05-24: Erlangen Eintrag

**Softwarebezug:** Registrierung, Dublettenprüfung, Fehlermeldung.

**Feedback-Kern:** Registrierung für Erlangen scheitert mit „Eintrag schon vorhanden“, obwohl Erlangen öffentlich nicht als Gemeinde eingetragen wirkt.

**Empfohlene Systemänderungen:**
- Dublettenprüfung in der Registrierung prüfen: Wird gegen Gemeinde, Lokalteam, Alias, nicht veröffentlichte Einträge oder alte Anfragen geprüft?
- Fehlermeldung differenzieren: „bereits registriert“, „Anfrage liegt vor“, „nicht sichtbar, weil noch in Prüfung“.
- Admin-Link oder interne Diagnose im Fehlerfall ergänzen.

**Beispiel-Prompt:**
```text
Reproduziere die Lokalteam-Registrierung für Erlangen. Finde die Dublettenprüfung im Server-Endpoint und in Directus. Behebe falsche Positive oder verbessere die Fehlermeldung so, dass Nutzer:innen verstehen, ob eine Anfrage bereits existiert oder ein sichtbares Lokalteam vorhanden ist.
```

## Ausgeschlossene Einträge

| Datum | Titel | Grund |
|---|---|---|
| 2026-05-24 | OrlJSXPvRMpNjXnDHsAJyGn | Offensichtlicher Spam/Testinhalt. |
| 2026-05-25 | Mitarbeit Lokalteam Siegburg | Kooperations-/Kontaktanfrage, kein Softwarethema. |
| 2026-06-24 | Test | Testeintrag ohne verwertbaren Inhalt. |
| 2026-06-26 | Kontaktanfrage | Allgemeine Kontaktanfrage, kein Softwarethema. |

## Empfohlene nächste Schritte

1. Directus-Schema und Flow aus dem Commit anwenden und prüfen, falls das noch nicht passiert ist: `feedback.send_copy` muss existieren und der Feedback-Flow muss die Kopie nur bei aktivierter Checkbox senden.
2. Ranking-Filter als Regression absichern, auch wenn der gemeldete Fehler aktuell nicht reproduzierbar war.
3. Für externe Quellen nicht direkt importieren, sondern zuerst ein Quellen-/Indikator-Konzept mit Lizenzprüfung und manueller Review-Möglichkeit erstellen.
4. Für Score-Transparenz zuerst Historie, Aktualisierungsdatum und Schwellenereignisse modellieren; Benachrichtigungen erst danach planen.
5. Für den Wahlcheck entscheiden, ob redaktionelle Anpassungen reichen oder ob Antworttypen pro Wahl bzw. pro Frage ins Datenmodell sollen.
6. Bewertungsfeedback und Lokalteam-Registrierung fachlich weiter schärfen: Kontextdaten für Reviews ergänzen und die Dublettenprüfung intern besser diagnostizierbar machen.
