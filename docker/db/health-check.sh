#!/bin/bash
pg_isready -h db -U $POSTGRES_USER
