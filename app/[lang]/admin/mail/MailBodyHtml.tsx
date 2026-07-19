"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

  /**
   * Podgląd ma WYPEŁNIAĆ miejsce, które zostało, a nie być małym kwadratem
   * pośrodku (zgłoszenie właściciela 2026-07-19).
   *
   * Wysokości nie da się wpisać w CSS-ie na sztywno: ramka wisi raz na
   * osobnej podstronie, raz w widoku dzielonym obok listy, więc jej odległość
   * od góry ekranu za każdym razem jest inna, a `100vh` nie umie odjąć „tego,
   * co nade mną". Mierzymy więc własną pozycję — to NASZ element, nie wnętrze
   * piaskownicy, więc nie ma to nic wspólnego z izolacją cudzego HTML-a.
   */
  useLayoutEffect(() => {
    const przelicz = () => {
      const el = ref.current;
      if (!el) return;
      const gora = el.getBoundingClientRect().top;
      // 28 px oddechu na przycisk pod ramką i margines karty.
      const dostepne = window.innerHeight - gora - 28;
      setHeight(Math.max(320, Math.round(dostepne)));
    };
    przelicz();
    window.addEventListener("resize", przelicz);
    // Pozycja ramki zmienia się też, gdy nad nią coś urośnie (baner obrazków,
    // rozwinięty wątek) — `ResizeObserver` na karcie łapie to bez zgadywania.
    const obserwator = new ResizeObserver(przelicz);
    if (ref.current?.parentElement) obserwator.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener("resize", przelicz);
      obserwator.disconnect();
    };
  }, [html, blockedImages]);

  // Ile treści jest W ŚRODKU ramki — tego nadal nie wiemy i wiedzieć nie
  // będziemy: zgłoszenie własnej wysokości wymagałoby skryptu w piaskownicy
  // (allow-scripts), a zmierzenie jej z zewnątrz — dostępu do jej dokumentu
  // (allow-same-origin). Na żadne z dwojga się nie godzimy.
  //
  // Dlatego domyślnie wypełniamy dostępne miejsce (wyżej), a długie
  // newslettery przewijają się w środku ramki — dokładnie jak panel czytania
  // w Outlooku czy Apple Mail. Przycisk niżej daje wyjście awaryjne dla tych
  // naprawdę długich: rozwija ramkę tak, że przewija się cała strona.

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
          style={{ height: rozwiniete ? height * 3 : height }}
        />
        <div className="flex justify-center pt-1.5">
          <button
            onClick={() => setRozwiniete((v) => !v)}
            className="rounded-full border hairline px-3 py-0.5 text-[12px] text-muted hover:bg-[var(--hairline)]"
          >
            {rozwiniete ? "Dopasuj do okna" : "Rozwiń długi mail"}
          </button>
        </div>
      </div>
    </div>
  );
}
