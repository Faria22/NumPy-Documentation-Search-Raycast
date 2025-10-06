# Repository Guidelines
This guide helps new contributors ship updates to the NumPy Documentation Search Raycast extension.

## Project Structure & Module Organization
- `src/numpy-docs.ts`: main command logic; keep additional utilities in `src/` as sibling modules.
- `assets/extension-icon.png`: Raycast marketplace icon; store future assets here and reference via `package.json`.
- Root configs such as `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc` govern build settings and linting. Avoid editing generated files in `raycast-env.d.ts`.

## Build, Test, and Development Commands
```bash
npm install
npm run dev
npm run build
npm run lint
npm run fix-lint
```
- `npm install`: installs Raycast SDK dependencies.
- `npm run dev`: launches `ray develop` for live-reloading the extension in Raycast.
- `npm run build`: validates and bundles via `ray build`; required before publishing.
- `npm run lint`: runs ESLint checks; `npm run fix-lint` applies safe autofixes.

## Coding Style & Naming Conventions
- TypeScript, ES2023 target, CommonJS modules, strict mode enabled.
- Prettier enforces 2-space indentation, 120-character line limit, and double quotes.
- Export commands with PascalCase names (`export const NumpyDocsCommand`), helpers with camelCase.
- Prefer async/await over promise chains; keep command entries small and delegate to helpers in `src/`.

## Testing Guidelines
- No automated test suite yet; rely on `npm run lint` and manual verification in Raycast.
- When adding logic, create lightweight functions that can be unit tested later with Jest or Vitest.
- Document manual test steps in PR descriptions (inputs tried, expected output) until automated coverage exists.

## Commit & Pull Request Guidelines
- Git history is not present in this workspace; follow conventional commits (`feat:`, `fix:`, `chore:`) for clarity.
- Ensure each PR includes a clear summary, screenshots or screen recordings of the command if UI changes, and links to relevant issues.
- Run `npm run lint` and `npm run build` before requesting review; mention results in the PR checklist.

## Raycast-Specific Tips
- Keep the command metadata in `package.json` synchronized with code behavior.
- Use `ray login` with your Raycast account before publishing, and never include API tokens in commits.
- Populate `CHANGELOG.md` with concise entries per release to ease marketplace submissions.
