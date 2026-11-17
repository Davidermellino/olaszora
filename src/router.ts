import { useEffect, useState } from "react";

/** Hash router minimo (GitHub Pages non riscrive le URL). "#/arena/A16" → ["arena", "A16"] */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, "").split("?")[0]!.split("/").filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function href(...parts: string[]): string {
  return "#/" + parts.map(encodeURIComponent).join("/");
}

export function go(...parts: string[]): void {
  location.hash = href(...parts);
}
