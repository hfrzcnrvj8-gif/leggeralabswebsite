"use client";

/**
 * Ikony panelu (Moduł 33) — jedno źródło prawdy dla map „rodzaj → ikona".
 *
 * Dlaczego tutaj, a nie w `lib/` obok logiki: te mapy renderują JSX, a `lib/`
 * jest świadomie w 100 % `.ts` (czysta logika, bez Reacta). Dlaczego nie w
 * `<moduł>/shared.tsx`, jak każe wzorzec `StatusTag` z CLAUDE.md: te mapy są
 * współdzielone przez kilka modułów naraz — `ContactChannelIcon` renderuje 9
 * plików z czterech modułów (Leady, Klienci, Poczta, Quick-log), więc żaden z
 * nich nie jest jej właścicielem. Miejsce jak `Menu.tsx` / `LinkPicker.tsx` /
 * `NotificationBell.tsx`: korzeń `admin/`, czyli to, co ponadmodułowe.
 *
 * Osobny plik chroni też `lib/notifications.ts` — importuje go kliencki
 * dzwonek, więc nie wolno mu urosnąć o nic zbędnego (patrz ostrzeżenie w jego
 * nagłówku: zły import wywala build na „chunking context does not support
 * external modules", czego `tsc` NIE łapie).
 *
 * W `lib/` zostają typy i etykiety — tam ikon już nie ma.
 *
 * ZAKRES: to są ikony **systemowe** (afordancje panelu). Emoji wybierane przez
 * właściciela jako treść — `PROJECT_ICONS` w `lib/projects.ts`, czyli ikona
 * tożsamości projektu zapisana w bazie — świadomie ZOSTAJĄ emoji. Tak samo
 * wszystko, co wychodzi mailem (podpis, mail dzienny, szablony): w HTML-u maila
 * nie wyrenderujesz komponentu Reacta. Patrz CLAUDE.md → „Emoji vs ikony".
 */

import type { ComponentType } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconBell,
  IconBrandApple,
  IconBrandLinkedin,
  IconBrandPaypal,
  IconBrandWhatsapp,
  IconBuildingBank,
  IconCalendar,
  IconCalendarCheck,
  IconCash,
  IconCheck,
  IconClock,
  IconClockOff,
  IconCoin,
  IconCreditCard,
  IconDeviceMobile,
  IconEye,
  IconFileDescription,
  IconFileInvoice,
  IconFileText,
  IconFolder,
  IconHeartHandshake,
  IconBuildingEstate,
  IconInbox,
  IconLock,
  IconMail,
  IconMailbox,
  IconMessageCircle,
  IconNote,
  IconPhone,
  IconPhoneCall,
  IconPhoneOff,
  IconRadar,
  IconRepeat,
  IconScale,
  IconSend,
  IconSpeakerphone,
  IconSparkles,
  IconStar,
  IconTarget,
  IconThumbDown,
  IconTrash,
  IconUsers,
  IconVolumeOff,
  IconWriting,
  IconServer,
  IconCpu,
  IconDatabase,
  IconRouter,
  IconPlug,
  IconLicense,
  IconTool,
  IconLifebuoy,
  IconBox,
  IconWorld,
  IconHistory,
  IconBriefcase,
  IconMapPin,
  IconFlag,
} from "@tabler/icons-react";
import type { ContactChannel, CallOutcome } from "@/lib/contact";
import type { MailFolder, MailCategory } from "@/lib/mail";
import type { LinkKind } from "@/lib/links";
import type { NotificationKind } from "@/lib/notifications";
import type { PaymentMethod } from "@/lib/costs";
import type { CatalogCategory } from "@/lib/catalog";

/** Typ komponentu ikony Tablera — tyle, ile potrzebujemy z jego API.
 * `ComponentType`, bo Tabler oddaje `ForwardRefExoticComponent`, nie zwykłą
 * funkcję — sygnatura funkcyjna tu nie przejdzie. */
type TablerIcon = ComponentType<{ size?: number; className?: string }>;

/** Domyślny rozmiar: 14 px trafia w `w-4` kontenery menu i odznak. */
const DEFAULT_SIZE = 14;

/** Kanał kontaktu. Marki (WhatsApp/LinkedIn) świadomie logotypami — są
 * rozpoznawalne po kształcie nawet w monochromie; reszta neutralnie.
 * Decyzja właściciela 2026-07-17. */
const CONTACT_CHANNEL: Record<ContactChannel, TablerIcon> = {
  telefon: IconPhone,
  email: IconMail,
  whatsapp: IconBrandWhatsapp,
  linkedin: IconBrandLinkedin,
  spotkanie: IconUsers,
  inne: IconNote,
};

export function ContactChannelIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: ContactChannel | string;
  size?: number;
  className?: string;
}) {
  const Icon = CONTACT_CHANNEL[kind as ContactChannel] ?? IconNote;
  return <Icon size={size} className={className} />;
}

/** Wynik połączenia. Kolory zostają w CALL_OUTCOME_CLASS (konwencja
 * telefoniczna: zielony/czerwony) — ikona bierze je przez currentColor. */
const CALL_OUTCOME: Record<CallOutcome, TablerIcon> = {
  odebrane: IconPhoneCall,
  nieodebrane: IconPhoneOff,
};

export function CallOutcomeIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: CallOutcome | string;
  size?: number;
  className?: string;
}) {
  const Icon = CALL_OUTCOME[kind as CallOutcome] ?? IconPhoneCall;
  return <Icon size={size} className={className} />;
}

/** Kategoria komponentu katalogu (Moduł 47 — „wirtualny magazyn"). Klucze =
 * CATALOG_CATEGORIES z lib/catalog.ts. Ikona bierze kolor przez currentColor;
 * znaczenie niesie kategoria, nie barwa. */
const CATALOG_CATEGORY: Record<CatalogCategory, TablerIcon> = {
  compute: IconServer,
  gpu: IconCpu,
  storage: IconDatabase,
  siec: IconRouter,
  zasilanie: IconPlug,
  software: IconLicense,
  robocizna: IconTool,
  serwis: IconLifebuoy,
  inne: IconBox,
};

export function CatalogCategoryIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: CatalogCategory | string;
  size?: number;
  className?: string;
}) {
  const Icon = CATALOG_CATEGORY[kind as CatalogCategory] ?? IconBox;
  return <Icon size={size} className={className} />;
}

/** Zdarzenie na osi czasu klienta. Klucze = `kind` z bazy (zwykły tekst,
 * bez migracji przy dokładaniu rodzaju) — stąd `Record<string, …>` i
 * fallback. */
const CLIENT_EVENT: Record<string, TablerIcon> = {
  client_created: IconHeartHandshake,
  offer_created: IconFileDescription,
  offer_sent: IconSend,
  offer_accepted: IconCheck,
  offer_opened: IconEye,
  offer_rejected: IconThumbDown,
  offer_expired: IconClockOff,
  invoice_issued: IconFileInvoice,
  invoice_sent: IconSend,
  invoice_reminder: IconBell,
  payment_received: IconCoin,
  invoice_paid: IconCheck,
  invoice_dunning_sent: IconAlertTriangle,
  project_status_changed: IconFolder,
  nurture_scheduled: IconCalendar,
  contract_created: IconFileText,
  contract_sent: IconSend,
  contract_signed: IconWriting,
  nda_created: IconLock,
  review_requested: IconMailbox,
  review_collected: IconStar,
  nurture_contact_sent: IconRepeat,
};

/** `null` dla nieznanego rodzaju — wołający renderuje wtedy kropkę, jak
 * dawniej `CLIENT_EVENT_ICON[kind] ?? "•"`. */
export function ClientEventIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  const Icon = CLIENT_EVENT[kind];
  if (!Icon) return <span className="text-[10px] leading-none">•</span>;
  return <Icon size={size} className={className} />;
}

/** Dzwonek powiadomień — 11 rodzajów (trzy ostatnie dołożył Moduł 31).
 * Dobrane tak, żeby dało się czytać listę kątem oka: pieniądze/moneta,
 * poczta koperta, lead iskra. */
const NOTIFICATION: Record<NotificationKind, TablerIcon> = {
  lead_new: IconSparkles,
  mail_new: IconMail,
  mail_nudge: IconVolumeOff,
  invoice_paid: IconCoin,
  invoice_reminder: IconClock,
  invoice_dunning: IconScale,
  recurring_invoice: IconFileInvoice,
  recurring_cost: IconCreditCard,
  offer_accepted: IconHeartHandshake,
  offer_opened: IconEye,
  contract_signed: IconWriting,
  review_collected: IconStar,
  invite_response: IconCalendarCheck,
  lead_hunt: IconRadar,
};

export function NotificationIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: NotificationKind | string;
  size?: number;
  className?: string;
}) {
  const Icon = NOTIFICATION[kind as NotificationKind];
  if (!Icon) return <span className="text-[10px] leading-none">•</span>;
  return <Icon size={size} className={className} />;
}

/** Rodzaj celu linkowania (Moduł 12) — LinkPicker, NewDocumentDialog. */
const LINK_KIND: Record<LinkKind, TablerIcon> = {
  client: IconHeartHandshake,
  lead: IconTarget,
  project: IconFolder,
};

export function LinkKindIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: LinkKind;
  size?: number;
  className?: string;
}) {
  const Icon = LINK_KIND[kind];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

/** Metoda płatności kosztu. Kolory zostają w PAYMENT_METHOD_CLASS. */
const PAYMENT_METHOD: Record<PaymentMethod, TablerIcon> = {
  przelew: IconBuildingBank,
  karta: IconCreditCard,
  gotowka: IconCash,
  blik: IconDeviceMobile,
  paypal: IconBrandPaypal,
  apple_pay: IconBrandApple,
};

export function PaymentMethodIcon({
  method,
  size = DEFAULT_SIZE,
  className,
}: {
  method: PaymentMethod | string;
  size?: number;
  className?: string;
}) {
  const Icon = PAYMENT_METHOD[method as PaymentMethod];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

/** Folder skrzynki (Moduł 4). Chrome panelu, mimo że mieszkał w `lib/mail.ts`
 * obok treści wychodzącej — sidebar skrzynki nie trafia do żadnego maila.
 *
 * UWAGA, nie cofaj tego: Wysłane MUSI mieć inną sylwetkę niż Odebrane, a nie
 * odbitą strzałkę. Emoji 📥/📤 były tym samym piktogramem tacki różniącym się
 * tylko kierunkiem strzałki i w sidebarze nie dało się ich odróżnić — właściciel
 * zgłosił to w Module 4e (runda 6) i Wysłane dostało samolocik ✈️.
 * `IconInbox` (tacka) vs `IconSend` (samolot) trzyma tę decyzję.
 * Patrz HUB_SETUP.md → „Ikony Odebrane/Wysłane nie do odróżnienia". */
const MAIL_FOLDER: Record<MailFolder, TablerIcon> = {
  inbox: IconInbox,
  sent: IconSend,
  trash: IconTrash,
  archive: IconArchive,
};

export function MailFolderIcon({
  folder,
  size = DEFAULT_SIZE,
  className,
}: {
  folder: MailFolder;
  size?: number;
  className?: string;
}) {
  const Icon = MAIL_FOLDER[folder];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

/** Kategoria wiadomości ze screenera (Moduł 4, Etap 3) — chipy filtrów i
 * odznaka na wątku. Też chrome, też mieszkało w `lib/mail.ts`. */
const MAIL_CATEGORY: Record<MailCategory, TablerIcon> = {
  reklama: IconSpeakerphone,
  rachunek: IconFileInvoice,
  urzedowe: IconBuildingEstate,
  oferta: IconSparkles,
  inne: IconMessageCircle,
};

export function MailCategoryIcon({
  kind,
  size = DEFAULT_SIZE,
  className,
}: {
  kind: MailCategory;
  size?: number;
  className?: string;
}) {
  const Icon = MAIL_CATEGORY[kind];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

/** Ikona pola na wizytówce rekordu (runda czytelności 2026-07-26).
 *
 * Attio, Linear i Notion stawiają małą ikonę przed KAŻDĄ nazwą atrybutu —
 * po kilku wejściach przestaje się czytać etykiety i skanuje kształty.
 * Tutaj, a nie przy wywołaniach, bo tę samą listę pól ma profil leada
 * i profil klienta: dwie kopie rozjechałyby się przy pierwszym nowym polu.
 *
 * Klucz to `etykieta` wiersza — celowo tekst, nie osobny identyfikator:
 * `WierszPola` i tak ją dostaje, a dodatkowy identyfikator byłby trzecią
 * nazwą tego samego pola (obok kolumny w bazie i etykiety na ekranie).
 * Pole bez wpisu w tej mapie renderuje się bez ikony, nie pusto. */
const POLE_PROFILU: Record<string, TablerIcon> = {
  Telefon: IconPhone,
  Email: IconMail,
  WWW: IconWorld,
  LinkedIn: IconBrandLinkedin,
  "Ostatni kontakt": IconHistory,
  "Przypomnij mi": IconBell,
  "Następny krok": IconTarget,
  "Odzywaj się": IconRepeat,
  NIP: IconLicense,
  Branża: IconBriefcase,
  "Skąd przyszedł": IconRadar,
  Ulica: IconMapPin,
  "Kod / Miasto": IconBuildingEstate,
  Kraj: IconFlag,
};

export function PoleProfiluIcon({
  etykieta,
  size = DEFAULT_SIZE,
  className,
}: {
  etykieta: string;
  size?: number;
  className?: string;
}) {
  const Icon = POLE_PROFILU[etykieta];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}
