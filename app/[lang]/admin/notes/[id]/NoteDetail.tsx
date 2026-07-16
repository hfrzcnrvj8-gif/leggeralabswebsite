"use client";

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { NoteDetailPanel } from "../NoteDetailPanel";

export function NoteDetail({ id, lang }: { id: string; lang: Locale }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/${lang}/admin/notes`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do notatnika
      </Link>
      <div className="mt-3">
        {/* Bez `onClose` — na podstronie nie ma czego zamykać, wyjściem jest
            link „wróć" wyżej. Ta sama zasada co w ProjectDetail. */}
        <NoteDetailPanel id={id} lang={lang} />
      </div>
    </div>
  );
}
