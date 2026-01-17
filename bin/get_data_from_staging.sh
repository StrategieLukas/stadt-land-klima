#!/bin/bash

# get data from staging server
ssh root@staging.stadt-land-klima.de 'cd /home/deploy/staedtechallenge/bin && ./db_export.sh' > staging_dump.sql

# import db
./import_db.sh < staging_dump.sql

# get new frontend token from directus admin for frontend user

# set it in src/frontend/.env as DIRECTUS_TOKEN