"use client";

/** Okno „dlaczego druga strona powiedziała nie" przeniosło się do korzenia
 * panelu (`app/[lang]/admin/RejectDialog.tsx`), bo od audytu Modułu 11 używają
 * go dwa moduły: Oferty i Umowy. Ten plik zostaje jako re-eksport, żeby nie
 * przepisywać importów w `OffersDashboard`/`OfferEditor`.
 *
 * Domyślne teksty i lista powodów są ofertowe (`OFFER_REJECT_REASONS`), więc
 * po stronie Ofert wywołanie nie zmienia się ani o znak. */
export { OknoOdrzucenia } from "../RejectDialog";
