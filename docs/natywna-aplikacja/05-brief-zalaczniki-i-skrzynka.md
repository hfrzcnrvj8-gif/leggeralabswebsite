# Brief: załączniki + trzy usprawnienia skrzynki

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`.
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> **To jest moduł dotykający OBU repozytoriów** — większość pracy jest po
> stronie panelu, nie apki.

**Skąd to się wzięło.** Właściciel po dniu używania apki na telefonie
(2026-07-19) zamówił trzy usprawnienia skrzynki i dołożył warunek:

> „ważne dla mnie aby ogólnie nieważne czy desktop czy mobile to żeby można
> było obsługiwać załączniki"

Załączniki są tu **kotwicą** — reszta to drobiazgi przy nich.

---

## Część A: Załączniki przychodzące (największy kawałek)

### Stan zastany — sprawdzony gretem, nie z pamięci

- Panel **umie wysyłać** załączniki (`app/api/mail/compose/route.ts`).
- Panel **w ogóle nie odbiera** załączników: brak tabeli, brak kodu
  w `lib/mailSync.ts`, brak w odpowiedzi `GET /api/mail/[id]`.
- **`mailparser` jest już w zależnościach** i jego `simpleParser` zwraca
  załączniki razem z treścią. Czyli parsowanie jest za darmo — panel po prostu
  **wyrzuca je do kosza** przy zapisie.
- **W projekcie NIE MA żadnego magazynu plików.** Jedyny istniejący załącznik
  (zdjęcie paragonu) leży jako **base64 w kolumnie TEXT**
  (`costs.zalacznik_dane`).

### Decyzja, którą trzeba podjąć ZANIM powstanie kod

**Gdzie trzymać treść załączników.** To jest pytanie do właściciela, bo ma
konsekwencje kosztowe, nie tylko techniczne:

1. **Base64 w Postgresie** (jak paragony). Za: zero nowych usług, wzorzec już
   w projekcie. Przeciw: Neon liczy sobie za rozmiar bazy, a skrzynka z PDF-ami
   faktur puchnie szybko i **nieodwracalnie** — kasowanie maila z panelu nie
   kasuje go ze skrzynki IMAP, więc sync może go przynieść ponownie.
2. **Magazyn plików** (Vercel Blob / S3). Za: baza zostaje mała, pobieranie nie
   przechodzi przez funkcję serverless. Przeciw: nowa usługa, nowy koszt, nowy
   sekret w env.
3. **Pobieranie na żądanie z IMAP** — nie przechowujemy nic, a przy kliknięciu
   panel łączy się z serwerem pocztowym i ściąga konkretny załącznik. Za: zero
   miejsca, zero duplikacji. Przeciw: wolne (kilka sekund), wymaga żywego IMAP,
   nie zadziała dla maila skasowanego ze skrzynki.

**Rekomendacja: 3 z metadanymi w bazie.** Zapisujemy przy syncu tylko *listę*
załączników (nazwa, typ, rozmiar, identyfikator części MIME) — dzięki temu
lista widoczna jest natychmiast i za darmo, a treść ściągamy dopiero, gdy
właściciel stuknie w konkretny plik. Baza nie puchnie, a 99 % załączników nigdy
nie zostanie otwartych. **Zapytaj właściciela**, zanim to przesądzisz — jeśli
zależy mu na dostępie offline albo na tym, żeby załącznik przetrwał skasowanie
maila ze skrzynki, wygrywa opcja 2.

### Zakres

- `lib/mailSync.ts` — zapis metadanych załączników przy syncu (nowa tabela
  `mail_attachments`, migracja w `lib/db.ts` **z bramką**
  `schemaUpToDate`/`markSchemaApplied`, patrz `CLAUDE.md`).
- `GET /api/mail/[id]` — lista załączników w odpowiedzi.
- `GET /api/mail/[id]/attachment/[aid]` — pobranie treści (wg wybranej opcji).
- **Panel**: sekcja załączników na profilu wiadomości.
- **Apka**: lista załączników pod nagłówkiem + `QuickLook` do podglądu
  (PDF-y i zdjęcia iOS pokazuje natywnie, nie trzeba nic rysować).
- Ikonka spinacza na liście wiadomości, jak w Apple Mail.

### Na czym łatwo się przewrócić

1. **Załączniki inline vs prawdziwe.** Newslettery wkładają obrazki jako
   załączniki z `Content-ID` i odwołują się do nich z HTML-a. Te **NIE są**
   załącznikami dla użytkownika — pokazanie ich na liście plików zrobiłoby
   z każdego newslettera „mail z 14 załącznikami". Filtruj po `contentDisposition`
   i obecności `cid`.
2. **Limit rozmiaru.** Trasa serverless na Vercelu ma limit odpowiedzi;
   załącznik 30 MB przez nią nie przejdzie. Ustal górny próg i powiedz o nim
   wprost w UI, zamiast pokazywać wieczny spinner.
3. **Odkażanie dotyczy też nazw plików.** `faktura.pdf.exe` i nazwy ze znakami
   ścieżki (`../`) — nazwa idzie do nagłówka `Content-Disposition`.

---

## Część B: Wyciszenie wątku

Wątek przestaje wracać do „do odpowiedzi", ale **nie znika** — właściciel jest
w kopii i nie musi reagować.

- Kolumna na `mail_messages` albo na wątku (`thread_id`), plus wykluczenie
  w regule „do odpowiedzi" i w `GET /api/mail/nudge`.
- **Uwaga:** wyciszenie musi obejmować **przyszłe** wiadomości w wątku, nie
  tylko obecne — inaczej jutrzejsza odpowiedź wróci do kolejki i cała funkcja
  nic nie da. To znaczy: znacznik na `thread_id`, nie na pojedynczym mailu.
- Gest na liście + pozycja w menu „⋯".

## Część C: Ekran „Subskrypcje" — masowe wypisanie się

Największy zysk przy najmniejszym nakładzie: **dane już są**
(`mail_messages.list_unsubscribe_url`, zapisywane od Modułu 4).

- Nowa trasa: nadawcy masówki zgrupowani, z licznikiem wiadomości i linkiem
  wypisania. Coś w rodzaju `GET /api/mail/subscriptions`.
- Ekran w apce i w panelu: lista „nadawca — 47 wiadomości — [Wypisz się]".
- **Sortowanie po liczbie wiadomości malejąco** — sens tego ekranu polega na
  tym, żeby najpierw pozbyć się najgłośniejszych.
- Rozważ „Wypisz się i usuń wszystkie z tej listy" jako drugi przycisk. To jest
  realne sprzątanie; sam link wypisania zostawia 47 maili w skrzynce.

## Część D: Wysyłka odłożona („wyślij o 8:00")

Najdroższa z trójki, bo wymaga kolejki i crona po stronie panelu.

- Tabela kolejki + `POST /api/mail/schedule`, cron sprawdzający co kilka minut.
- **Cron na Vercelu ma minimalny interwał** — sprawdź plan, zanim obiecasz
  „co minutę". Zaokrąglaj deklarowany czas do tego, co realnie potrafisz.
- Musi dać się **anulować** przed wysyłką i musi być widać, że coś czeka
  w kolejce — niewidoczna kolejka to najgorszy rodzaj kolejki.
- Ostrzeżenia wysyłki działają jak dziś: **mail idzie pierwszy**, reszta
  degraduje do `warnings` i NIE wolno ponawiać.

---

## Świadomie ODŁOŻONE: funkcje AI w skrzynce

Właściciel (2026-07-19), pytany o inteligentne kategorie / podsumowania /
priorytetyzację, odpowiedział — i to jest **argument produktowy, nie techniczny**:

> „do tych funkcji AI to jeszcze będziemy wracać po audycie, bo trochę się to
> gryzie, że ja jako integrator lokalnych LLM sam nie korzystam w moim własnym
> produkcie, z którego korzystam — to słaba autoreklama"

Czyli: reguła projektu „zero AI w decydowaniu" **nie jest już oczywista**
i zostanie przemyślana na audycie. **Nie dokładaj AI do skrzynki w tym module**,
ale też nie powołuj się na tę regułę jako na rozstrzygniętą — jest otwarta.

Materiał do tamtej rozmowy: apka ma już lokalne AI w dwóch miejscach (szkic
odpowiedzi, odczyt paragonu), oba w kształcie „model proponuje, właściciel
zatwierdza". Pytanie na audyt brzmi więc nie „czy AI", tylko **„czy ten
kształt da się rozszerzyć bez oddawania decyzji modelowi"**.

---

## Jak pracować

- Panel: `npx tsc --noEmit -p tsconfig.json` po każdej paczce; migracje
  z bramką (`CLAUDE.md`); dane testowe w `ensureSeeded()`.
- Apka: `xcodegen generate` → `xcodebuild` → `simctl` → zrzut.
  **Na telefon:** `-allowProvisioningUpdates`, zespół jest już w `Signing.xcconfig`.
- **Zrzuty z telefonu właściciela są w tym projekcie skuteczniejsze niż
  weryfikacja w symulatorze.** Cztery ostatnie błędy przyszły stamtąd, żaden
  nie był widoczny w symulatorze. Przy sporach o wygląd **proś o wzorzec** —
  zrzut z Apple Mail rozstrzygnął w minutę to, czego trzy rundy opisu nie.

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md oraz
docs/natywna-aplikacja/05-brief-zalaczniki-i-skrzynka.md, potem zrób
ten moduł: załączniki przychodzące (panel + apka), wyciszenie wątku,
ekran „Subskrypcje" i wysyłkę odłożoną.
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.

Zacznij od zapytania mnie o sposób trzymania załączników (sekcja
„Decyzja, którą trzeba podjąć ZANIM powstanie kod") — to wybór
kosztowy, nie techniczny, i chcę go podjąć sam.
```
