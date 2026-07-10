"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { ProjectDetailPanel } from "../ProjectDetailPanel";

export function ProjectDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/${lang}/admin/projects`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do tablicy
      </Link>
      <ProjectDetailPanel id={id} onDeleted={() => router.push(`/${lang}/admin/projects`)} />
    </div>
  );
}
