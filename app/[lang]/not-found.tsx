import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="orb pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[60vw] w-[60vw] max-h-[600px] max-w-[600px] -translate-x-1/2 -translate-y-1/2 animate-orb-float rounded-full"
        aria-hidden
      />
      <p className="text-liquid text-7xl font-semibold tracking-tightest sm:text-8xl">
        404
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        Strona nie istnieje · Page not found · Seite nicht gefunden
      </h1>
      <p className="mt-4 max-w-md text-muted">
        Adres, którego szukasz, mógł zostać przeniesiony lub nigdy nie istniał.
      </p>
      <Link
        href="/"
        className="btn-primary mt-10 inline-block rounded-full px-8 py-3.5 text-base font-semibold"
      >
        Strona główna · Home · Startseite
      </Link>
    </main>
  );
}
