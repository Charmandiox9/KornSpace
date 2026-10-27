#!/bin/sh
set -eu

pnpm --filter kornspace-backend prisma:migrate:deploy
exec "$@"
