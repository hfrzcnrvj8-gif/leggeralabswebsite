import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <p className="text-liquid font-serif text-7xl font-semibold tracking-tight sm:text-8xl">
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
        className="btn-cta mt-10 inline-block rounded-full px-8 py-3.5 text-base font-semibold"
      >
        Strona główna · Home · Startseite
      </Link>
    </main>
  );
}
