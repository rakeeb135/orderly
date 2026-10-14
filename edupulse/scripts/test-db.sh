#!/usr/bin/env bash
# Validates supabase/migrations on a LOCAL throwaway PostgreSQL (not Supabase) and runs RLS tests.
# Usage: PGHOST=localhost PGPORT=5432 PGUSER=postgres ./scripts/test-db.sh
# Requires psql and a reachable PostgreSQL 15+ server. Creates/drops the database "edupulse_test".
set -euo pipefail
cd "$(dirname "$0")/../supabase"
psql -q -d postgres -c 'drop database if exists edupulse_test' -c 'create database edupulse_test'
for f in tests/00_local_supabase_stub.sql migrations/001_initial_schema.sql migrations/002_rls_policies.sql migrations/003_seed_data.sql tests/rls_tests.sql; do
  echo "== $f"; psql -q -d edupulse_test -v ON_ERROR_STOP=1 -f "$f" | grep -E "PASSED|ERROR" || true
done
