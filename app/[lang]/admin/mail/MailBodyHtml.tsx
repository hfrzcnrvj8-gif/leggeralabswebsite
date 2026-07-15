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
  const [height, setHeight] = useState(240);

  // Ramka jest odizolowana, więc nie może sama zgłosić swojej wysokości
  // (to wymagałoby skryptu w środku, czyli allow-scripts — a na to się nie
  // godzimy). Mierzymy ją więc z zewnątrz: to ten sam origin (srcdoc), tylko
  // bez allow-same-origin dokument jest dla nas nieczytelny... dlatego
  // ograniczamy się do sensownego maksimum i pozwalamy ramce scrollować się
  // w środku. Świadomy kompromis: bezpieczeństwo > idealne dopasowanie.
  useEffect(() => {
    setHeight(html.length > 4000 ? 560 : html.length > 1200 ? 400 : 240);
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
      <iframe
        ref={ref}
        srcDoc={srcDoc}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        title="Treść wiadomości"
        className="w-full rounded-xl border hairline bg-white dark:bg-[#141414]"
        style={{ height }}
      />
    </div>
  );
}
