-- Konto TYLKO-DO-ODCZYTU dla kopii zapasowych.
-- Uruchamiane przez zaloz-konto-ro.sh; hasło przychodzi jako zmienna psql
-- `haslo`, więc nie ma go w tym pliku i nie trafia do repozytorium.

-- Nazwę bazy odczytujemy z połączenia, zamiast zakładać "neondb" — u każdego
-- bywa inna, a zła nazwa to błąd wychodzący dopiero przy pierwszej kopii.
SELECT current_database() AS db \gset

-- Idempotentnie: przy drugim uruchomieniu (po literówce w haśle) tylko
-- ustawiamy hasło, zamiast wywalić się na "role already exists".
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kopia_ro') AS istnieje \gset

\if :istnieje
  ALTER ROLE kopia_ro WITH LOGIN PASSWORD :'haslo';
  \echo '>> Konto kopia_ro juz istnialo - zaktualizowano haslo.'
\else
  CREATE ROLE kopia_ro WITH LOGIN PASSWORD :'haslo';
  \echo '>> Konto kopia_ro utworzone.'
\endif

GRANT CONNECT ON DATABASE :"db" TO kopia_ro;
GRANT USAGE ON SCHEMA public TO kopia_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kopia_ro;

-- Żeby tabele dokładane przez kolejne moduły panelu też wchodziły do kopii.
-- Bez tego nowa tabela byłaby cicho pomijana, a kopia wygladalaby na pelna.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kopia_ro;

\echo ''
\echo '>> Kontrola - ile tabel widzi teraz kopia_ro:'
SELECT count(*) AS tabel_widocznych
FROM information_schema.table_privileges
WHERE grantee = 'kopia_ro' AND privilege_type = 'SELECT';
