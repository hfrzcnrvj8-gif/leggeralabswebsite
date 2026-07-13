# Moduł 6 — Infrastruktura: połączenie panelu z lokalną Ollamą (fundament pod AI)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> To NIE jest samodzielna funkcja dla właściciela — to fundament (jedna wspólna
> "wtyczka" do modelu), z którego korzystają Moduł 7 (szkice mailowe) i Moduł 8
> (OCR paragonów). Zrób ten moduł jako pierwszy z całej trójki, w osobnym czacie.

## Kontekst decyzji (2026-07-14)

Właściciel rozważa lokalne AI (przez Ollamę) do wspomagania pracy w panelu —
**wyłącznie lokalne modele, żadnych chmurowych API** (OpenAI/Anthropic/etc.).
Ma **Mac Studio M2 Ultra 64GB, działający 24/7**. Istniejący, sprawny setup,
z którego korzystają już inne automatyzacje:
- Ollama za **własnym proxy na porcie 11435** (nie domyślny port Ollamy
  11434) — proxy to prawdopodobnie już istniejący punkt kontroli
  dostępu/logiki przed modelem. **Sprawdź na starcie tego modułu, czy to
  proxy już wymaga jakiegoś klucza/nagłówka autoryzacyjnego** — jeśli tak,
  ten sam mechanizm da się od razu wykorzystać zamiast dodawać drugi.
- **Tailscale** już skonfigurowany i używany do zdalnego dostępu do
  domu/biura, gdy właściciela tam nie ma.

**Problem techniczny do rozwiązania:** panel działa na Vercel (serverless, w
chmurze) + Neon (baza w chmurze) — Vercel NIE jest urządzeniem w sieci
Tailscale właściciela, więc zwykły adres tailnet (`100.x.x.x` albo
`maszyna.tailnet-nazwa.ts.net` w trybie prywatnym) jest dla Vercela
nieosiągalny — to działa tylko między urządzeniami, które same dołączyły do
tej samej sieci Tailscale. Potrzebny jest **publiczny, zwykły adres HTTPS**,
pod którym proxy (port 11435) będzie widoczne z internetu.

## DECYZJA: Tailscale Funnel (nie Cloudflare Tunnel — reużywamy istniejące)

Skoro Tailscale już działa na tym Macu, **Tailscale Funnel** jest prostszym
wyborem niż dokładanie osobnego Cloudflare Tunnel — jedna komenda
(`tailscale funnel --bg 11435`, dokładna składnia do zweryfikowania w
dokumentacji Tailscale przy budowie) włącza **publiczny** adres HTTPS typu
`https://<nazwa-maszyny>.<nazwa-tailnetu>.ts.net`, z automatycznym
certyfikatem TLS, wskazujący na proxy na porcie 11435 — bez dotykania
routera, bez nowego DNS, bez drugiej usługi w tle. Trzeba to jeszcze
włączyć w panelu admina Tailscale (ACL musi dopuszczać Funnel dla tego
węzła) — jednorazowa konfiguracja.

**Ważne rozróżnienie, żeby uniknąć zamieszania:** zwykły adres Tailscale
(prywatny, `100.x.x.x` albo tryb bez `--bg`/bez Funnel) **nie wystarczy** —
Vercel go nie zobaczy, bo nie jest w tej sieci. Dopiero **Funnel** robi z
niego coś, co wygląda jak zwykła, publicznie dostępna strona HTTPS. To
właśnie ten publiczny adres `*.ts.net` (nie prywatny adres tailnet) ma
trafić do `OLLAMA_API_URL` w env Vercela.

**Autoryzacja:** Funnel wystawia proxy publicznie — czyli każdy, kto pozna
adres, może spróbować go użyć, jeśli proxy samo nie sprawdza tożsamości.
Jeśli proxy na 11435 (patrz wyżej) już wymaga nagłówka/klucza dla
istniejących automatyzacji — używamy dokładnie tego samego mechanizmu z
Vercela. Jeśli nie wymaga — trzeba dodać prostą weryfikację nagłówka
`Authorization: Bearer <sekret>` przed przekazaniem do Ollamy, z tym samym
sekretem w env Vercela (`OLLAMA_API_SECRET`), zanim adres pójdzie na Funnel.

**Odporność na "Mac jest wyłączony/tunel padł":** panel MUSI działać dalej
bez AI, gdy model jest niedostępny — to zawsze dodatek, nigdy wymóg. Każde
wywołanie Ollamy przez `lib/ollama.ts` ma krótki timeout (np. 8–15s) i
`try/catch` — przy błędzie funkcja zwraca `null`/rzuca kontrolowany błąd,
UI pokazuje neutralny komunikat ("Model AI niedostępny — spróbuj później" /
po prostu chowa przycisk), NIGDY nie blokuje żadnej innej akcji w panelu.

## Stan faktyczny (co już jest w repo, do wykorzystania)

- `lib/email.ts` — wzorzec cienkiej, server-only warstwy do zewnętrznej
  usługi (Resend): czyta klucz z `process.env`, rzuca czytelny błąd gdy go
  brak. `lib/ollama.ts` ma być analogiczne.
- Wszystkie trasy API w repo już mają wzorzec `export const runtime = "nodejs"`
  i `if (!(await isAuthed())) return 401` na start — AI-endpointy trzymają
  się tego samego wzorca (admin-only, nikt z zewnątrz nie odpala modelu przez
  panel).
- `CLAUDE.md` / `docs/plany-modulow/README.md`: zasada "Zero AI" dotyczyła
  dotąd logiki przypominaczy/podpowiedzi (deterministyczne reguły) — to się
  NIE zmienia. Moduły 7/8 to punktowe, jawnie zainicjowane przez właściciela
  użycia modelu (klik "Zaproponuj szkic" / "Odczytaj paragon"), nie cichy
  mechanizm decydujący coś za niego. Ta granica ma zostać zachowana.

## Plan techniczny

### Krok 1 — Tailscale Funnel na Mac Studio (poza repo, konfiguracja właściciela)
- Sprawdź w panelu admina Tailscale (admin console), czy ACL tego węzła
  (Mac Studio) dopuszcza Funnel — jeśli nie, włącz.
- Uruchom Funnel wskazujący na proxy na porcie **11435** (NIE 11434 — to
  port gołej Ollamy, chcemy przez istniejące proxy, żeby zachować to, co ono
  już robi dla innych automatyzacji). Sprawdź, czy ma wstawać automatycznie
  po restarcie Maca (Tailscale zwykle sam startuje jako usługa systemowa —
  potwierdź, że Funnel też przetrwa restart, nie tylko `tailscale up`).
- Zanotuj wystawiony publiczny adres (`https://*.ts.net`) — to on trafia do
  `OLLAMA_API_URL` w env Vercela.
- Sprawdź (patrz wyżej), czy proxy na 11435 ma już jakąś autoryzację — jeśli
  nie, dodaj weryfikację nagłówka z sekretem PRZED włączeniem Funnel (inaczej
  model będzie przez chwilę publicznie dostępny bez klucza).

### Krok 2 — `lib/ollama.ts` (server-only klient)
```ts
export async function ollamaGenerate(opts: {
  model: string;          // np. "llama3.2:3b" — właściciel decyduje jaki model gdzie
  prompt: string;
  system?: string;
  timeoutMs?: number;     // domyślnie np. 12000
}): Promise<string | null>
```
- Czyta `OLLAMA_API_URL`/`OLLAMA_API_SECRET` z env, `fetch` do
  `${OLLAMA_API_URL}/api/generate` (albo `/api/chat`, do ustalenia wg
  potrzeb Modułu 7/8) z nagłówkiem `Authorization`.
- `AbortController` na timeout — nigdy nie wisi w nieskończoność (serverless
  function ma i tak twardy limit czasu).
- Przy błędzie/timeout: `console.error` + zwraca `null` (wołający decyduje co
  pokazać użytkownikowi), nigdy nie rzuca dalej niezłapanego wyjątku.

### Krok 3 — health-check + status w UI (opcjonalnie, ale tanie i przydatne)
- `GET /api/ai/health` (admin-only) — krótki ping do Ollamy, zwraca
  dostępność + listę modeli (`/api/tags` Ollamy). Pozwala np. w ustawieniach
  panelu pokazać "🟢 Model AI dostępny" / "🔴 Niedostępny", zamiast
  dowiadywać się dopiero przy klikaniu funkcji AI.

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Z Vercela (albo lokalnie z `.env.local` wskazującym na adres `*.ts.net`):
  wywołaj `ollamaGenerate` z prostym promptem, potwierdź że odpowiedź
  wraca. Wyłącz na chwilę Funnel/proxy/Ollamę → potwierdź, że wywołanie
  kontrolowanie zwraca `null`, nic się nie wywala.
- Spróbuj trafić w adres `*.ts.net` BEZ poprawnego nagłówka autoryzacji
  (np. zwykłym `curl` bez klucza) → musi dostać odmowę, nie odpowiedź
  modelu — to test, że publiczne wystawienie faktycznie jest zabezpieczone.

## Otwarte decyzje (zapytaj właściciela)
1. **Czy proxy na porcie 11435 już wymaga autoryzacji** dla istniejących
   automatyzacji — jeśli tak, jakiej dokładnie (nagłówek? inny mechanizm?),
   żeby Vercel mógł użyć tego samego zamiast dodawać drugi.
2. **Które modele** trzymać gotowe na Macu pod konkretne zadania (mały/szybki
   do prostych szkiców vs. większy do OCR/trudniejszych treści) — M2 Ultra
   64GB udźwignie sporo, ale to i tak decyzja właściciela, nie automat.
3. **Nazwa węzła w Tailscale** (wpływa na wystawiony adres `*.ts.net`) —
   właściciel poda po włączeniu Funnel.

## Definicja ukończenia
- `lib/ollama.ts` działa z Vercela do proxy Ollamy na Macu przez Tailscale
  Funnel, z autoryzacją (reużytą z istniejącego proxy albo dodaną).
- Brak dostępności modelu nigdy nie blokuje panelu — kontrolowany fallback.
- `tsc` czysty, zweryfikowane end-to-end (żywe wywołanie + symulacja awarii
  + próba dostępu bez autoryzacji), `HUB_SETUP.md` zaktualizowany o sekcję
  infrastruktury AI.
