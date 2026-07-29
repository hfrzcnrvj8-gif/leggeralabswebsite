"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { CostEditor } from "../CostEditor";

/** Podstrona kosztu — ADRES REKORDU (Moduł 59, paczka E).
 *
 * Ta sama zasada, co w Notatniku i Projektach: podstrona i modal renderują
 * DOKŁADNIE ten sam komponent, więc nie ma dwóch wersji profilu, które
 * z czasem się rozjadą. Różni je tylko wyjście — modal ma „✕", podstrona ma
 * link „wróć". */
export function CostDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/${lang}/admin/costs`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do kosztów
      </Link>
      <div className="card-paper mt-3 rounded-2xl border hairline p-5 sm:p-6">
        <CostEditor
          id={id}
          // Bez `onClose` w postaci „zamknij modal" — na podstronie nie ma czego
          // zamykać, więc krzyżyk cofa do listy. Usunięcie kosztu robi to samo:
          // rekord przestał istnieć, adres prowadziłby donikąd.
          onClose={() => router.push(`/${lang}/admin/costs`)}
          onDeleted={() => router.push(`/${lang}/admin/costs`)}
        />
      </div>
    </div>
  );
}
