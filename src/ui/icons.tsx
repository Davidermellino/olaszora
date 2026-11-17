// Icone outline 24×24, tratto 1.5, un solo set. Grigie: il colore lo dà il contenitore.
import type { ReactNode } from "react";

function Svg({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
      {children}
    </svg>
  );
}

export const IconToday = () => (
  <Svg><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M8 14h3" /></Svg>
);
export const IconCards = () => (
  <Svg><rect x="3.5" y="7" width="13" height="13" rx="2" /><path d="M7.5 4h11a2 2 0 0 1 2 2v11" /></Svg>
);
export const IconArena = () => (
  <Svg><path d="M5 4.5h14M5 19.5h14" /><path d="M9.5 8 7 16M15.5 8 13 16" /></Svg>
);
export const IconAssimil = () => (
  <Svg><path d="M12 6.5c-2-1.3-4.6-1.8-8-1.5v13c3.4-.3 6 .2 8 1.5 2-1.3 4.6-1.8 8-1.5V5c-3.4-.3-6 .2-8 1.5zM12 6.5v13" /></Svg>
);
export const IconErrors = () => (
  <Svg><path d="M4 5.5h16v10H9l-5 4z" /><path d="M12 8.5v3M12 13.5v.01" /></Svg>
);
export const IconSettings = () => (
  <Svg><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Svg>
);
export const IconClose = () => <Svg label="Bezárás"><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconCopy = () => (
  <Svg><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></Svg>
);
export const IconDownload = () => <Svg><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></Svg>;
export const IconUpload = () => <Svg><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" /></Svg>;
