/** Il segno di Olaszóra: l'accento grave (`) di à è ì ò ù, sopra una linea di base. */
export function Mark({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M10.5 7.5 17.5 16" stroke="var(--hue)" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 22h14" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Marchio piccolo sopra il titolo, solo sul telefono (la sidebar è nascosta). */
export function PhoneBrand() {
  return (
    <div className="phone-brand">
      <Mark /> Olaszóra · Olasz
    </div>
  );
}
