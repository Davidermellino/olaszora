# Da controllare

Forme e scelte di cui non sono sicuro, o che conviene confermare.
Quando hai controllato una voce, cancellala (e correggi il file se serve).

## Chi parla (colonna «Ki» delle lezioni)
Le vecchie lezioni non dicevano chi parla: l'ho dedotto dal testo. Le voci di `content/audio/voices.json` seguono questi nomi. Se cambi un «Ki», `npm run audio` rigenera solo quella battuta.
- **L01**: Giovanni e Pietro si alternano (1 Giovanni, 2 Pietro…). Sicuro per 1–7; per 8–10 ho seguito l'alternanza.
- **L02**: la 13 (*Noi non siamo italiani…*) l'ho data al Professore; potrebbe dirla Pierino.
- **L03**: dialogo a domande e risposte tra Narratore (affermazioni e «No.») e Narratrice (domande). Nel testo non ci sono personaggi.
- **L05**: «Cliente» per tutte le battute del cliente. La 11 (*No, l'insalata non la vogliamo*) potrebbe dirla la moglie.
- **L06**: chi parla con Gigi non ha nome: l'ho chiamata «Donna». La 9 (il titolo del libro) è sempre Gigi.
- **L08**: la 4 (*È lì a sinistra, vicino alla finestra*) l'ho data al Cassiere, come la 7 e la 9; potrebbe essere un'altra persona della banca.
- **L11**: Studente 1 (domande, voce femminile) e Studente 2 (quello nervoso: il professore lo chiama *figliolo*, voce maschile).
- **L13**: tutto Narratore, anche la 9 (la domanda) e la 10 (*Sono fatti suoi*).
- **L07, L14** (ripassi): domande alla Narratrice e risposte al Narratore (L07); frasi alternate (L14).

## Voci
- Nella libreria ci sono solo due voci italiane maschili (Marco, Gabriele): il **Narratore** ha la voce di Ambra (femminile); **Cassiere**, **Dentista** e **Studente 1** sono voci femminili. Nei testi non cambia niente (nessuna loro battuta ha un maschile riferito a sé).

## Arena
- **A01-002 / A03-005 / A03-006**: la stessa frase (*Gli assegni sono falsi*) in tre esercizi, da tre lati diversi (articolo, plurale, numerale). Da variare quando ci saranno più parole.
- **A03-007** «A turisták fáradtak»: accetto *I turisti sono stanchi* e anche *Le turiste sono stanche* (✱ *turiste*, solo donne).
- **A04-006** «Budapest nagy város»: accetto *una città grande* e *una grande città*. Nella lezione 2 c'è *un paese grande*.
- **A04-002, A04-001**: *e* al posto di *è* il checker la dà 🟡 (solo l'accento), ma qui è un errore di grammatica (*e* = és). La spiegazione lo dice; se vuoi ❌ va cambiato il checker per i casi *e/è*.
- **A06-002** «Olvasod az újságot?»: la traduzione ungherese usa la coniugazione oggettiva (c'è l'articolo). Va bene così?
- **A07-006** *Io sto molto male* (dalla L10). Tra le opzioni c'è *sono*: *sono molto male* è sbagliato, ma qualcuno potrebbe pensarlo per «rosszul vagyok».
- **A09-003** *Vado dal dentista*: si dice anche *vado al dentista* (colloquiale). Tra le opzioni non c'è *al*, quindi la scelta resta univoca.
- Argomenti solo nel programma (⏳ in `ARENA_PROGRAMMA.md`): A02, A05, A08, A10–A14. Hanno già fonte, trappole e BOSS: gli esercizi si possono aggiungere senza cambiare il codice.

## Lezioni
- **Titoli ungheresi** con traduzione letterale tra parentesi (*Mi újság (Mit nekem mesélsz)? Semmi*): così erano nella vecchia app. Nell'elenco delle lezioni le parentesi si vedono.
- **Szótár**: la vecchia app aveva una scheda dizionario; l'app ungherese no, e quindi neanche la nuova. Le parole sono nelle tabelle «Szavak» e nelle carte.
