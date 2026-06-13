import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  // Honeypot — must stay empty for real humans.
  website?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: ContactPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Bot trap: if the hidden field is filled, pretend success and drop it.
  if (asString(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const name = asString(body.name);
  const email = asString(body.email);
  const company = asString(body.company);
  const message = asString(body.message);

  const errors: Record<string, true> = {};
  if (name.length < 2) errors.name = true;
  if (!EMAIL_RE.test(email)) errors.email = true;
  if (message.length < 10) errors.message = true;

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "validation", errors }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL ?? "hello@poltechnickx.com";
  const from = process.env.CONTACT_FROM_EMAIL ?? "poltechnickx <onboarding@resend.dev>";

  const subject = `New enquiry from ${name}${company ? ` (${company})` : ""}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : null,
    "",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // If no email provider is configured, log the lead and succeed so the form
  // is fully functional in development. Set RESEND_API_KEY to deliver email.
  if (!apiKey) {
    console.info("[contact] new submission (no RESEND_API_KEY set):\n" + text);
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, reply_to: email, subject, text }),
    });

    if (!res.ok) {
      console.error("[contact] resend error", res.status, await res.text());
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("[contact] send exception", err);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
