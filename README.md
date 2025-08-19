# Stadt.Land.Klima!

## Wichtige Dokumente

Designs (Figma): https://www.figma.com/design/xOUA8jmhBBreYvmZRdlFSn/Stadt.Land.Klima!


## Preparations
0. On Windows install Ubunut on Virtual Machine:
1. Install Docker for your machine (https://docs.docker.com/engine/install/, https://docs.docker.com/desktop/)
2. Clone this repo into your desired folder
3. Copy example env-files and adjust to your needs:
```
cd stadt-land-klima/
cp docker/db/.env.example docker/db/.env
cp src/directus/.env.example src/directus/.env
cp src/frontend/.env.example src/frontend/.env
```
Setting "CACHE_ENABLED=false" for development is recommended to quickly see changes made to data in the backend.

## Installation:
Docker needs to be running
Give Permission to folder to write files and also subfolder: This is not optimal!
```
$ cd stadt-land-klima/
$ cd bin
$ ./start_development.sh
```
This may take some time.
When finished and started check http://localhost:8081 if directus started correctly.
In a new Terminal run :
```
$ cd stadt-land-klima/
$ cd bin
$ ./directus_bash.sh
$ ./directus-cli auth:set-token
$ source .env
$ cli/import-all.sh
$ cli/import-all.sh
$ ./directus-cli auth:set-frontend-token
```
Import all needs to run tiwce otherwise permission for the roles don't get apllied.
Now open http://localhost:8081 in your browser and login with the credentials provided in the .env file.
To see the frontend open http://localhost:8080.
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

For the cli tool to access directus it needs a static token for authentication.
Create one via the directus web interface or use the following command:

```
$ ./directus-cli auth:set-token
```

This will create a token in directus and save it to the .env file.
You might have to reload the .env file in the containers shell. (e.g. with `source .env`)

### My local Directus instance is empty

If your local Directus has no schemas/roles/objects, then you need to use the Directus-CLI tool to import them. This effectively reads the .yaml-files from the code and puts them into the running directus instance.
To import all roles, you can use (more infos using the `--help` flag):
```
$ ./directus-cli import:roles
```

### I changed things locally in Directus, but I have no changes to commit?

If you created changes through the Directus-UI, they need to be exported first using the Directus-CLI tool. This effectively saves the configuration state of your local running directus instance as .yaml files.
The following command will export any changes made to the database schema:

```
$ ./directus-cli export:schema [dest]
```

The Directus-CLI has a `--help` flag to show all available exports and imports.

# Deployment Notes

- robots.txt must be added manually for each environment to in src/frontend/public/robots.txt
- Must do ./cli/import-all for directus changes to apply. Must do this TWICE for permissions to work as well.
- If there's a docker permission issue, chmod 777 everything :(
- Always back up the DB beforehand, obviously
