/**
 * Audyt zmian pól (Moduł 23) — czysta logika, bez "use client".
 *
 * Odpowiada na pytanie „kiedy i z czego na co zmieniłem to pole", którego
 * panel dotąd nie umiał zadać: PATCH-e nadpisywały wartość w miejscu, a stara
 * znikała bez śladu.
 *
 * Panel jest jednoosobowy — świadomie nie zapisujemy „kto", bo to zawsze ten
 * sam człowiek (patrz createAuditSchema() w lib/db.ts).
 *
 * Ten plik NIE MOŻE importować `lib/db` — konwencja modułów (patrz
 * lib/clients.ts, lib/leads.ts): `lib/<moduł>.ts` jest współdzielone z UI, a
 * `lib/db` ciągnie `node:async_hooks`, który wysadza build komponentu
 * klienckiego („chunking context does not support external modules"). Zapis i
 * odczyt z bazy mieszkają obok, w `lib/auditLog.ts` (serwer), tak jak
 * mailSync.ts czy contactLookup.ts.
 */

export type AuditEntity = "client" | "lead";

export type FieldChange = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

/** Ile znaków wartości pokazujemy w logu, zanim zwiniemy resztę pod
 * „pokaż całość". Pełna treść leci do bazy — to limit WYŚWIETLANIA
 * (decyzja właściciela 2026-07-17), używany po stronie UI. */
export const AUDIT_PREVIEW_CHARS = 80;

/** Górny limit tego, co w ogóle trafia do logu — równy najdłuższemu polu,
 * jakie PATCH-e przyjmują (`notatki`, 4000 znaków). Zabezpieczenie przed
 * wpisem, który sam waży więcej niż rekord, którego dotyczy. */
const MAX_STORED = 4000;

/** Polskie nazwy pól — log ma być czytelny dla właściciela, a nie pokazywać
 * `linkedin_url` czy `zrodlo_kategoria` wprost z bazy. Pole spoza mapy
 * wyświetli się pod swoją techniczną nazwą (lepsze niż ukrycie zmiany). */
const CLIENT_FIELD_LABEL: Record<string, string> = {
  nazwa: "Nazwa",
  nip: "NIP",
  branza: "Branża",
  telefon: "Telefon",
  email: "Email",
  www: "WWW",
  linkedin_url: "LinkedIn",
  ulica: "Ulica",
  kod: "Kod pocztowy",
  miasto: "Miasto",
  kraj: "Kraj",
  status: "Status",
  notatki: "Notatka przypięta",
  ostatni_kontakt: "Ostatni kontakt",
  next_followup: "Przypomnij mi",
  next_action: "Następny krok",
};

const LEAD_FIELD_LABEL: Record<string, string> = {
  firma: "Firma",
  osoba_kontaktowa: "Osoba kontaktowa",
  branza: "Branża",
  kontakt: "Kontakt",
  telefon: "Telefon",
  email: "Email",
  www: "WWW",
  linkedin_url: "LinkedIn",
  ulica: "Ulica",
  kod: "Kod pocztowy",
  miasto: "Miasto",
  kraj: "Kraj",
  status: "Status",
  notatki: "Notatka przypięta",
  zrodlo_kategoria: "Źródło — kategoria",
  zrodlo: "Źródło — szczegóły",
  ostatni_kontakt: "Ostatni kontakt",
  next_followup: "Przypomnij mi",
  next_action: "Następny krok",
  client_id: "Powiązany klient",
};

export function auditFieldLabel(entity: AuditEntity, field: string): string {
  const map = entity === "client" ? CLIENT_FIELD_LABEL : LEAD_FIELD_LABEL;
  return map[field] ?? field;
}
