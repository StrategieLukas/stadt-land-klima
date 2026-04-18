# Klimawahl (Thesen-Check) — Dokumentation & User Guide

Dieses Dokument beschreibt den Prozess des "Klimawahl-Checks" (auch bekannt als Thesen-Check), mit dem Lokalteams Thesen für Kandidierende zur Kommunalwahl generieren und deren Antworten einholen können.

---

## 1. Prozess-Übersicht

Der Klimawahl-Check basiert auf der wissenschaftlichen Bewertung der Kommunen im Projekt *Stadt.Land.Klima*. Ziel ist es, die 10 Maßnahmen mit dem größten Verbesserungspotenzial in einer spezifischen Kommune als Thesen zu formulieren und diese den lokalen Kandidierenden zur Stellungnahme vorzulegen.

### Der Ablauf in 5 Schritten:
1.  **Bewertung prüfen:** Die Thesengeneration funktioniert nur wenn die Bewertung abgeschlossen ist.
2.  **Thesen generieren:** Das System ermittelt automatisch die Top 10 Maßnahmen.
3.  **Kandidierende anlegen:** Die Namen und E-Mail-Adressen der Kandidierenden werden hinterlegt.
4.  **Stichtag setzen:** Eine Frist für die Antworten wird festgelegt.
5.  **Einladungen versenden:** Kandidierende erhalten einen persönlichen Link per E-Mail.

---

## 2. Technische Details & Logik

### Priorisierung der Thesen
Um die 10 wichtigsten Thesen für eine Kommune zu finden, verwendet das System folgende Logik (identisch mit der Logik auf der Webseite):

1.  **Potential (Primär):** `Potential = (1 - Rating) * Gewichtung`
    *   Maßnahmen mit niedriger Bewertung und hoher Relevanz landen oben.
2.  **Schwierigkeit (Tie-breaker 1):** Bei gleichem Potential wird die Maßnahme mit der geringeren Schwierigkeit bevorzugt.
    *   `Schwierigkeit = (Politische Umsetzbarkeit + Ökonomische Umsetzbarkeit) / 2`
3.  **Maßnahmen-ID (Tie-breaker 2):** Bei absolutem Gleichstand wird alphabetisch nach der ID sortiert.

### Datenquellen
Die Texte für die Thesen stammen aus der Vorlage `measure_questions_template`. Jede Maßnahme hat dort einen spezifischen Titel und eine prägnante These.

---

## 3. User Guide (für Lokalteam-Admins im Directus)

### Schritt 1: Thesen generieren
1.  Navigiere in Directus zum Modul **Lokalteams**.
2.  Wähle dein Lokalteam aus (oder klicke in der Listenansicht auf das Lokalteam).
3.  Klicke oben rechts auf das "Flow"-Icon (Blitz) und wähle **generateQuestions**.
    *   *Ergebnis:* Es werden 10 Einträge in der Kollektion `questions` für dein Team erstellt. Du kannst diese unter "Thesen" einsehen und ggf. statusmäßig anpassen.

### Schritt 2: Kandidierende erfassen
1.  Gehe zur Kollektion **Kandidierende** (`candidate`).
2.  Erstelle für jeden Kandidaten einen neuen Eintrag.
3.  **Wichtig:** Weise den Kandidaten deinem **Lokalteam** zu und hinterlege eine gültige **E-Mail-Adresse**.

### Schritt 3: Stichtag festlegen
1.  Wähle dein Lokalteam aus.
2.  Starte den Flow **setCutoffDate**.
3.  Gib im Pop-up das Datum und die Uhrzeit an, bis zu der die Kandidierenden antworten dürfen.
    *   *Hinweis:* Nach diesem Datum ist der Link für Kandidierende nur noch im Lesemodus verfügbar.

### Schritt 4: E-Mails versenden
1.  Wähle dein Lokalteam aus.
2.  Starte den Flow **sendCandidateEmails**.
    *   *Sicherheitscheck:* Der Flow prüft automatisch, ob ein Stichtag gesetzt wurde, mindestens 10 Thesen generiert wurden und mindestens 3 Kandidaten existieren.
    *   *Ergebnis:* Jeder Kandidat erhält eine personalisierte E-Mail mit einem sicheren Link zum Fragebogen.

---

## 4. Die Perspektive der Kandidierenden

Kandidierende erhalten einen Link im Format:
`https://stadt-land-klima.de/thesen/[Lokalteam-ID]/[Token]`

Auf dieser Seite können sie:
*   Jede der 10 Thesen auf einer 5-stufigen Skala bewerten (*Stark dagegen* bis *Stark dafür*).
*   Optional eine kurze Begründung (max. 500 Zeichen) pro These abgeben.
*   Ihre Antworten bis zum Stichtag jederzeit über denselben Link korrigieren.

Sobald ein Kandidat "Bestätigen" klickt, werden die Zeitstempel `time_first_submitted` und `time_last_edited` gesetzt.

---

## 5. Anzeige auf der Webseite

Die Ergebnisse werden auf der öffentlichen Seite der jeweiligen Kommune unter dem Pfad `/elections/[slug]` (bzw. `/kommunalwahl/[slug]`) angezeigt.

Dort können Wähler:innen:
*   Die 10 Thesen der Kommune einsehen.
*   Die Positionen der verschiedenen Kandidierenden vergleichen.
*   Die Begründungen der Kandidierenden lesen.
