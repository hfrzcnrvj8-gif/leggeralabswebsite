"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { buildMailSrcDoc } from "@/lib/mailHtml";

/**
 * Treść maila w HTML — w <iframe sandbox>, czyli w piaskownicy.
 *
 * Druga (i najważniejsza) warstwa obrony obok odkażania w lib/mailHtml.ts:
 * `sandbox=""` bez `allow-scripts` i bez `allow-same-origin` oznacza, że
 * zawartość ramki nie może wykonać żadnego skryptu ani sięgnąć do panelu i
 * jego ciasteczka sesji. Nawet gdyby odkażanie coś przepuściło, tu jest
 * ślepy zaułek. `allow-popups` jest potrzebne, żeby klik w link otwierał
 * kartę — to jedyne odstępstwo i nie daje dostępu do niczego.
 *
 * Świadomie <iframe srcdoc>, a NIE dangerouslySetInnerHTML: wstrzyknięcie
 * cudzego HTML-a wprost do drzewa panelu odziedziczyłoby jego origin i style,
 * czyli dokładnie to, czego chcemy uniknąć.
 */
export function MailBodyHtml({ html, blockedImages, onShowImages }: { html: string; blockedImages: boolean; onShowImages: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const [height, setHeight] = useState(460);
  const [rozwiniete, setRozwiniete] = useState(false);

  // Ramka jest odizolowana, więc nie może sama zgłosić swojej wysokości
  // (to wymagałoby skryptu w środku, czyli allow-scripts — a na to się nie
  // godzimy). Nie da się jej też zmierzyć z zewnątrz: bez allow-same-origin
  // `contentDocument` jest dla nas niedostępny. Świadomy kompromis:
  // bezpieczeństwo > idealne dopasowanie.
  //
  // Zostaje więc oszacowanie z długości HTML-a — ale WYRAŹNIE wyższe niż
  // pierwotne 240/400/560 px. Tamte wartości sprawiały, że newsletter oglądało
  // się przez szparę i trzeba go było przewijać w środku ramki, co właściciel
  // opisał jako „za małe, skurczone, nieczytelne" (2026-07-19). Do tego
  // dochodzi ręczne rozwinięcie: skoro nie umiemy zmierzyć, niech decyduje
  // człowiek — jedno kliknięcie zamiast przewijania w szparze.
  useEffect(() => {
    setHeight(html.length > 8000 ? 760 : html.length > 4000 ? 640 : html.length > 1200 ? 520 : 340);
  }, [html]);

  const srcDoc = buildMailSrcDoc(html, resolvedTheme === "dark");

  return (
    <div className="space-y-2">
      {blockedImages && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border hairline bg-[var(--hairline)]/30 px-3 py-2 text-[12px]">
          <span className="text-muted">Obrazki zablokowane — zdalne obrazki zdradzają nadawcy, że otworzyłeś maila.</span>
          <button onClick={onShowImages} className="rounded-full border hairline px-2 py-0.5 hover:bg-[var(--hairline)]">
            Pokaż obrazki
          </button>
        </div>
      )}
      {/* Ramka dookoła (padding + delikatny cień) łagodzi przejście z
          ciemnego UI panelu do treści maila — ta zwykle ma WŁASNE, wpisane w
          HTML białe tło (faktury/stopki/newslettery), którego świadomie NIE
          wymuszamy na ciemno (tak samo robi Apple Mail/Gmail — nie
          przemalowują cudzej treści). To wyłącznie kosmetyka wokół, nie
          zmiana samego renderowania (patrz buildMailSrcDoc, lib/mailHtml.ts). */}
      <div className="rounded-2xl border hairline bg-[var(--hairline)]/10 p-2">
        <iframe
          ref={ref}
          srcDoc={srcDoc}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          title="Treść wiadomości"
          className="w-full rounded-xl border hairline bg-white shadow-sm dark:bg-[#141414]"
          style={{ height: rozwiniete ? "85vh" : height }}
        />
        <div className="flex justify-center pt-1.5">
          <button
            onClick={() => setRozwiniete((v) => !v)}
            className="rounded-full border hairline px-3 py-0.5 text-[12px] text-muted hover:bg-[var(--hairline)]"
          >
            {rozwiniete ? "Zmniejsz podgląd" : "Pokaż całość"}
          </button>
        </div>
      </div>
    </div>
  );
}
