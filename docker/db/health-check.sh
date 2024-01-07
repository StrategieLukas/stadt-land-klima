#!/bin/bash
# -h db sets the host to connect to to the hostname of this container (instead of localhost)
# so that a non-loopback interface is used because only then the health check really indicates a full startup
# see https://github.com/docker-library/postgres/issues/146#issuecomment-561557320
pg_isready -h db -U $POSTGRES_USER
