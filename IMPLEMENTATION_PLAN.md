# Implementation Plan: Enhanced Signature Presentation

## Goals
- Always render the NumPy callable signature as a fenced code block with Python syntax highlighting.
- Provide a preference-controlled "floating" signature header that reappears once the user scrolls past the code block, without altering the initial static view.
- Suppress internal/private objects (names starting with `_` or `__`) from search results and detail views.

## Proposed Steps

1. **Signature Rendering Refactor**
   - Update `buildMarkdown` to consistently include a ```python fenced block for the signature, irrespective of the pin preference.
   - Ensure the returned markdown never duplicates the signature when the floating-header mode is active.

2. **Floating Header Experience**
   - Introduce a preference flag `floatSignatureHeader` (default `true`) to replace the existing `pinSignature` option.
   - Detect scroll state via `List.Item.Detail` metadata/markdown interplay: keep the signature in metadata only after the user scrolls beyond the code block by splitting the detail into two panes (primary markdown + secondary metadata that toggles based on selection state).
   - Prototype a stateful hook that listens to `List`'s `onSelectionChange` and maintains whether the item was scrolled; fallback plan if Raycast lacks scroll hooks: display a persistent signature metadata row styled to mimic a floating header while leaving the markdown code block in place.

3. **Python Syntax Highlighting**
   - Enforce ```python for signature blocks and audit other fenced blocks to avoid conflicting languages.
   - Add regression tests in `doc-detail.test.ts` that assert the markdown begins with ```python and that the signature string appears exactly once.

4. **Filter Private Members**
   - Adjust `dedupeAndFilter` (or `searchInventory`) to drop inventory entries whose `shortName` or segment after the last dot starts with `_`.
   - Update unit tests (new cases in `search.test.ts`) to confirm filtered results.

5. **Preference Migration & Manifest Cleanup**
   - Remove legacy `pinSignature` preference and add the new `floatSignatureHeader` with description/label.
   - Update `useDocDetail` consumers to respect the preference and surface it in the detail rendering logic.

6. **Documentation & Verification**
   - Refresh README/AGENTS with the new preference name and behaviour.
   - Run `npm run test`, `npm run dev` (manual verification of floating header behaviour), and update plan artifacts if additional work is discovered.

## Open Questions / Risks
- Raycast API may not expose scroll events; need to simulate floating behaviour using metadata plus layout tweaks.
- Hiding private members could remove legitimate public APIs that start with underscore; confirm with user whether to hide strictly names starting with `_` after the last dot or allow specific exceptions.
