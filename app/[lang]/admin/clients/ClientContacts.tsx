"use client";

import { useCallback, useState } from "react";
import { IconPlus, IconStar, IconStarFilled, IconTrash, IconPencil } from "@tabler/icons-react";
import { type ClientContact, clientContactLine, ContactChannelIcon } from "./shared";
import { useUI } from "../ui";

/**
 * Osoby kontaktowe przy firmie (Moduł 54, krok 4).
 *
 * Zastępuje dawne pojedyncze pole „Osoba kontaktowa" na wizytówce. Samo pole
 * `clients.osoba_kontaktowa` ZOSTAJE w bazie jako migawka osoby głównej —
 * czyta je dwanaście miejsc w panelu i apce (powitanie w mailu retencyjnym,
 * wiersz listy, wyszukiwarka, eksport CSV, wiadomości projektowe). Serwer
 * przepisuje ją sam przy każdej zmianie tej listy.
 *
 * Gwiazdka = osoba główna. Jest ich najwyżej jedna (baza pilnuje tego
 * indeksem), bo to ona wita adresata w mailach.
 */

type Szkic = {
  imie: string;
  rola: string;
  telefon: string;
  email: string;
  notatka: string;
};

const PUSTY: Szkic = { imie: "", rola: "", telefon: "", email: "", notatka: "" };

export function ClientContacts({
  clientId,
  contacts,
  onChanged,
  waskaKolumna = false,
}: {
  clientId: string;
  contacts: ClientContact[];
  /** Przeładowanie profilu — migawka osoby głównej zmienia też nagłówek
   * i wiersz na liście klientów, więc odświeżamy całość, nie samą listę. */
  onChanged: () => void;
  /** Lista stoi w kolumnie atrybutów (Moduł 54, krok 6), a nie na pełnej
   * szerokości karty. Formularz idzie wtedy w jednej kolumnie: `sm:grid-cols-2`
   * mierzy OKNO, nie kontener, więc na szerokim ekranie rozbiłby dwa pola na
   * ~150 px każde i „Imię i nazwisko" nie zmieściłoby się nawet jako podpowiedź. */
  waskaKolumna?: boolean;
}) {
  const { toast, confirm } = useUI();
  /** `null` = nic nie edytujemy, `""` = formularz nowej osoby, id = edycja. */
  const [edytowany, setEdytowany] = useState<string | null>(null);
  const [szkic, setSzkic] = useState<Szkic>(PUSTY);
  const [zapisuje, setZapisuje] = useState(false);

  const otworzNowa = useCallback(() => {
    setSzkic(PUSTY);
    setEdytowany("");
  }, []);

  const otworzEdycje = useCallback((c: ClientContact) => {
    setSzkic({ imie: c.imie, rola: c.rola, telefon: c.telefon, email: c.email, notatka: c.notatka });
    setEdytowany(c.id);
  }, []);

  const zapisz = useCallback(async () => {
    if (!szkic.imie.trim()) return;
    setZapisuje(true);
    const nowa = edytowany === "";
    const res = await fetch(
      nowa ? `/api/clients/${clientId}/contacts` : `/api/clients/${clientId}/contacts/${edytowany}`,
      {
        method: nowa ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(szkic),
      }
    );
    setZapisuje(false);
    if (!res.ok) {
      toast("Nie udało się zapisać osoby.", "error");
      return;
    }
    setEdytowany(null);
    onChanged();
  }, [clientId, edytowany, szkic, toast, onChanged]);

  const usun = useCallback(
    async (c: ClientContact) => {
      const ok = await confirm(`Usunąć ${c.imie || "tę osobę"} z listy osób kontaktowych?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/clients/${clientId}/contacts/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć osoby.", "error");
        return;
      }
      onChanged();
    },
    [clientId, confirm, toast, onChanged]
  );

  const ustawGlowna = useCallback(
    async (c: ClientContact) => {
      // Cały komplet pól, bo PATCH zapisuje formularz w całości — wysłanie
      // samej flagi wyczyściłoby resztę.
      const res = await fetch(`/api/clients/${clientId}/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imie: c.imie,
          rola: c.rola,
          telefon: c.telefon,
          email: c.email,
          notatka: c.notatka,
          glowna: true,
        }),
      });
      if (!res.ok) {
        toast("Nie udało się zmienić osoby głównej.", "error");
        return;
      }
      onChanged();
    },
    [clientId, toast, onChanged]
  );

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Osoby kontaktowe</h2>
        <span className="flex-1" />
        <button
          onClick={otworzNowa}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
        >
          <IconPlus size={13} /> Dodaj osobę
        </button>
      </div>

      {contacts.length === 0 && edytowany === null && (
        // Trzeci wariant stanu pustego (ustalenie A1): mówi, czego brakuje
        // i co to zmienia, zamiast samego „brak".
        <p className="text-[12.5px] text-muted">
          Nikt jeszcze nie jest tu wpisany. Osoba główna wita adresata w mailu retencyjnym i w
          wiadomościach projektowych, a mail z jej adresu dopina się do tej firmy sam.
        </p>
      )}

      <div className="space-y-1.5">
        {contacts.map((c) =>
          edytowany === c.id ? (
            <Formularz
              key={c.id}
              szkic={szkic}
              setSzkic={setSzkic}
              zapisuje={zapisuje}
              onZapisz={zapisz}
              onAnuluj={() => setEdytowany(null)}
              waskaKolumna={waskaKolumna}
            />
          ) : (
            <div key={c.id} className="group flex items-start gap-2 rounded-lg border hairline px-3 py-2">
              <button
                onClick={() => (c.glowna ? undefined : ustawGlowna(c))}
                disabled={c.glowna}
                title={c.glowna ? "Osoba główna — wita w mailach" : "Ustaw jako osobę główną"}
                className={`mt-0.5 shrink-0 rounded-md p-0.5 ${
                  c.glowna ? "text-brand-gold" : "text-muted opacity-40 hover:opacity-100"
                }`}
              >
                {c.glowna ? <IconStarFilled size={14} /> : <IconStar size={14} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{clientContactLine(c)}</p>
                {(c.telefon || c.email) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
                    {c.telefon && (
                      <a href={`tel:${c.telefon}`} className="flex items-center gap-1 hover:text-[var(--fg)]">
                        <ContactChannelIcon kind="telefon" size={12} /> {c.telefon}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 truncate hover:text-[var(--fg)]">
                        <ContactChannelIcon kind="email" size={12} /> {c.email}
                      </a>
                    )}
                  </div>
                )}
                {c.notatka && <p className="mt-0.5 text-[11.5px] text-muted opacity-80">{c.notatka}</p>}
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => otworzEdycje(c)}
                  title="Edytuj"
                  className="rounded-md p-1 text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                >
                  <IconPencil size={13} />
                </button>
                <button
                  onClick={() => usun(c)}
                  title="Usuń"
                  className="rounded-md p-1 text-muted hover:bg-red-500/10 hover:text-red-400"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
          )
        )}

        {edytowany === "" && (
          <Formularz
            szkic={szkic}
            setSzkic={setSzkic}
            zapisuje={zapisuje}
            onZapisz={zapisz}
            onAnuluj={() => setEdytowany(null)}
            waskaKolumna={waskaKolumna}
          />
        )}
      </div>
    </div>
  );
}

function Formularz({
  szkic,
  setSzkic,
  zapisuje,
  onZapisz,
  onAnuluj,
  waskaKolumna,
}: {
  szkic: Szkic;
  setSzkic: (s: Szkic) => void;
  zapisuje: boolean;
  onZapisz: () => void;
  onAnuluj: () => void;
  waskaKolumna: boolean;
}) {
  const pole = "w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onZapisz();
      }}
      className="card-paper space-y-2 rounded-lg border hairline p-3"
    >
      <div className={`grid gap-2 ${waskaKolumna ? "" : "sm:grid-cols-2"}`}>
        <input
          autoFocus
          value={szkic.imie}
          onChange={(e) => setSzkic({ ...szkic, imie: e.target.value })}
          placeholder="Imię i nazwisko"
          className={pole}
        />
        <input
          value={szkic.rola}
          onChange={(e) => setSzkic({ ...szkic, rola: e.target.value })}
          placeholder="Rola (np. księgowość)"
          className={pole}
        />
        <input
          value={szkic.telefon}
          onChange={(e) => setSzkic({ ...szkic, telefon: e.target.value })}
          placeholder="Telefon"
          className={pole}
        />
        <input
          value={szkic.email}
          onChange={(e) => setSzkic({ ...szkic, email: e.target.value })}
          placeholder="E-mail"
          className={pole}
        />
      </div>
      <input
        value={szkic.notatka}
        onChange={(e) => setSzkic({ ...szkic, notatka: e.target.value })}
        placeholder="O czym pamiętać przy tej osobie (opcjonalnie)"
        className={pole}
      />
      {/* Adres osoby wchodzi do dopasowania poczty — właściciel ma to
          wiedzieć w chwili wpisywania, nie odkryć po fakcie. */}
      {szkic.email.trim() && (
        <p className="text-[11px] text-muted">
          Mail z tego adresu będzie od teraz dopinany do tej firmy.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnuluj} className="rounded-full border hairline px-3 py-1 text-[11px] text-muted">
          Anuluj
        </button>
        <button
          type="submit"
          disabled={zapisuje || !szkic.imie.trim()}
          className="btn-primary rounded-full px-3 py-1 text-[11px] disabled:opacity-50"
        >
          {zapisuje ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
