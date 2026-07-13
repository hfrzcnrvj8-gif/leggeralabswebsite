// pdfjs-dist nie publikuje typów dla tego pod-modułu (importujemy go tylko
// żeby ręcznie zarejestrować worker w tym samym wątku — patrz lib/pdf-render.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
