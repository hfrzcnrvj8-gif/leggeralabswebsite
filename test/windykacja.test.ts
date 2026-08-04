import { test } from "node:test";
import assert from "node:assert/strict";
import {
  poziomyWindykacji,
  wiadomosciPrzedWezwaniem,
  frazaOWczesniejszychPismach,
  reminderEmailText,
  dunningEmailText,
} from "../lib/invoices.ts";
import { powitanie, wolaczImienia, stopkaMaila, zlozMail } from "../lib/kopertaMaila.ts";

// Krok 2 planu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` — znaleziska A4, A5, C2, D3.
//
// Testy stoją na DOSŁOWNYCH zdaniach, które w drugim przejściu wyszły do
// klienta (patrz `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`), a nie na parafrazie:
// „to już druga wiadomość w tej sprawie" przy `reminder_level = 0` i „pomimo
// wcześniejszych przypomnień" na formalnym wezwaniu, do którego nikt nigdy nie
// napisał. Zdanie sprawdzone parafrazą przechodzi także wtedy, gdy szablon
// mówi coś innego, byle podobnego — lekcja z [[regula-milczala-na-swoim-przypadku]].

const KOPERTA = {
  osoba: "Karolina Bąk",
  podpis: { imie: "Patryk Piecyk", email: "kontakt@leggeralabs.pl", telefon: "+48 123 456 789" },
  firma: "Leggera Labs",
};
const BAZA = { numer: "FV 93/2026", brutto: 13530, waluta: "PLN", terminPlatnosci: "2026-07-21", url: "https://x/f/t" };

// ── A4: treść wynika z historii, nie z dni zwłoki ──────────────────────────

test("A4: pierwsza wiadomość NIE twierdzi, że jest druga (poziom 2, historia pusta)", () => {
  const { subject, text } = reminderEmailText(2, { ...BAZA, wyslanoWczesniej: 0, koperta: KOPERTA });
  assert.ok(!text.includes("druga wiadomość"), `zdanie o drugiej wiadomości wróciło:\n${text}`);
  assert.ok(!subject.includes("Druga prośba"), `temat kłamie: ${subject}`);
  assert.ok(!text.includes("nadal"), `„nadal" zakłada wcześniejszy kontakt:\n${text}`);
  assert.equal(subject, "Prośba o płatność — faktura FV 93/2026 po terminie");
});

test("A4: druga wiadomość MÓWI, że jest druga", () => {
  const { subject, text } = reminderEmailText(2, { ...BAZA, wyslanoWczesniej: 1, koperta: KOPERTA });
  assert.ok(text.includes("to już druga wiadomość w tej sprawie"), text);
  assert.equal(subject, "Druga prośba o płatność — faktura FV 93/2026 po terminie");
});

test("A4: trzecia i dalsze liczą się dalej, nie zatrzymują na „drugiej”", () => {
  assert.ok(reminderEmailText(1, { ...BAZA, wyslanoWczesniej: 2 }).text.includes("to już trzecia wiadomość"));
  // Powyżej szóstej przestajemy licytować.
  assert.ok(reminderEmailText(1, { ...BAZA, wyslanoWczesniej: 9 }).text.includes("to już kolejna wiadomość"));
});

test("A4: wezwanie bez historii nie powołuje się na przypomnienia", () => {
  const bez = dunningEmailText({ ...BAZA, dni: 48, odsetki: 0, reference: "WZ-2026-B53FDF", wyslanoWczesniej: 0, koperta: KOPERTA });
  assert.ok(!bez.text.toLowerCase().includes("pomimo"), bez.text);
  const z = dunningEmailText({ ...BAZA, dni: 48, odsetki: 0, reference: "WZ-2026-B53FDF", wyslanoWczesniej: 2, koperta: KOPERTA });
  assert.ok(z.text.includes("pomimo wcześniejszych przypomnień"), z.text);
});

test("A4: jedno wcześniejsze pismo to liczba POJEDYNCZA", () => {
  assert.equal(frazaOWczesniejszychPismach(0), null);
  assert.equal(frazaOWczesniejszychPismach(1), "Pomimo wcześniejszego przypomnienia");
  assert.equal(frazaOWczesniejszychPismach(2), "Pomimo wcześniejszych przypomnień");
});

test("A4: liczymy wiadomości WCZEŚNIEJSZE niż wezwanie, nie wszystkie", () => {
  const wezwanie = "2026-08-04 12:00:00+02";
  const historia = [
    { sent_at: "2026-07-25 09:00:00+02" }, // przed wezwaniem
    { sent_at: "2026-08-01 09:00:00+02" }, // przed wezwaniem
    { sent_at: "2026-08-04 12:00:01+02" }, // wpis SAMEGO wezwania — nie liczy się
  ];
  assert.equal(wiadomosciPrzedWezwaniem(historia, wezwanie), 2);
  assert.equal(wiadomosciPrzedWezwaniem([], wezwanie), 0);
  assert.equal(wiadomosciPrzedWezwaniem(historia, null), 0);
});

// ── A5: daty po polsku, nie z bazy ─────────────────────────────────────────

test("A5: żaden szablon mailowy nie wypuszcza surowej daty ISO", () => {
  const teksty = [
    reminderEmailText(1, { ...BAZA, koperta: KOPERTA }).text,
    reminderEmailText(2, { ...BAZA, wyslanoWczesniej: 1, koperta: KOPERTA }).text,
    dunningEmailText({ ...BAZA, dni: 48, odsetki: 12.5, reference: "WZ-2026-B53FDF", koperta: KOPERTA }).text,
  ];
  for (const t of teksty) {
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(t), `surowa data ISO w mailu:\n${t}`);
    assert.ok(t.includes("21.07.2026"), `brak daty po polsku:\n${t}`);
  }
});

// ── C2: wybór poziomu ──────────────────────────────────────────────────────

test("C2: dwa miesiące zwłoki, nic nie wysłano → wolno wysłać ŁAGODNE", () => {
  // Dokładnie FV 94/2026 z drugiego przejścia: 48 dni po terminie, historia
  // pusta, a jedyną dostępną drogą było formalne wezwanie do zapłaty.
  const p = poziomyWindykacji({ termin_platnosci: "2000-01-01", reminder_level: 0 });
  assert.deepEqual(p.dozwolone, [1, 2, 3]);
  assert.equal(p.sugerowany, 3);
  assert.equal(p.minimum, 1);
});

test("C2: eskalacja nie cofa się poniżej już wysłanego", () => {
  const p = poziomyWindykacji({ termin_platnosci: "2000-01-01", reminder_level: 2 });
  assert.deepEqual(p.dozwolone, [2, 3]);
  assert.equal(p.minimum, 2);
  const poWezwaniu = poziomyWindykacji({ termin_platnosci: "2000-01-01", reminder_level: 3 });
  assert.deepEqual(poWezwaniu.dozwolone, [3]);
});

test("C2: ręczne kliknięcie przed progiem +3 dni wysyła poziom 1, nie zero", () => {
  const p = poziomyWindykacji({ termin_platnosci: "2100-01-01", reminder_level: 0 });
  assert.equal(p.sugerowany, 1);
  assert.deepEqual(p.dozwolone, [1, 2, 3]);
});

// ── D3: mail zna klienta i nas ─────────────────────────────────────────────

test("D3: wołacz odmienia imiona na -a, reszty nie kaleczy", () => {
  assert.equal(wolaczImienia("Karolina Bąk"), "Karolino");
  assert.equal(wolaczImienia("Anna"), "Anno");
  assert.equal(wolaczImienia("Kuba"), "Kubo");
  assert.equal(wolaczImienia("Piotr Nowak"), "Piotr");
  assert.equal(wolaczImienia("Pani Karolina"), "Karolino");
});

test("D3: pole, z którego nie da się wyłuskać imienia, nie daje powitania", () => {
  assert.equal(wolaczImienia(""), null);
  assert.equal(wolaczImienia(null), null);
  assert.equal(wolaczImienia("biuro@firma.pl"), null);
  assert.equal(wolaczImienia("A."), null);
  assert.equal(powitanie(null), "Dzień dobry,");
  assert.equal(powitanie("Karolina Bąk"), "Dzień dobry, Karolino,");
});

test("D3: podpis to człowiek i firma, nie sama firma w liczbie mnogiej", () => {
  assert.deepEqual(stopkaMaila(KOPERTA, "zwykly"), [
    "Pozdrawiam,",
    "Patryk Piecyk",
    "Leggera Labs",
    "kontakt@leggeralabs.pl · +48 123 456 789",
  ]);
  assert.deepEqual(stopkaMaila(KOPERTA, "formalny")[0], "Z poważaniem,");
});

test("D3: jednoosobowa działalność nie jąka się nazwiskiem w podpisie", () => {
  // Nazwa firmy JDG zawiera imię i nazwisko właściciela — bez tej reguły
  // podpis wychodził „Patryk Piecyk / Leggera Labs Patryk Piecyk".
  assert.deepEqual(stopkaMaila({ ...KOPERTA, firma: "Leggera Labs Patryk Piecyk" }, "zwykly"), [
    "Pozdrawiam,",
    "Leggera Labs Patryk Piecyk",
    "kontakt@leggeralabs.pl · +48 123 456 789",
  ]);
});

test("D3: brak danych podpisu nie wstawia nawiasu ani zmyślonego imienia", () => {
  assert.deepEqual(stopkaMaila({ osoba: null, podpis: null, firma: "Leggera Labs" }), ["Pozdrawiam,", "Leggera Labs"]);
  const goly = stopkaMaila({ osoba: null, podpis: null, firma: "" });
  assert.deepEqual(goly, ["Pozdrawiam,"]);
  assert.ok(!goly.join("\n").includes("["), "nawias z A1 wrócił");
});

test("D3: wezwanie i stanowcze przypomnienie idą tonem formalnym", () => {
  assert.ok(reminderEmailText(2, { ...BAZA, koperta: KOPERTA }).text.includes("Z poważaniem,"));
  assert.ok(dunningEmailText({ ...BAZA, dni: 48, odsetki: 0, reference: "WZ", koperta: KOPERTA }).text.includes("Z poważaniem,"));
  assert.ok(reminderEmailText(1, { ...BAZA, koperta: KOPERTA }).text.includes("Pozdrawiam,"));
});

test("D3: żaden mail nie zaczyna się od gołego „Dzień dobry,”, gdy znamy osobę", () => {
  for (const t of [
    reminderEmailText(1, { ...BAZA, koperta: KOPERTA }).text,
    reminderEmailText(2, { ...BAZA, koperta: KOPERTA }).text,
    dunningEmailText({ ...BAZA, dni: 1, odsetki: 0, reference: "WZ", koperta: KOPERTA }).text,
  ]) {
    assert.ok(t.startsWith("Dzień dobry, Karolino,"), t.slice(0, 60));
    assert.ok(!t.includes("Pozdrawiamy"), `liczba mnoga wróciła:\n${t}`);
  }
});

test("koperta składa mail bez zlepiania akapitów", () => {
  assert.equal(
    zlozMail({ osoba: "Anna", podpis: null, firma: "Leggera Labs" }, "zwykly", ["pierwszy akapit.", "", "drugi akapit."]),
    ["Dzień dobry, Anno,", "", "pierwszy akapit.", "", "drugi akapit.", "", "Pozdrawiam,", "Leggera Labs"].join("\n")
  );
});
