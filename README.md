# Olaszóra

Lezioni di italiano in stile Assimil per chi parla ungherese: dialoghi con traduzione, esercizi con correzione e flashcard.
Sito statico (un solo `index.html`, nessun build step): Vercel lo pubblica così com'è.

- `index.html` – la pagina completa (dati delle lezioni inclusi in `<script id="data">`).
- I progressi (lezioni fatte, flashcard) restano nel `localStorage` del browser di chi la usa.

Ogni push su `main` → Vercel ripubblica automaticamente.
