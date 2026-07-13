"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

type FormDict = Dictionary["cta"]["form"];
type Status = "idle" | "sending" | "success" | "error";
type FieldErrors = Partial<
  Record<"name" | "email" | "message" | "consent", boolean>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Formspree handles delivery + spam filtering, no custom backend needed.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xdarydza";

export function ContactForm({
  dict,
  lang,
}: {
  dict: FormDict;
  lang: Locale;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (form: HTMLFormElement): FieldErrors => {
    const data = new FormData(form);
    const next: FieldErrors = {};
    if ((data.get("name") as string).trim().length < 2) next.name = true;
    if (!EMAIL_RE.test((data.get("email") as string).trim())) next.email = true;
    if ((data.get("message") as string).trim().length < 10) next.message = true;
    if (!data.get("consent")) next.consent = true;
    return next;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("idle");
      return;
    }

    setErrors({});
    setStatus("sending");
    const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    // Best-effort: also store the submission in the internal lead registry
    // so it shows up in /admin/leads without manual entry. Non-blocking —
    // failures here must never affect the Formspree-driven UX below.
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firma: payload.company?.trim() || payload.name,
        osoba_kontaktowa: payload.name,
        email: payload.email,
        zrodlo_kategoria: "Formularz na stronie",
        status: "Nowe zgłoszenie ze strony",
        notatki: payload.message ?? "",
      }),
    }).catch(() => {});

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputBase =
    "w-full rounded-2xl bg-transparent px-4 py-3 text-[var(--fg)] placeholder:text-muted outline-none transition-colors";
  const fieldClass = (hasError?: boolean) =>
    `glass rounded-2xl border ${
      hasError ? "border-red-400/60" : "border-[var(--glass-border)]"
    } focus-within:border-brand-cyan/60`;

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass flex flex-col items-center gap-4 rounded-3xl px-8 py-12 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-cyan/15 text-2xl text-brand-cyan">
          ✓
        </span>
        <p className="max-w-sm text-lg">{dict.success}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="text-left">
      {/* Honeypot — Formspree's recognized field name for its built-in spam filter */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label>
          Website
          <input name="_gotcha" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            {dict.name}
          </label>
          <div className={fieldClass(errors.name)}>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={dict.namePlaceholder}
              className={inputBase}
            />
          </div>
          {errors.name && (
            <p className="mt-1.5 text-xs text-red-400">{dict.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            {dict.email}
          </label>
          <div className={fieldClass(errors.email)}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={dict.emailPlaceholder}
              className={inputBase}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-red-400">{dict.errors.email}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="company" className="mb-2 block text-sm font-medium">
          {dict.company}
        </label>
        <div className={fieldClass()}>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder={dict.companyPlaceholder}
            className={inputBase}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="message" className="mb-2 block text-sm font-medium">
          {dict.message}
        </label>
        <div className={fieldClass(errors.message)}>
          <textarea
            id="message"
            name="message"
            rows={5}
            placeholder={dict.messagePlaceholder}
            className={`${inputBase} resize-none`}
          />
        </div>
        {errors.message && (
          <p className="mt-1.5 text-xs text-red-400">{dict.errors.message}</p>
        )}
      </div>

      <div className="mt-6">
        <label className="flex items-start gap-3 text-left text-sm text-muted">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#7C3AED]"
          />
          <span>
            {dict.consent}{" "}
            <Link
              href={`/${lang}/privacy`}
              target="_blank"
              className="text-liquid underline-offset-2 hover:underline"
            >
              {dict.consentLink}
            </Link>
            .
          </span>
        </label>
        {errors.consent && (
          <p className="mt-1.5 text-xs text-red-400">{dict.consentError}</p>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-primary w-full rounded-full px-8 py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {status === "sending" ? dict.sending : dict.submit}
        </button>
        <AnimatePresence>
          {status === "error" && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-400"
              role="alert"
            >
              {dict.error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
