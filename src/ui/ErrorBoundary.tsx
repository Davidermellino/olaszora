import { Component, type ReactNode } from "react";

/**
 * Se una schermata va in errore (per esempio una lettura del database che fallisce),
 * mostra il messaggio al posto della schermata invece di lasciare l'app bianca.
 * `resetKey`: quando cambia (cambio di schermata) l'errore si azzera.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="panel" role="alert" style={{ display: "grid", gap: 12, margin: "16px 0" }}>
        <h2 style={{ fontSize: 20, lineHeight: "28px", fontWeight: 500 }}>Ez a képernyő nem töltődött be</h2>
        <p className="muted">A haladásod nem sérült. Próbáld újra; ha megint előfordul, küldd el az alábbi szöveget.</p>
        <p className="muted" style={{ fontSize: "var(--fs-small)", wordBreak: "break-word" }}>Hiba: {String(error.message || error)}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => location.reload()}>Újra</button>
          <button className="btn secondary" onClick={() => window.__arenaReset?.()}>Az alkalmazás visszaállítása</button>
        </div>
      </div>
    );
  }
}
