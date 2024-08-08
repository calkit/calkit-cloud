#! /usr/bin/env bash
set -e
set -x

python /app/scripts/backend-pre-start.py

bash ./scripts/test.sh "$@"
