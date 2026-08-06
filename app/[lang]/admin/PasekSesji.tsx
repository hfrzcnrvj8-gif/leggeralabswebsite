"use client";

// Pasek „sesja wygasła" — jedyna rzecz, którą właściciel widzi, gdy panel
// przestaje mieć prawo zapisu. Powód powstania i pomiary: `strazSesji.ts`.
//
// Trzy decyzje, które są tu regułą, nie stylem:
//
// 1. **Pasek nie znika sam.** Toast gaśnie po 3,4 s, a to jest stan, nie
//    zdarzenie: dopóki właściciel się nie zaloguje, KAŻDY kolejny zapis idzie
//    w próżnię. Znikający komunikat o trwającym stanie to ta sama klasa błędu
//    co „cicha odmowa".
// 2. **Logowanie jest TUTAJ, nie na osobnej stronie.** Ekran, na którym pasek
//    się zapala, trzyma zwykle tekst, którego nie ma w bazie. Wysłanie
//    właściciela na `/pl/admin` znaczyłoby „zostaw tę pracę". Dlatego pasek
//    prosi o hasło (i o kod z aplikacji, gdy 2FA jest włączone) na miejscu,
//    a po zalogowaniu NIE przeładowuje strony.
// 3. **Zdanie mówi wprost, co jest niezapisane.** „Nie udało się zapisać"
//    sugeruje sieć i zachęca do klikania jeszcze raz — a klikanie nie pomoże.

import { useCallback, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconLock } from "@tabler/icons-react";
import { SPRING, TWEEN_EXIT } from "@/lib/motion";
import { czySesjaWygasla, migawkaSerwera, subskrybujStrazSesji, zglosPowrotSesji } from "./strazSesji";

export function PasekSesji() {
  const wygasla = useSyncExternalStore(subskrybujStrazSesji, czySesjaWygasla, migawkaSerwera);
  const [haslo, setHaslo] = useState("");
  const [kod, setKod] = useState("");
  const [kodWymagany, setKodWymagany] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [wrocila, setWrocila] = useState(false);

  const zaloguj = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPracuje(true);
      setBlad(null);
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kodWymagany ? { password: haslo, kod } : { password: haslo }),
        });
        if (res.ok) {
          setHaslo("");
          setKod("");
          setKodWymagany(false);
          setWrocila(true);
          zglosPowrotSesji();
          return;
        }
        const dane = (await res.json().catch(() => ({}))) as { error?: string; kod_wymagany?: boolean };
        if (dane.kod_wymagany) {
          const pierwszeWejscie = !kodWymagany;
          setKodWymagany(true);
          setKod("");
          setBlad(pierwszeWejscie ? null : dane.error ?? "Kod się nie zgadza.");
        } else {
          setKodWymagany(false);
          // Hamulec logowania (5/15 min) mówi konkretnie, ile czekać — jego
          // zdanie jest lepsze od naszego.
          setBlad(dane.error && res.status === 429 ? dane.error : "Błędne hasło.");
        }
      } catch {
        setBlad("Brak połączenia z panelem.");
      } finally {
        setPracuje(false);
      }
    },
    [haslo, kod, kodWymagany]
  );

  return (
    <AnimatePresence>
      {(wygasla || wrocila) && (
        <motion.div
          key={wygasla ? "wygasla" : "wrocila"}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: TWEEN_EXIT }}
          transition={SPRING}
          role="alert"
          // `admin-linear` + `text-[var(--fg)]` — patrz ZNALEZISKO E2 w ui.tsx:
          // ten kontener leży poza `.admin-linear`, więc bez obu klas byłby
          // jasną kartą w ciemnym panelu.
          className="admin-linear pointer-events-none fixed inset-x-0 top-3 z-[105] flex justify-center px-3 text-[var(--fg)]"
        >
          <div
            className={`card-paper pointer-events-auto w-full max-w-2xl rounded-xl border px-4 py-3 shadow-lg ${
              wygasla ? "!border-amber-500/50" : "!border-emerald-500/50"
            }`}
          >
            {wygasla ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-amber-400">
                  <IconLock size={16} />
                </span>
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <strong className="font-medium">Sesja wygasła — od tej chwili nic się nie zapisuje.</strong>{" "}
                  <span className="text-muted">
                    To, co masz na ekranie, zostaje. Zaloguj się tutaj i zapisz jeszcze raz — nie odświeżaj strony,
                    bo wtedy niezapisana treść przepadnie.
                  </span>
                </div>
                <form onSubmit={zaloguj} className="flex shrink-0 items-center gap-2">
                  <input
                    type="password"
                    value={haslo}
                    onChange={(e) => setHaslo(e.target.value)}
                    placeholder="Hasło"
                    autoComplete="current-password"
                    className="h-8 w-36 rounded-md border hairline bg-transparent px-2 text-[13px] placeholder:text-muted focus:outline-none"
                  />
                  {kodWymagany && (
                    <input
                      value={kod}
                      onChange={(e) => setKod(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Kod"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="h-8 w-20 rounded-md border hairline bg-transparent px-2 text-[13px] tracking-widest placeholder:text-muted focus:outline-none"
                    />
                  )}
                  <button
                    type="submit"
                    disabled={pracuje || !haslo}
                    className="h-8 shrink-0 rounded-md border hairline px-3 text-[13px] hover:bg-[var(--hairline)] disabled:opacity-50"
                  >
                    {pracuje ? "Loguję…" : "Zaloguj"}
                  </button>
                </form>
                {blad && <p className="w-full text-[12.5px] text-red-400">{blad}</p>}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <strong className="font-medium">Zalogowano ponownie.</strong>{" "}
                  <span className="text-muted">
                    Zapisz jeszcze raz to, co zmieniałeś po wygaśnięciu sesji — tamte zapisy nie doszły.
                  </span>
                </span>
                <button
                  onClick={() => setWrocila(false)}
                  className="h-8 shrink-0 rounded-md border hairline px-3 hover:bg-[var(--hairline)]"
                >
                  Rozumiem
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
