"use client";

import { IconUnlink } from "@tabler/icons-react";

/** Ekran dla drugiej strony po unieważnieniu linku (Moduł 40, odpowiedź 410).
 *
 * Świadomie NIE mówi „nie znaleziono": dokument istnieje, tylko dostęp
 * odebrano. Odbiorca ma wiedzieć, że nie pomylił adresu i że jest sens
 * odezwać się po nowy link — inaczej pisze „Państwa link nie działa".
 *
 * Po polsku, tak jak istniejący ekran „nie znaleziono" w komponentach
 * wydruku: języka dokumentu nie da się odczytać, skoro nie wydajemy jego
 * treści. Mieszka w korzeniu `admin/` (jak icons.tsx), bo dzieli go pięć
 * stron publicznych z czterech modułów.
 */
export function LinkRevokedNotice({ dokument }: { dokument: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <IconUnlink size={20} />
        </div>
        <h1 className="text-[17px] font-semibold tracking-tight text-neutral-900">Ten link został unieważniony</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-600">
          {dokument} nadal istnieje, ale wystawca odebrał dostęp przez ten adres. Jeśli nadal potrzebujesz dostępu, poproś wystawcę o nowy link.
        </p>
      </div>
    </div>
  );
}
