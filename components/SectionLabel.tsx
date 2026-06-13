export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
      <span className="h-px w-8 bg-gradient-to-r from-brand-purple to-brand-cyan" />
      {children}
    </span>
  );
}
