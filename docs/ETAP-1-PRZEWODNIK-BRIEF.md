# Brief etapu 1: przewodnik i podsumowanie stanu

**Powstał:** 2026-08-05, jako pierwszy etap `docs/PLAN-DOMKNIECIA.md`.
**Zakres:** panel (dokumentacja + ewentualne drobne poprawki w `lib/instrukcje.ts`).
Apki nie ruszamy.

---

## NAJPIERW PRZECZYTAJ TO — zakres jest węższy, niż brzmi

Plan domknięcia mówił „napisz przewodnik: co panel potrafi i jak z niego
korzystać". **Rekonesans przed napisaniem tego briefu pokazał, że w dużej
części to już istnieje** — i nie w dokumencie, tylko tam, gdzie trzeba:
w panelu, na ekranie *Instrukcje* (Moduł 53, `lib/instrukcje.ts`, 272 wpisy,
14 modułów).

Jest tam już:

- **`WSTEP`** — przegląd z góry: panel jako jedna historia (obca firma →
  kontakt → rozmowa → klient → projekt → faktura), zasada „panel nigdy nie
  kontaktuje się z nikim za Ciebie i nigdy nie podejmuje decyzji", zasada „nic
  nie znika po cichu".
- **Ścieżki krok po kroku** dla Pulpitu i Leadów („1. Spójrz na licznik…",
  „2. Skąd biorą się leady", „3. Przejdź kandydatów Łowcy…").
- **Automaty opisane przy swoich modułach** („Poranny raport, codziennie
  o 6:00", „Łowca leadów — co noc o 4:00", „Retencja danych").

**Nie pisz drugiego podręcznika.** Duplikat rozjedzie się z oryginałem
w tydzień — ten projekt złapał to już przy mapach statusu, ikonach i regule
„świadomie pomijamy". Zrób to, czego NIE ma.

---

## Co naprawdę ma powstać (trzy rzeczy)

### 1. Weryfikacja instrukcji — czy nadal mówią prawdę

**To jest najważniejsza część tego etapu i to od niej zacznij.** 272 wpisy
powstawały przez kilka tygodni, a panel zmieniał się codziennie. Dziś
(2026-08-05) trzy razy z rzędu okazało się, że dokumentacja opisuje stan
sprzed zmian:

- plan wskazywał siedem brakujących ekranów apki — wszystkie były zrobione;
- komentarz obiecywał ochronę przed przelewem daty, której `Date` nie robi;
- drugi komentarz wskazywał tę wadliwą funkcję jako wzór.

Sprawdź instrukcje przeciwko kodowi, moduł po module. Szczególnie podejrzane,
bo zmienione w ostatnich dniach:

| co sprawdzić | dlaczego |
|---|---|
| faktury cykliczne | **2026-08-05 zmieniono sposób liczenia terminu** (kotwica) — instrukcja może opisywać stary rytm |
| wpłaty na fakturę | doszła kontrola „suma wpłat nie przekracza należności" |
| wystawianie faktury | „ponowne kliknięcie nie nadaje drugiego numeru" — sprawdź, czy to nadal prawda |
| retencja danych | okna 24 mies. / 6 lat / 5 lat — czy liczby w instrukcji zgadzają się z `lib/leadRetention.ts` |
| propozycje i potwierdzenia | Fazy 3 i 4 zaplecza, opisane po fakcie |
| bramka wysyłki | dokument z ostrzeżeniem — czy instrukcja mówi o „mimo to" |

**Metoda: nie czytaj instrukcji i nie kiwaj głową.** Bierz zdanie, szukaj
miejsca w kodzie, które ma je czynić prawdziwym, i sprawdzaj. Zdanie bez
pokrycia albo poprawiasz, albo zgłaszasz właścicielowi, jeśli to decyzja
produktowa.

### 2. Podsumowanie stanu — dla WŁAŚCICIELA, nie dla programisty

Czego dziś nie ma nigdzie: **jednej odpowiedzi na pytanie „co ja właściwie
mam i skąd wiadomo, że to działa"**. `HANDOFF.md` jest techniczny i pisany dla
następnej sesji Claude'a; `HUB_SETUP.md` ma 12 339 linii.

Powstanie `docs/CO-MAM.md` — krótki dokument (celuj w 2–3 strony, nie w 30):

- **Co to jest**, w pięciu zdaniach.
- **Co potrafi** — tabela: moduł → jedno zdanie → gdzie tego szukać w panelu
  i czy jest na telefonie.
- **Co dzieje się samo** — jedno miejsce, zebrane z 14 modułów: co, o której,
  i **co zobaczysz jako dowód, że zadziałało**. Dziś ta wiedza jest
  rozproszona i to jest realny brak.
- **Czego panel świadomie NIE robi** — nie wysyła nic bez kliknięcia, nie ma
  modelu AI w żadnej decyzji, nie księguje (to nie jest program księgowy).
  Ta lista chroni przed rozczarowaniem i przed przypadkowym zbudowaniem czegoś,
  co zostało świadomie odrzucone.
- **Skąd wiadomo, że działa** — liczby, uczciwie: 349 testów, 111 sprawdzeń
  przejścia „na sucho" na żywych danych w obie strony (droga, która się udaje,
  i ta, która się nie udaje), 7 audytów końcowych, 14 reguł kontroli spójności
  na ekranie *Zdrowie*. Plus **czego te liczby NIE obejmują**: wyglądu
  w prawdziwej przeglądarce i ani jednego prawdziwego klienta.

### 3. Trzy ścieżki dnia — TYLKO jeśli po punkcie 1 widać, że ich brakuje

Instrukcje mają ścieżki per moduł. Brakuje (być może) ścieżek, które
przechodzą MIĘDZY modułami:

- „przyszedł nowy lead" → co klikam, w jakiej kolejności, gdzie to ląduje;
- „klient chce ofertę" → oferta → akceptacja → projekt → faktura;
- „faktura nie została zapłacona" → trzy poziomy windykacji.

**Sprawdź najpierw, czy instrukcje już tego nie mają w rozproszeniu.** Jeśli
mają — dopisz w `WSTEP` trzy odnośniki zamiast nowego tekstu.

---

## Czego NIE robić

- **Nie przepisuj `lib/instrukcje.ts` do markdownu.** Instrukcje mają być tam,
  gdzie się pracuje.
- **Nie pisz dokumentu na 30 stron.** Właściciel nie jest programistą i nie
  będzie czytał specyfikacji; ma wiedzieć, co ma i co się dzieje samo.
- **Nie zmieniaj zachowania panelu** przy okazji. Jeśli weryfikacja wykryje
  usterkę, zapisz ją i zgłoś — poprawki idą etapem 5 planu.
- **Nie ruszaj apki.**

---

## Sprawdzenie

`npx tsc --noEmit -p tsconfig.json` po każdej zmianie w `lib/instrukcje.ts`
(to zwykły TypeScript, więc literówka w kluczu wywali build).
`npm test` (349) i `npm run przejscie` (111 działa · 0 regresji) na koniec —
nawet jeśli zmiany są tylko w tekstach.

Ekran *Instrukcje* obejrzyj lokalnie: `preview_start name:"dev"`, potem
`/pl/admin/instrukcje`. Pamiętaj, że w tym środowisku podgląd renderuje
w ukrytej karcie — sprawdzaj przez `innerText`, nie przez zrzut ekranu.

---

## Na koniec

Wynik: `docs/CO-MAM.md` plus ewentualne poprawki w `lib/instrukcje.ts`.
Lista znalezisk z weryfikacji (punkt 1) — do `docs/ETAP-1-WYNIK.md`, także
gdy jest pusta. Zaktualizuj `HANDOFF.md` i `docs/PLAN-DOMKNIECIA.md`
(odhacz etap 1). Commit i push tylko dla panelu; skasuj `PROMPT-NOWY-CZAT.md`.
