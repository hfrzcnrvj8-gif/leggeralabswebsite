# Obraz panelu Leggera Hub do uruchomienia na własnym serwerze (Moduł 55).
#
# Buduj dla ARCHITEKTURY NAS-a. Ugreen DXP4800 Plus ma procesor Intela, więc
# `linux/amd64` — a Mac właściciela jest na Apple Silicon (arm64). Obraz
# zbudowany „normalnie" na Macu NIE URUCHOMI SIĘ na NAS-ie: kontener wstanie
# i padnie na pierwszej natywnej bibliotece (@napi-rs/canvas), z komunikatem
# o niezgodnym formacie pliku, który nie mówi wprost, że chodzi o architekturę.
# Instrukcja w `docker/README.md` podaje właściwe polecenie.

# ---------- 1. Zależności ----------
FROM node:22-slim AS zaleznosci
WORKDIR /app
COPY package.json package-lock.json ./
# `--ignore-scripts` NIE: @napi-rs/canvas dociąga w skrypcie instalacyjnym
# swoją natywną binarkę pod bieżącą platformę.
RUN npm ci

# ---------- 2. Build ----------
FROM node:22-slim AS build
WORKDIR /app
COPY --from=zaleznosci /app/node_modules ./node_modules
COPY . .
# Paczka samowystarczalna — patrz komentarz przy `output` w next.config.mjs.
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- 3. Obraz docelowy ----------
FROM node:22-slim AS uruchomienie
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Nie root. Panel jest wystawiony przez tunel na świat, więc proces ma mieć
# tyle uprawnień, ile potrzebuje, i ani jednego więcej.
RUN groupadd --system --gid 1001 hub && useradd --system --uid 1001 --gid hub hub

COPY --from=build --chown=hub:hub /app/.next/standalone ./
COPY --from=build --chown=hub:hub /app/.next/static ./.next/static
COPY --from=build --chown=hub:hub /app/public ./public

# Katalog na pliki klientów (krok 5 briefu Modułu 54). W wariancie „wszystko
# w domu" to zwykły katalog obok bazy — bez tunelu, bez nowego punktu awarii.
# Montowany z hosta przez compose, tu tylko punkt zaczepienia.
RUN mkdir -p /dane/pliki && chown -R hub:hub /dane

USER hub
EXPOSE 3000

# Bez powłoki (`exec` form) — sygnał zatrzymania trafia do Node'a, a nie do
# `sh`, które by go połknęło i kontener ginąłby dopiero po limicie czasu.
CMD ["node", "server.js"]
