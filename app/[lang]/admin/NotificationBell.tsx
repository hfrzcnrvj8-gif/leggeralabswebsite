"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell, IconChecks, IconFilter } from "@tabler/icons-react";
import { Popover, ContextMenu, ContextMenuItem, MenuLabel, useContextMenu } from "./Menu";
import { Tooltip } from "./Tooltip";
import {
  notificationAge,
  notificationHref,
  type Notification,
} from "@/lib/notifications";
import { NotificationIcon } from "./icons";

/**
 * Centrum powiadomień (Moduł 24) — dzwonek w sidebarze.
 *
 * Kronika zdarzeń „co się wydarzyło, gdy Cię nie było", świadomie NIE lista
 * „co jest do zrobienia" — tę liczy na żywo Pulpit. Stąd wpisy mają wiek
 * („2 godz. temu"), a nie termin, i nic tu nie znika po obsłużeniu sprawy.
 * Pełne uzasadnienie przy tabeli w `lib/db.ts`.
 *
 * Mieszka w sidebarze, bo panel nie ma górnego paska — to jedyne trwałe
 * chrome, widoczne z każdej strony. Sąsiaduje z „Szukaj" (drugie globalne
 * wejście, niezwiązane z żadnym modułem).
 */

/** Co ile odpytujemy o nowe zdarzenia. 60 s to kompromis: poczta i tak
 * przychodzi partiami przy syncu, a panel jest jednoosobowy — nikt nie czeka
 * na powiadomienie z sekundową dokładnością. Świadomie zwykły `setInterval`
 * zamiast SSE/WebSocketa: na Vercelu każde trwałe połączenie to działająca
 * funkcja, a to zapytanie jest tanie (jeden SELECT z LIMIT 50 + COUNT).
 * `document.hidden` wstrzymuje odpytywanie w tle — bez tego karta zostawiona
 * na noc wysyła 480 żądań do rana. */
const POLL_MS = 60_000;

export function NotificationBell({ base, collapsed }: { base: string; collapsed: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  // Moduł 34 — menu pod prawym przyciskiem na dzwonku. "Oznacz wszystkie" było
  // dotąd tylko w środku panelu (trzeba go najpierw otworzyć), a filtru
  // "tylko nieprzeczytane" nie było wcale.
  const bellCtl = useContextMenu<null>();
  const [onlyUnread, setOnlyUnread] = useState(false);

  const apply = useCallback((data: { notifications: Notification[]; unread: number }) => {
    setItems(data.notifications);
    setUnread(data.unread);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) apply(await res.json());
  }, [apply]);

  useEffect(() => {
    load();
    const t = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    // Powrót do karty = najbardziej prawdopodobny moment, w którym właściciel
    // chce zobaczyć, co go ominęło — odświeżamy od razu, nie czekając na tik.
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const markAll = async () => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) apply(await res.json());
  };

  /** Lista po filtrze "tylko nieprzeczytane" (Moduł 34). Filtrujemy TU, a nie
   * zapytaniem: dzwonek i tak trzyma komplet w pamięci (LIMIT 50), a przełącznik
   * ma działać natychmiast, bez rundy do bazy. */
  const visible = onlyUnread ? items.filter((n) => !n.read_at) : items;

  const open = async (n: Notification, close: () => void) => {
    const href = notificationHref(n, base);
    close();
    // Kolejność ma znaczenie: najpierw nawigacja (właściciel czeka na ekran),
    // potem cichy zapis „przeczytane". Odwrotnie klik wisiałby na rundzie do
    // bazy, zanim cokolwiek się ruszy.
    if (href) router.push(href);
    if (!n.read_at) {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      if (res.ok) apply(await res.json());
    }
  };

  return (
    <>
    <Popover
      align="left"
      width={340}
      triggerClassName="flex"
      trigger={(openMenu) => (
        <Tooltip
          placement="bottom"
          label={
            <>
              {unread > 0 ? `Powiadomienia — ${unread} nieprzeczytane` : "Powiadomienia"}
              <span className="block text-muted">Prawy przycisk: więcej opcji</span>
            </>
          }
        >
        <button
          onClick={openMenu}
          onContextMenu={(e) => bellCtl.openAt(e, null)}
          className={`mb-1.5 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] ${
            collapsed ? "justify-center" : ""
          }`}
          aria-label="Powiadomienia"
        >
          <span className="relative flex shrink-0">
            <IconBell size={15} />
            {/* Zwinięty sidebar nie ma miejsca na liczbę — zostaje sama
                kropka, bo „czy coś jest" to i tak jedyna informacja, której
                właściciel szuka rzutem oka. */}
            {unread > 0 && collapsed && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-pink" />
            )}
          </span>
          {!collapsed && (
            <>
              <span>Powiadomienia</span>
              {unread > 0 && (
                <span className="ml-auto rounded-full bg-brand-pink/20 px-1.5 text-[10px] font-semibold text-brand-pink">
                  {unread}
                </span>
              )}
            </>
          )}
        </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#62666d]">
              Powiadomienia
            </span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-muted hover:text-[var(--fg)]">
                Oznacz wszystkie
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-[12.5px] text-muted">
              {onlyUnread ? (
                <>
                  Wszystko przeczytane.
                  <br />
                  <span className="text-[11.5px]">Filtr „tylko nieprzeczytane" jest włączony.</span>
                </>
              ) : (
                <>
                  Nic się nie wydarzyło.
                  <br />
                  <span className="text-[11.5px]">Nowe zgłoszenia, poczta i płatności pojawią się tutaj.</span>
                </>
              )}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {visible.map((n) => (
                <button
                  key={n.id}
                  onClick={() => open(n, close)}
                  className={`flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-[#232327] ${
                    n.read_at ? "opacity-55" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-[#8a8f98]">
                    <NotificationIcon kind={n.kind} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[12.5px] leading-snug ${n.read_at ? "text-[#c7c9cd]" : "text-[#e9e9ea] font-medium"}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 block truncate text-[11.5px] text-[#8a8f98]">{n.body}</span>}
                    <span className="mt-0.5 block text-[10.5px] text-[#62666d]">{notificationAge(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Popover>

    {/* Menu dzwonka (Moduł 34). „Oznacz wszystkie" jest też w środku panelu —
        tu jest skrótem, żeby nie trzeba było go najpierw otwierać. Filtr
        „tylko nieprzeczytane" istnieje WYŁĄCZNIE tutaj. */}
    <ContextMenu ctl={bellCtl} width={240}>
      {(_item, close) => (
        <>
          <MenuLabel>Powiadomienia</MenuLabel>
          {unread > 0 && (
            <ContextMenuItem
              icon={<IconChecks size={14} />}
              label={`Oznacz wszystkie jako przeczytane (${unread})`}
              onClick={() => {
                close();
                void markAll();
              }}
            />
          )}
          <ContextMenuItem
            icon={<IconFilter size={14} />}
            label={onlyUnread ? "Pokaż wszystkie" : "Pokaż tylko nieprzeczytane"}
            onClick={() => {
              close();
              setOnlyUnread((v) => !v);
            }}
          />
        </>
      )}
    </ContextMenu>
    </>
  );
}
