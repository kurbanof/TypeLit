# TypeLit

**Read · Learn · Type** — a local-first typing practice app built around books and study materials.

The first cut is a desktop-style installable web app. It needs no account or remote service. Imported texts and progress are kept in the browser's IndexedDB.

## Start

Double-click **Start TypeLit.bat**. It opens `index.html` directly in your default browser; no local server or network access is needed. The app stores the library and progress in that browser on this computer.

## Included

- Starter courses for Russian ЙЦУКЕН and English QWERTY, with a visual keyboard.
- Library view for books and study decks.
- Text extraction for TXT, FB2 and EPUB.
- APKG import for legacy SQLite packages (`collection.anki2` / `collection.anki21`), field selection, and ordered, shuffled or adaptive practice settings.
- CSV/TSV flashcard import.
- Separate typing field, faded completed text, error count, speed, accuracy, timer, and saved progress.
- Dark palettes, light mode, settings and local statistics.

## Current limitations

- New Anki packages containing only `collection.anki21b` use a compressed database format that this first cut does not yet decode. The app reports this clearly during import.
- Pixel Cyr Normal is referenced by its installed font name and is not bundled. Install it locally only if the font license permits that use. Long book text uses a readable serif font by default.
- This is a local browser prototype, not yet a signed Windows installer. Native desktop packaging can be added after the first design review.
