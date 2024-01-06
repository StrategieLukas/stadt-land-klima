# staedtechallenge

## Wichtige Dokumente
Google Docs mit Anforderung:
https://docs.google.com/document/d/1DSB9_bnTnlP7F6aUafDhUoNF9RX_G6uRDzuabH1Kz-k/edit?usp=sharingA

User Storys in Tabellen Form:
https://docs.google.com/document/d/10lof-yafsWQPbTtwueUrU8zVRYer35pNpyIi0zETYZo/edit

Maßnahmenkatalog mit Bewertung:
https://docs.google.com/spreadsheets/d/1NArv2lk6YDHgT8YhwcyCa_55C0TaTbrFnAlss8-Mju4/edit#gid=97166246

Pad von Sitzung am 03.08.2023:
https://pad.fridaysforfuture.is/p/1MTNMaPYsqpM-p2Doo9r

Adobe Click Dummy: (nicht aktuell)
https://xd.adobe.com/view/78b90913-6242-496d-98f2-6363e15715db-2dea/

Figma Click Dummy Desktop 1280:
https://www.figma.com/file/hfLAnnvP4Qj2h9ALUtPUMl/Klima2035-Desktop?type=design&node-id=1%3A2001&mode=design&t=HKdvCQFJntTMq0EZ-1

Figma Click Dummy Mobile:
https://www.figma.com/file/xOUA8jmhBBreYvmZRdlFSn/Klima2035-mobile?type=design&node-id=3%3A2&mode=design&t=sY2zf5p8UTfrLm1e-1


## Preparations

Copy example env-files and adjust to your needs
```
cp docker/db/.env.example docker/db/.env
cp src/directus/.env.example src/directus/.env
cp src/frontend/.env.example src/frontend/.env
```

## Start in development

```
$ cd bin
$ ./start_development.sh
```

Directus will run on port 8081 and the frontend on port 8080

Now open `http://localhost:8081` in your browser and login with the credentials provided in the .env file.
To see the frontend open `http://localhost:8080`.

## Start in production

```
$ cd bin
$ ./start_production.sh
```

Directus will run on port 9001 and the frontend on port 9000.

## Stop

```
$ cd bin
$ ./stop.sh
```

## Update on production

Update to latest commit in current branch.

```
$ cd bin
$ ./update_production.sh
```

## Directus CLI

With the custom directus-cli you can import and export configuration.

To get a list of supported commands do:

```
$ cd bin
$ ./directus_bash.sh
```

then within the directus container:

```
$ ./directus-cli --help
```
