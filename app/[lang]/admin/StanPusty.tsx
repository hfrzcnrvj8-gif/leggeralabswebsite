"use client";

import type { ComponentType, ReactNode } from "react";
import { IconFilterOff, IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";

/**
 * Pusty ekran panelu — trzy warianty, jeden komponent (Moduł 59, paczka E).
 *
 * Odpowiednik `ContentUnavailableView` z apki i tego samego ustalenia A1
 * (`docs/natywna-aplikacja/22-wynik-a1-komunikaty.md`): ekran, który nie ma
 * danych, MUSI powiedzieć KTÓRA z trzech rzeczy się stała, bo każda znaczy co
 * innego i każda ma inne wyjście:
 *
 * 1. **pusto naprawdę** — rekordu nie ma, i to jest prawda o firmie. Mówimy,
 *    czego brakuje i CO TO ZMIENIA (nie „brak danych"), plus przycisk dodania.
 * 2. **nic nie pasuje do filtra** — dane są, tylko odsiane. Wyjściem jest
 *    wyczyszczenie filtra, nie zakładanie nowego rekordu.
 * 3. **nie udało się wczytać** — panel nie odpowiedział. Wyjściem jest ponowna
 *    próba, a treść listy jest NIEZNANA (mówienie tu „Brak leadów" to kłamstwo,
 *    dokładnie to, co apka naprawiła u siebie w Fazie A1).
 *
 * Panel do tej pory nie miał wariantu 3 w ŻADNYM module, a warianty 1 i 2
 * mieszał: tabela leadów pisała „Brak leadów pasujących do filtrów" także przy
 * zerowej bazie i bez ani jednego włączonego filtru.
 */
export function StanPusty({
  ikona: Ikona,
  tytul,
  opis,
  akcja,
  gesty = false,
}: {
  ikona: ComponentType<{ size?: number; className?: string }>;
  tytul: string;
  /** Jedno zdanie: czego nie ma i co to zmienia. Bez żargonu, bez „brak danych". */
  opis: string;
  akcja?: ReactNode;
  /** Wariant do wnętrza karty/tabeli — mniejsze odstępy, bez własnej płyty. */
  gesty?: boolean;
}) {
  return (
    <div className={`text-center ${gesty ? "px-4 py-8" : "px-6 py-12"}`}>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-muted">
        <Ikona size={20} />
      </div>
      <p className="mt-3 text-[13.5px] font-medium text-[var(--fg)]">{tytul}</p>
      <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] text-muted">{opis}</p>
      {akcja && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{akcja}</div>}
    </div>
  );
}

/**
 * Sam wariant „nie udało się wczytać" — do miejsc, w których nie ma listy do
 * odfiltrowania ani pustki do opisania, tylko ekran, który się nie wczytał
 * (szkielet ładowania w Kosztach, Statystyki, profil rekordu).
 */
export function StanBledu({ blad, onPonow, gesty = false }: { blad: string; onPonow?: () => void; gesty?: boolean }) {
  return (
    <StanPusty
      ikona={IconPlugConnectedX}
      tytul="Nie udało się wczytać"
      opis={blad}
      gesty={gesty}
      akcja={
        onPonow && (
          <button
            onClick={onPonow}
            className="flex items-center gap-1.5 rounded-lg border hairline px-3 py-1.5 text-[12.5px] text-[var(--fg)] hover:bg-[var(--hairline)]"
          >
            <IconRefresh size={14} /> Spróbuj ponownie
          </button>
        )
      }
    />
  );
}

/**
 * Wariant „nie udało się wczytać" jako PASEK, nie jako cały ekran — dla
 * widoków, które mają sens także bez danych i nie wolno ich zasłonić:
 * siatka kalendarza (przewijanie miesięcy działa dalej), lista poczty
 * z otwartą wiadomością obok.
 *
 * Bez tego kalendarz przy zerwanym połączeniu rysuje pusty miesiąc — czyli
 * twierdzi, że nic w nim nie zaplanowano, zamiast przyznać, że nie wie.
 */
export function PasekBledu({ blad, onPonow }: { blad: string; onPonow?: () => void }) {
  return (
    // `/[0.14]`, nie `/[0.08]`: przy 8 % pasek miał zmierzone **1,077**
    // kontrastu wobec tła panelu, czyli poniżej progu roboczego płyty (≥ 1,10
    // z „trzech warstw powierzchni") — a pasek, którego nie widać, jest tym
    // samym błędem, co pusty stan, który kłamie.
    <div className="flex flex-wrap items-center gap-2 border-b border-orange-500/30 bg-orange-500/[0.14] px-4 py-2 text-[12.5px] text-[var(--fg)]">
      <IconPlugConnectedX size={15} className="shrink-0 text-orange-400" />
      <span className="min-w-0 flex-1">{blad}</span>
      {onPonow && (
        <button onClick={onPonow} className="flex items-center gap-1 rounded-lg border hairline px-2.5 py-1 hover:bg-[var(--hairline)]">
          <IconRefresh size={13} /> Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

/**
 * Rozstrzyga między trzema wariantami za wołającego — żeby kolejność „najpierw
 * błąd, potem filtr, na końcu prawdziwa pustka" nie była przepisywana w każdym
 * module z osobna (tak właśnie powstało sześć wersji wiersza profilu, patrz
 * `HUB_SETUP.md` → „Moduł 59, paczka F").
 *
 * Kolejność jest istotna: **błąd wygrywa ze wszystkim**. Przy zerwanym
 * połączeniu lista jest pusta niezależnie od filtrów, więc pokazanie „nic nie
 * pasuje do filtra" byłoby drugim kłamstwem zamiast pierwszego.
 */
export function StanListy({
  blad,
  onPonow,
  filtrAktywny = false,
  onWyczyscFiltr,
  filtrTytul = "Nic nie pasuje do filtrów",
  filtrOpis = "Rekordy są, ale żaden nie spełnia zaznaczonych warunków.",
  ikona,
  tytul,
  opis,
  akcja,
  gesty = false,
}: {
  /** Komunikat z `komunikatBledu(e)` — `null`, gdy wczytanie się udało. */
  blad?: string | null;
  onPonow?: () => void;
  filtrAktywny?: boolean;
  onWyczyscFiltr?: () => void;
  filtrTytul?: string;
  filtrOpis?: string;
  ikona: ComponentType<{ size?: number; className?: string }>;
  tytul: string;
  opis: string;
  akcja?: ReactNode;
  gesty?: boolean;
}) {
  if (blad) return <StanBledu blad={blad} onPonow={onPonow} gesty={gesty} />;

  if (filtrAktywny) {
    return (
      <StanPusty
        ikona={IconFilterOff}
        tytul={filtrTytul}
        opis={filtrOpis}
        gesty={gesty}
        akcja={
          onWyczyscFiltr && (
            <button
              onClick={onWyczyscFiltr}
              className="flex items-center gap-1.5 rounded-lg border hairline px-3 py-1.5 text-[12.5px] text-[var(--fg)] hover:bg-[var(--hairline)]"
            >
              <IconFilterOff size={14} /> Wyczyść filtry
            </button>
          )
        }
      />
    );
  }

  return <StanPusty ikona={ikona} tytul={tytul} opis={opis} akcja={akcja} gesty={gesty} />;
}
