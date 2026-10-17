# Agent guide: Brow Guess

Brow Guess is a phone-on-forehead party word game: a static, offline-first PWA (Vite + TypeScript, no framework). See `README.md` for the full project overview, scripts and structure. This file covers what an agent most often needs to do here.

## Ground rules

- Run `npm run verify` before committing. It is the same gate CI runs (lint, format, typecheck, purity, brand check, tests, build, dist check). Run `npx prettier --write <files>` on anything you touch.
- Commit straight to `main` with Conventional Commits (`feat(decks): …`). Pushing to `main` deploys to GitHub Pages.
- Game logic in `src/game/` must stay DOM-free (`npm run check:pure`).
- No third-party trademarks anywhere in the repo (`npm run check:brand`, pattern in `scripts/check-trademarks.sh`). Don't name the well-known commercial game this resembles, and avoid brand names (products, stores, games, TV shows) in deck words. The only exceptions are the two licensed-character decks, `harry-potter` and `superheroes`, which the owner approved.

## Adding a new deck (category)

A "deck" is a category on the home screen: one JSON file of words. Players see one word at a time on the forehead and their friends describe or act it out. There are no images: the deck's icon is an emoji, so a new deck adds only a few KB and works offline automatically (the JSON is bundled into the JS, which the service worker precaches).

### Steps

1. **Create `src/decks/<id>.json`.** The filename must equal `id` (kebab-case). Schema (`src/decks/types.ts`):

   ```json
   {
     "id": "gross-and-giggly",
     "title": "Gross & Giggly",
     "emoji": "🤢",
     "description": "Slimy, stinky, totally gross words. Ewww!",
     "color": "#4d7c0f",
     "words": ["Whoopee Cushion", "Brain Freeze", "..."]
   }
   ```

   Exactly these six keys, no others.

2. **Add the id to `DECK_ORDER` in `src/decks/index.ts`.** This is the display order on the home screen. A JSON file that is not listed there is a hard error at startup.

3. **Add the same id, at the same position, to `EXPECTED_IDS` in `tests/decks.test.ts`.** The test asserts the exact order and that every JSON file is listed.

4. **Keep the first three entries of `DECK_ORDER` unchanged** unless you also update `tests/flow/results-home.test.ts`, which plays `decks[2]`. Group new decks next to related ones (the kids' decks sit together after `kids-mix`).

5. **Run `npm run verify`**, then commit (e.g. `feat(decks): add <Title> deck`).

### What the tests enforce for every deck (`tests/decks.test.ts`)

| Rule          | Detail                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word count    | At least 40. Existing decks have **240**; match that.                                                                                                                                                                         |
| Word length   | 28 characters or fewer (the word must fit on a landscape phone in large type).                                                                                                                                                |
| Duplicates    | None, case- and whitespace-insensitive.                                                                                                                                                                                       |
| Colour        | `#rrggbb`, with white text contrast of at least 4.5:1 (WCAG AA). Darker shades (Tailwind 700 to 800) usually pass; 500 to 600 often don't.                                                                                    |
| Family safety | Title, description and words must not match the `UNSAFE` regex: alcohol, tobacco, drugs, weapons, violence, gambling, adult content, mild swears. Whole words only, so "Stink Bomb" or "Squirt Gun" fail but "Shell" is fine. |

Quick colour check before you write the file:

```sh
node -e 'const h=process.argv[1];const L=[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4});console.log((1.05/(0.2126*L[0]+0.7152*L[1]+0.0722*L[2]+0.05)).toFixed(2))' '#4d7c0f'
```

Print every existing colour with `for f in src/decks/*.json; do jq -r '.color + "  " + .id' "$f"; done` and pick one that looks clearly different on the home grid.

### Writing good words

The game only works if the person guessing can get the word in a few seconds from clues. When you pick words:

- **Make them guessable.** Use concrete, well-known things. Short phrases are fine, but keep them to 2 to 4 common words. Avoid obscure trivia and long sentences.
- **Make them easy to clue.** A friend should be able to describe or mime the word without saying it.
- **Fit the audience.** Write for the deck's target age (for example, `kids-mix` and `superheroes` are for young children, while `gross-and-giggly` and `ridiculous-mashups` are pitched at 9 to 11 year olds). Keep everything PG: gross-out humour is fine, but nothing mean, scary or adult.
- **Write original words.** Don't use brand, product, show or character names (they trip the brand check, date quickly and aren't ours). The owner approved two exceptions, `harry-potter` and `superheroes`. Don't add more licensed decks unless the owner asks for one.
- **Format consistently.** Use Title Case, no trailing punctuation and no emoji inside words.
- **Keep the description short.** It is one short, upbeat sentence and it shows on the deck card.
- **Draft in bulk and check.** Draft roughly 260 words, cut the weakest and check the list with the tests before committing. Also check the new words against every other deck: no word added today is shared with another deck.
