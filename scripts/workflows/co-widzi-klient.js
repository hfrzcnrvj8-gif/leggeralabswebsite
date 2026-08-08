export const meta = {
  name: 'co-widzi-klient',
  description: 'Przegląd wszystkiego, co Leggera Labs pokazuje klientowi: strona publiczna, maile, wydruki, publiczne dokumenty',
  whenToUse: 'Przed wysłaniem pierwszych wiadomości do klientów',
  phases: [
    { title: 'Szukanie', detail: '12 obszarów równolegle — strona, maile, wydruki, dokumenty publiczne' },
    { title: 'Weryfikacja', detail: 'każde znalezisko sprawdzane adwersaryjnie' },
    { title: 'Synteza', detail: 'jedna lista, uporządkowana wg wagi' },
  ],
}

const KONTEKST = `
REPO: /Volumes/OWC_SN850X/projekty_ai/poltechnickx-website (Next.js, strona publiczna + panel /admin).

TWARDE FAKTY O FIRMIE — od nich zależy ocena każdego zdania:
- Firma NIE JEST jeszcze zarejestrowana (brak NIP, brak wpisu).
- ZERO klientów. ZERO wykonanych wdrożeń. ZERO referencji. ZERO case studies.
- Właściciel (Patryk Piecyk) dopiero zaczyna zdobywać pierwszych klientów.
- Kierunek: prywatne, LOKALNE modele LLM i automatyzacja dla MŚP w Polsce.
- Panel /admin jest zbudowany i działa, ale nigdy nie był użyty produkcyjnie.

CZEGO SZUKAMY — po kolei, to jest cała robota:
1. ZDANIA NIEPRAWDZIWE DZIŚ. Wszystko, co sugeruje doświadczenie, klientów,
   wdrożenia, zespół ("wdrażamy", "nasi klienci", "zrealizowaliśmy", "zespół",
   liczby rzekomo z produkcji), gdy prawda jest taka, że nie ma ani jednego
   klienta. To jest NAJWAŻNIEJSZA kategoria: pierwszy człowiek, który dostanie
   maila, wejdzie na stronę i zapyta o referencje.
2. OBIETNICE BEZ POKRYCIA. Konkretne liczby oszczędności, terminy, gwarancje,
   SLA — czy da się je poprzeć.
3. PLACEHOLDERY I RESZTKI. "Lorem", "TODO", "XXX", przykładowe nazwy firm,
   fikcyjne dane, adresy i telefony, które nie istnieją.
4. NIESPÓJNOŚĆ. Między PL/EN/DE, między stroną a dokumentami, między mailem
   a dokumentem, do którego mail prowadzi.
5. TON. Zdania puste, korpo-wata, przechwałki — u jednoosobowej firmy bez
   referencji brzmią gorzej niż skromny konkret.

ZASADY PRACY:
- CYTUJ dosłownie. Każde znalezisko musi mieć plik, linię i cytat.
- NIE zmieniaj żadnego pliku. Twoim wynikiem jest lista, nie poprawka.
- Nie zgłaszaj rzeczy, które są uczciwie sformułowane. Strona miejscami
  ŚWIADOMIE mówi "zanim przyjmiemy pierwszych partnerów" — to jest DOBRE
  i nie jest znaleziskiem.
- Jeśli obszar jest czysty, zwróć pustą listę. Pusto to też wynik.
`

const SCHEMA = {
  type: 'object',
  properties: {
    znaleziska: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          obszar: { type: 'string' },
          plik: { type: 'string' },
          linia: { type: 'number' },
          cytat: { type: 'string', description: 'dosłowny fragment, max 200 znaków' },
          kategoria: { type: 'string', enum: ['nieprawda', 'obietnica-bez-pokrycia', 'placeholder', 'niespojnosc', 'ton'] },
          problem: { type: 'string', description: 'jedno zdanie: co jest nie tak' },
          powaga: { type: 'string', enum: ['blokada', 'powazne', 'drobne'] },
          propozycja: { type: 'string', description: 'konkretna propozycja nowego brzmienia albo działania' },
        },
        required: ['obszar', 'plik', 'cytat', 'kategoria', 'problem', 'powaga', 'propozycja'],
      },
    },
  },
  required: ['znaleziska'],
}

const OBSZARY = [
  { key: 'strona-pl', prompt: 'Strona publiczna, wersja POLSKA. Przeczytaj i18n/dictionaries/pl.json W CAŁOŚCI, klucz po kluczu. Do tego components/Hero.tsx, ProblemVision.tsx, Services.tsx. Oceń KAŻDE zdanie wobec faktu, że nie ma ani jednego klienta.' },
  { key: 'strona-sekcje', prompt: 'Sekcje strony w components/: Approach.tsx, Founder.tsx, FoundingOffer.tsx, CTA.tsx, Faq.tsx, Footer.tsx, Header.tsx. Czytaj też teksty, które biorą z i18n. Szukaj obietnic, przechwałek i zdań o doświadczeniu.' },
  { key: 'dowody', prompt: 'NAJWAŻNIEJSZY OBSZAR. Strona ma sekcje "dowodowe": components/CostProof.tsx, Reliability.tsx oraz dane content/cost-proof.json i content/reliability-proof.json. Strona twierdzi m.in. "To nie case study. To licznik z produkcji." Sprawdź DOKŁADNIE: skąd biorą się te liczby, czy pochodzą z czegokolwiek prawdziwego, czy są wpisane ręcznie, i czy twierdzenia wokół nich są prawdziwe przy zerowej liczbie klientów. To jest kategoria, która może najbardziej zaszkodzić.' },
  { key: 'kalkulator', prompt: 'components/SavingsCalculator.tsx oraz app/[lang]/calculator/** i lib/dobor.ts. Kalkulator liczy klientowi oszczędności. Sprawdź: jakie założenia są zaszyte, czy są jawne dla użytkownika, czy wynik nie jest zawyżony, czy jest zastrzeżenie, że to szacunek. Zawyżony kalkulator na stronie firmy bez referencji to poważny problem wiarygodności.' },
  { key: 'jezyki', prompt: 'Spójność trzech języków: i18n/dictionaries/pl.json, en.json, de.json. Porównaj klucz po kluczu. Szukaj: kluczy istniejących w jednym języku a brakujących w innym, tłumaczeń mówiących CO INNEGO niż oryginał (zwłaszcza tam, gdzie chodzi o doświadczenie, liczby i obietnice), zostawionego angielskiego w polskiej wersji i odwrotnie.' },
  { key: 'formularz-cta', prompt: 'Ścieżki działania: components/ContactForm.tsx, CTA.tsx oraz trasa app/api przyjmująca formularz. Sprawdź: co dokładnie obiecuje formularz (czas odpowiedzi?), co dostaje człowiek po wysłaniu, czy jest zgoda RODO i czy jej treść jest sensowna, dokąd prowadzą przyciski CTA i czy każdy z nich ma cel.' },
  { key: 'maile-szablony', prompt: 'Treść maili WYCHODZĄCYCH do klienta: lib/mail.ts, lib/mailSignature.ts, lib/kopertaMaila.ts. Przeczytaj każdy szablon i podpis. Szukaj: placeholderów, danych firmy, których nie ma, tonu, zdań nieprawdziwych, brakującej stopki/identyfikacji nadawcy.' },
  { key: 'maile-windykacja', prompt: 'Maile windykacyjne i przypomnienia: funkcje reminderEmailText i dunningEmailText w lib/invoices.ts, plus wszystko, co wysyła app/api/invoices/[id]/remind. To pisma o dużym ciężarze — sprawdź ton, poprawność i to, czy zdania zgadzają się z tym, co widać na wydruku wezwania.' },
  { key: 'wydruk-oferta', prompt: 'Wydruk oferty: app/[lang]/admin/offers/[id]/print/** i komponenty, których używa. Czytaj jako KLIENT, który dostaje ten dokument. Szukaj: pustych rubryk, tekstów zastępczych, zdań niezrozumiałych dla laika, brakujących informacji (kto wystawił, do kiedy ważna, co dalej).' },
  { key: 'wydruk-umowa', prompt: 'Wydruk umowy i NDA: app/[lang]/admin/contracts/[id]/print/** oraz lib/contracts.ts (treść klauzul). Znana sprawa do NIE zgłaszania: "ZLECENIODAWCA / WYKONAWCA" w jednej rubryce jest już odnotowane jako A5. Szukaj innych rzeczy: czy dokument wygląda poważnie, czy nie ma sprzeczności między klauzulami, czy zastrzeżenie o szablonie prawnym jest widoczne.' },
  { key: 'wydruk-faktura-wezwanie', prompt: 'Wydruki faktury i wezwania do zapłaty: app/[lang]/admin/invoices/[id]/print/** oraz .../wezwanie/print/**. Uwaga: podgląd wezwania przed wysłaniem został dodany DZIŚ i jest poprawny — nie zgłaszaj go jako usterki. Szukaj czegoś innego: pól, które mogą zostać puste u prawdziwego klienta, tekstów technicznych widocznych dla klienta, kwot bez waluty.' },
  { key: 'publiczne-dokumenty', prompt: 'Strony, które klient ogląda pod linkiem, bez logowania: app/[lang]/oferta/[token]/**, faktura/[token]/**, umowa/[token]/**, nda/[token]/**, wezwanie/[token]/**, opinia/[token]/**. Czytaj jako osoba z zewnątrz. Szukaj: co widzi, gdy link wygasł albo został unieważniony, czy wie co ma zrobić, czy jest jasne kto to przysłał, czy formularz opinii tłumaczy po co jest.' },
]

phase('Szukanie')

const WERYFIKACJA = {
  type: 'object',
  properties: {
    realne: { type: 'boolean', description: 'czy znalezisko jest prawdziwe i warte zgłoszenia właścicielowi' },
    powod: { type: 'string' },
    powaga_po_weryfikacji: { type: 'string', enum: ['blokada', 'powazne', 'drobne', 'odrzucone'] },
  },
  required: ['realne', 'powod', 'powaga_po_weryfikacji'],
}

const wyniki = await pipeline(
  OBSZARY,
  (o) => agent(`${KONTEKST}\n\nTWÓJ OBSZAR: ${o.prompt}\n\nPrzejrzyj go dokładnie i zwróć znaleziska.`, {
    label: `szukaj:${o.key}`,
    phase: 'Szukanie',
    schema: SCHEMA,
  }),
  (wynik, o) => {
    const zn = (wynik && wynik.znaleziska) || []
    if (!zn.length) return []
    return parallel(zn.slice(0, 12).map((z) => () =>
      agent(
        `${KONTEKST}\n\nZWERYFIKUJ TO ZNALEZISKO ADWERSARYJNIE. Twoim zadaniem jest je OBALIĆ, jeśli się da.\n\n` +
        `Obszar: ${z.obszar}\nPlik: ${z.plik}\nCytat: "${z.cytat}"\nProblem: ${z.problem}\nPowaga: ${z.powaga}\n\n` +
        `Otwórz plik i sprawdź: (1) czy ten cytat NAPRAWDĘ tam jest, dosłownie; ` +
        `(2) czy w kontekście całego zdania/sekcji zarzut się broni; ` +
        `(3) czy to nie jest tekst świadomie uczciwy albo już opatrzony zastrzeżeniem; ` +
        `(4) czy problem dotyczy tego, co WIDZI KLIENT, a nie kodu wewnętrznego. ` +
        `Domyślnie odrzucaj, gdy masz wątpliwości.`,
        { label: `sprawdz:${o.key}`, phase: 'Weryfikacja', schema: WERYFIKACJA }
      ).then((w) => ({ ...z, weryfikacja: w }))
    ))
  }
)

const potwierdzone = wyniki
  .flat()
  .filter(Boolean)
  .filter((z) => z.weryfikacja && z.weryfikacja.realne && z.weryfikacja.powaga_po_weryfikacji !== 'odrzucone')

log(`Potwierdzonych znalezisk: ${potwierdzone.length}`)

phase('Synteza')

const synteza = await agent(
  `${KONTEKST}\n\nOto POTWIERDZONE znaleziska z przeglądu wszystkiego, co widzi klient:\n\n` +
    JSON.stringify(potwierdzone, null, 2) +
    `\n\nZłóż z tego zwięzły raport po polsku dla właściciela (nie jest programistą):\n` +
    `1. Jedno zdanie: czy da się dziś wysłać ludzi na tę stronę, czy nie.\n` +
    `2. Rzeczy do poprawienia PRZED pierwszą wiadomością — uporządkowane, z cytatem i propozycją nowego brzmienia.\n` +
    `3. Rzeczy do poprawienia później.\n` +
    `4. Co jest w porządku i czego NIE ruszać.\n` +
    `Bez wstępów i bez korpo-waty. Konkret, cytat, propozycja.`,
  { label: 'synteza', phase: 'Synteza' }
)

return { potwierdzone, synteza }
