"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconPrinter,
  IconRefresh,
  IconShieldCheck,
  IconShieldOff,
  IconX,
} from "@tabler/icons-react";
import { EASE_LIQUID } from "@/lib/motion";
import { Modal } from "./Modal";
import { useUI } from "./ui";
import { formatPlDate } from "@/lib/projects";

// Drugi składnik logowania (Moduł 41, 2026-07-22) — domknięcie Audytu 1.
//
// Hamulec prób z tamtego audytu zamknął ZGADYWANIE hasła; ten ekran zamyka
// jego WYCIEK. Trzy rzeczy w tym oknie są decyzjami właściciela, nie
// szczegółami wyglądu, i nie wolno ich „uprościć":
//
//  1. Kod QR **nie znika po zeskanowaniu**, a obok niego stoi sekret tekstem.
//     To nie jest zapominalstwo — to druga wybrana droga powrotu: TEN SAM
//     sekret ma trafić na telefon ORAZ do menedżera haseł na Macu, żeby
//     utrata jednego urządzenia przestała być zdarzeniem krytycznym.
//     Menedżer haseł na Macu nie zawsze zeskanuje kod z ekranu tego samego
//     komputera — stąd sekret w postaci do przepisania.
//  2. Nic nie zapisuje się jako aktywne, dopóki właściciel nie przepisze
//     jednego poprawnego kodu. Literówka w ręcznie wpisanym sekrecie
//     zamknęłaby go przed własnym panelem, a dowiedziałby się o tym dopiero
//     przy następnym logowaniu.
//  3. Kody zapasowe da się WYDRUKOWAĆ i SKOPIOWAĆ. Papier jest główną drogą
//     powrotu (decyzja 2026-07-22), a papier robi się z przycisku, nie
//     z ręcznego przepisywania ośmiu dziesięciocyfrowych liczb.

type Stan = {
  aktywny: boolean;
  wlaczonyOd: string | null;
  kodowZapasowych: number;
  oczekujeNaPotwierdzenie: boolean;
  wylaczonyAwaryjnie: boolean;
};

type Krok =
  | { rodzaj: "przeglad" }
  | { rodzaj: "skanowanie"; sekret: string; sekretCzytelny: string; adres: string }
  | { rodzaj: "kody"; kody: string[]; poWlaczeniu: boolean };

export function TwoFactorPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast, confirm } = useUI();
  const [stan, setStan] = useState<Stan | null>(null);
  const [krok, setKrok] = useState<Krok>({ rodzaj: "przeglad" });
  const [kod, setKod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zajete, setZajete] = useState(false);

  const wczytajStan = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/2fa");
      setStan(r.ok ? await r.json() : null);
    } catch {
      setStan(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setKrok({ rodzaj: "przeglad" });
    setKod("");
    setBlad(null);
    setStan(null);
    void wczytajStan();
  }, [open, wczytajStan]);

  /** Wspólna obsługa tras drugiego składnika: serwer odpowiada `{ error }`
   *  po polsku i to jego zdanie pokazujemy, bez tłumaczenia na własne. */
  const wyslij = async (sciezka: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    setZajete(true);
    setBlad(null);
    try {
      const r = await fetch(sciezka, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const dane = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setBlad(typeof dane.error === "string" ? dane.error : "Nie udało się. Spróbuj jeszcze raz.");
        return null;
      }
      return dane;
    } catch {
      setBlad("Brak połączenia z panelem.");
      return null;
    } finally {
      setZajete(false);
    }
  };

  const zacznij = async () => {
    const dane = await wyslij("/api/admin/2fa/start");
    if (!dane) return;
    setKod("");
    setKrok({
      rodzaj: "skanowanie",
      sekret: String(dane.sekret),
      sekretCzytelny: String(dane.sekret_czytelny),
      adres: String(dane.adres),
    });
  };

  const potwierdz = async () => {
    const dane = await wyslij("/api/admin/2fa/confirm", { kod });
    if (!dane) return;
    setKod("");
    setKrok({ rodzaj: "kody", kody: dane.kody_zapasowe as string[], poWlaczeniu: true });
    void wczytajStan();
  };

  const noweKody = async () => {
    const dane = await wyslij("/api/admin/2fa/backup-codes", { kod });
    if (!dane) return;
    setKod("");
    setKrok({ rodzaj: "kody", kody: dane.kody_zapasowe as string[], poWlaczeniu: false });
    void wczytajStan();
  };

  const wylacz = async () => {
    const ok = await confirm(
      "Wyłączyć drugi składnik? Po tym panel będzie chroniony samym hasłem, a kody zapasowe przestaną działać.",
      { danger: true }
    );
    if (!ok) return;
    const dane = await wyslij("/api/admin/2fa/disable", { kod });
    if (!dane) return;
    setKod("");
    setKrok({ rodzaj: "przeglad" });
    toast("Drugi składnik wyłączony.");
    void wczytajStan();
  };

  return (
    <Modal open={open} onClose={onClose} card="card-paper mx-auto w-full max-w-xl rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Logowanie dwuskładnikowe</h2>
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
        >
          <IconX size={13} /> Zamknij
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={krok.rodzaj}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: EASE_LIQUID }}
          className="mt-4"
        >
          {krok.rodzaj === "przeglad" && (
            <Przeglad
              stan={stan}
              kod={kod}
              setKod={setKod}
              zajete={zajete}
              onZacznij={zacznij}
              onNoweKody={noweKody}
              onWylacz={wylacz}
            />
          )}

          {krok.rodzaj === "skanowanie" && (
            <Skanowanie
              adres={krok.adres}
              sekretCzytelny={krok.sekretCzytelny}
              kod={kod}
              setKod={setKod}
              zajete={zajete}
              onPotwierdz={potwierdz}
              onAnuluj={() => {
                setKod("");
                setBlad(null);
                setKrok({ rodzaj: "przeglad" });
              }}
            />
          )}

          {krok.rodzaj === "kody" && (
            <KodyZapasowe
              kody={krok.kody}
              poWlaczeniu={krok.poWlaczeniu}
              onGotowe={() => {
                setKrok({ rodzaj: "przeglad" });
                void wczytajStan();
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {blad && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-400">
          <IconAlertTriangle size={14} className="mt-px shrink-0" />
          {blad}
        </p>
      )}
    </Modal>
  );
}

// ── Przegląd ────────────────────────────────────────────────────────────────

function Przeglad({
  stan,
  kod,
  setKod,
  zajete,
  onZacznij,
  onNoweKody,
  onWylacz,
}: {
  stan: Stan | null;
  kod: string;
  setKod: (v: string) => void;
  zajete: boolean;
  onZacznij: () => void;
  onNoweKody: () => void;
  onWylacz: () => void;
}) {
  if (!stan) return <p className="py-6 text-center text-xs text-muted">Sprawdzam…</p>;

  if (!stan.aktywny && !stan.wylaczonyAwaryjnie) {
    return (
      <div>
        <p className="text-[13px] text-muted">
          Dziś do panelu wystarczy samo hasło. Hasło da się podejrzeć, wyłudzić na podrobionej stronie
          albo wyciągnąć z menedżera haseł — i wtedy nie ma nic, co by kogoś zatrzymało. Drugi składnik
          to sześć cyfr z aplikacji na telefonie, zmieniających się co 30 sekund.
        </p>
        {stan.oczekujeNaPotwierdzenie && (
          <p className="mt-3 rounded-lg border hairline bg-amber-500/5 p-2.5 text-xs text-amber-300">
            Poprzednie włączanie nie zostało dokończone — nic nie zostało zapisane. Zacznij od nowa,
            dostaniesz świeży kod QR.
          </p>
        )}
        <button onClick={onZacznij} disabled={zajete} className="btn-primary mt-4 w-full py-2.5 text-sm">
          {zajete ? "Chwileczkę…" : "Włącz drugi składnik"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stan.wylaczonyAwaryjnie ? (
        <div className="rounded-lg border hairline bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-300">
            <IconAlertTriangle size={15} /> Wyłącznik awaryjny jest włączony
          </p>
          <p className="mt-1 text-xs text-muted">
            W ustawieniach serwera stoi <code className="text-[11px]">TOTP_DISABLED=1</code>, więc panel
            NIE pyta o kod, mimo że sekret i kody zapasowe leżą nietknięte. Skasuj tę zmienną w Vercelu,
            żeby ochrona wróciła — nic nie trzeba włączać od nowa.
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] text-emerald-400">
          <IconShieldCheck size={16} /> Włączone
          {stan.wlaczonyOd && <span className="text-muted">od {formatPlDate(stan.wlaczonyOd.slice(0, 10))}</span>}
        </p>
      )}

      <div className="rounded-lg border hairline p-3">
        <p className="text-[13px]">
          Kody zapasowe: <strong>{stan.kodowZapasowych}</strong> z 8 niezużytych
        </p>
        <p className="mt-1 text-xs text-muted">
          {stan.kodowZapasowych <= 2
            ? "Zostało ich niewiele. Wygeneruj i wydrukuj nową ósemkę — to Twoja główna droga powrotu, gdy zgubisz telefon."
            : "To Twoja droga powrotu, gdy telefon przepadnie. Trzymaj wydruk poza domem albo w sejfie."}
        </p>
      </div>

      <div>
        <label className="text-xs text-muted">Kod z aplikacji (potrzebny do obu akcji niżej)</label>
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-[#4ea7fc]/60"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onNoweKody}
            disabled={zajete || !kod}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border hairline px-3 py-2 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-40"
          >
            <IconRefresh size={14} /> Wygeneruj nowe kody zapasowe
          </button>
          <button
            onClick={onWylacz}
            disabled={zajete || !kod}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            <IconShieldOff size={14} /> Wyłącz drugi składnik
          </button>
        </div>
        {/* Kod jest wymagany także tutaj, mimo że jesteś już zalogowany:
            inaczej ktoś, kto przejmie otwartą przeglądarkę, zdejmuje całą
            ochronę jednym kliknięciem (decyzja właściciela 2026-07-22). */}
        <p className="mt-1.5 text-[11px] text-muted">
          Kod zapasowy też zadziała przy wyłączaniu — na wypadek, gdybyś nie miał już telefonu.
        </p>
      </div>
    </div>
  );
}

// ── Skanowanie ──────────────────────────────────────────────────────────────

function Skanowanie({
  adres,
  sekretCzytelny,
  kod,
  setKod,
  zajete,
  onPotwierdz,
  onAnuluj,
}: {
  adres: string;
  sekretCzytelny: string;
  kod: string;
  setKod: (v: string) => void;
  zajete: boolean;
  onPotwierdz: () => void;
  onAnuluj: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const { toast } = useUI();

  useEffect(() => {
    // Biały kwadrat pod kodem jest wymuszony: panel jest ciemny, a czytniki
    // aparatu potrzebują jasnego tła pod ciemnymi modułami.
    QRCode.toDataURL(adres, { margin: 1, width: 220, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [adres]);

  return (
    <div>
      <p className="text-[13px] text-muted">
        Zeskanuj ten kod <strong className="text-[var(--fg)]">dwoma urządzeniami</strong> — telefonem
        (Google Authenticator, 1Password, Apple Hasła) <em>oraz</em> menedżerem haseł na Macu. To ten sam
        sekret, więc oba będą pokazywać ten sam kod; utrata jednego urządzenia przestaje wtedy odcinać Cię
        od panelu. Kod zostaje na ekranie — możesz skanować go wielokrotnie.
      </p>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-xl bg-white p-2">
          {qr ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qr} alt="Kod QR do aplikacji uwierzytelniającej" width={220} height={220} />
          ) : (
            <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-neutral-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Albo wpisz sekret ręcznie:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border hairline px-2.5 py-2 text-[12.5px] tracking-wider">
              {sekretCzytelny}
            </code>
            <button
              onClick={async () => {
                // Jak przy kodach zapasowych — odmowa schowka nie może być cicha.
                try {
                  await navigator.clipboard.writeText(sekretCzytelny.replace(/\s/g, ""));
                  toast("Sekret skopiowany.");
                } catch {
                  toast("Przeglądarka nie pozwoliła skopiować — przepisz sekret ręcznie.", "error");
                }
              }}
              className="shrink-0 rounded-md border hairline p-2 text-muted hover:text-[var(--fg)]"
              title="Kopiuj sekret"
            >
              <IconCopy size={15} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Menedżer haseł na Macu często nie umie zeskanować kodu z ekranu tego samego komputera —
            wtedy wklej mu sekret.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border hairline p-3">
        <label className="text-[13px]">
          Przepisz kod, który pokazuje aplikacja — dopiero to włączy ochronę
        </label>
        <p className="mt-0.5 text-[11px] text-muted">
          Ten krok istnieje po to, żeby literówka w sekrecie wyszła teraz, a nie przy następnym logowaniu.
        </p>
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456"
          onKeyDown={(e) => {
            if (e.key === "Enter" && kod && !zajete) onPotwierdz();
          }}
          className="mt-2 w-full rounded-lg border hairline bg-transparent px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-[#4ea7fc]/60"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={onAnuluj}
            className="rounded-md border hairline px-3 py-2 text-xs text-muted hover:text-[var(--fg)]"
          >
            Anuluj
          </button>
          <button onClick={onPotwierdz} disabled={zajete || !kod} className="btn-primary flex-1 py-2 text-sm">
            {zajete ? "Sprawdzam…" : "Potwierdź i włącz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kody zapasowe ───────────────────────────────────────────────────────────

function KodyZapasowe({
  kody,
  poWlaczeniu,
  onGotowe,
}: {
  kody: string[];
  poWlaczeniu: boolean;
  onGotowe: () => void;
}) {
  const { toast } = useUI();
  const [zapisane, setZapisane] = useState(false);
  const przywroc = useRef<() => void>(() => {});

  // Klasa na `body` włącza regułę `@media print` z globals.css (chowa całą
  // aplikację, zostawia widoczny wyłącznie blok `.kody-do-druku`). Zdejmujemy
  // ją po zamknięciu okna drukowania — inaczej następny wydruk czegokolwiek
  // w panelu wyszedłby jako pusta kartka.
  useEffect(() => {
    const po = () => document.body.classList.remove("drukuj-kody-2fa");
    window.addEventListener("afterprint", po);
    przywroc.current = po;
    return () => {
      window.removeEventListener("afterprint", po);
      po();
    };
  }, []);

  const drukuj = () => {
    document.body.classList.add("drukuj-kody-2fa");
    window.print();
    // Safari bywa niesolidny z `afterprint` — dokładamy własne sprzątanie.
    setTimeout(() => przywroc.current(), 1500);
  };

  const kopiuj = async () => {
    // `writeText` potrafi odmówić (brak uprawnienia do schowka, starsze
    // Safari, strona bez HTTPS). Bez tego `catch` przycisk milczał: właściciel
    // widziałby brak reakcji i uznał, że kody ma w schowku — przy GŁÓWNEJ
    // drodze powrotu to jest dokładnie ten rodzaj cichej porażki, którą ten
    // moduł ma likwidować. Zmierzone 2026-07-22 w przeglądarce weryfikacyjnej.
    try {
      await navigator.clipboard.writeText(kody.join("\n"));
      toast("Kody skopiowane.");
    } catch {
      toast("Przeglądarka nie pozwoliła skopiować. Użyj przycisku Drukuj albo zaznacz kody myszką.", "error");
    }
  };

  return (
    <div>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-300">
          <IconAlertTriangle size={15} /> Zapisz je teraz — nie zobaczysz ich już nigdzie
        </p>
        <p className="mt-1 text-xs text-muted">
          Po zamknięciu tego okna kody znikają. W panelu zostaje po nich wyłącznie zaszyfrowany ślad,
          którego nie da się odczytać — nawet ja ich nie odzyskam. Każdy działa raz.
          {poWlaczeniu
            ? " To Twoje wejście do panelu w dniu, w którym zgubisz telefon."
            : " Poprzednia ósemka właśnie przestała działać — zniszcz stary wydruk."}
        </p>
      </div>

      <div className="kody-do-druku mt-3 rounded-lg border hairline p-4">
        <div className="tylko-na-wydruku hidden">
          <p className="text-sm font-semibold">Leggera Hub — kody zapasowe do logowania</p>
          <p className="mt-0.5 text-xs">
            Osiem jednorazowych kodów. Wpisz jeden zamiast kodu z aplikacji, gdy nie masz telefonu.
            Trzymaj tę kartkę poza komputerem. Wydrukowano: {new Date().toLocaleDateString("pl-PL")}
          </p>
          <div className="mt-3" />
        </div>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-2">
          {kody.map((k, i) => (
            <li key={k} className="flex items-baseline gap-2 font-mono text-[15px] tracking-wider">
              <span className="w-4 shrink-0 text-[11px] text-muted">{i + 1}.</span>
              {k}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={drukuj}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border hairline px-3 py-2 text-xs hover:bg-[var(--hairline)]"
        >
          <IconPrinter size={15} /> Drukuj
        </button>
        <button
          onClick={kopiuj}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border hairline px-3 py-2 text-xs hover:bg-[var(--hairline)]"
        >
          <IconCopy size={15} /> Kopiuj
        </button>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={zapisane}
          onChange={(e) => setZapisane(e.target.checked)}
          className="mt-0.5"
        />
        Wydrukowałem albo zapisałem te kody w bezpiecznym miejscu.
      </label>

      <button onClick={onGotowe} disabled={!zapisane} className="btn-primary mt-2 w-full py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <IconCheck size={15} /> Gotowe
        </span>
      </button>
    </div>
  );
}
