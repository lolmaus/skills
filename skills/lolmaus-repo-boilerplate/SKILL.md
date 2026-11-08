---
name: lolmaus-repo-boilerplate
description: Scaffold a single-package pnpm codebase with Oxlint, Oxfmt, strict environment-specific TypeScript configs, commitlint, and Git hooks.
license: MIT
compatibility: Requires pnpm
metadata:
  author: Andrey Mikhaylov (@lolmaus)
---

Scaffold a boilerplate for a single-package codebase using pnpm.

Use the following instructions as defaults. User's request overrides the defaults.

Work from the project's root folder. Create only tooling initially; add applications, libraries, or frameworks when requested. When working in an existing codebase, merge configuration and preserve existing source files and scripts.

Prefer `.mts` extension and corresponding module format for configs where applicable. Use `type: "module"` for the generated package manifest.

Use exact version numbers for external `dependencies` and `devDependencies`. Declare tools and environment-specific type dependencies directly in the project's manifest.

## Runtime and package manager

- Use `pnpm --version` to check pnpm's version. If pnpm is unavailable or below `11.0.0`, report failure and stop.

- Read the pinned Node version from `.nvmrc` in the project root. If `.nvmrc` does not exist, learn the current Node release by running:

  ```sh
  curl -fsSL https://nodejs.org/dist/index.tab | awk 'NR == 2 {sub(/^v/, "", $1); print $1}'
  ```

  Pin the learned version by writing it into `.nvmrc`.

- Check the available Node version with `node --version`. If Node is unavailable or its version does not match `.nvmrc`, report failure, ask the user to switch to the pinned version using a Node version manager of choice, then stop.

- Create a minimal root `package.json`. Use the project folder name as its name, version `0.1.0`, and `private: true`.

- Learn the latest stable pnpm version by running:

  ```sh
  curl -fsSL https://registry.npmjs.org/pnpm/latest | jq -r '.version'
  ```

  Pin that exact version in `package.json`, substituting the learned version:

  ```json
  {
    "devEngines": {
      "packageManager": {
        "name": "pnpm",
        "version": "12.0.0",
        "onFail": "download"
      }
    }
  }
  ```

## Linting and formatting

- Install `oxlint`, `oxfmt`, `typescript`, `@commitlint/cli`, `@commitlint/config-conventional`, and `lefthook` as dev dependencies using `pnpm add --save-dev --save-exact`. Keep a single root `pnpm-lock.yaml`.

- Create root `oxlint.config.mts` and `oxfmt.config.mts` files, each exporting an empty config wrapped in `defineConfig` from the respective package. For example, `oxlint.config.mts`:

  ```ts
  import { defineConfig } from "oxlint";

  export default defineConfig({});
  ```

  Keep the default rules and formatting settings without customizations.

- Configure root scripts that invoke the tools directly:

  ```json
  {
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "oxfmt --check .",
    "format:fix": "oxfmt --write ."
  }
  ```

## TypeScript configuration

- Create a root `tsconfig.base.json` with modern compiler settings and maximum strictness. Enable `strict` and additional checks for unchecked indexed access, exact optional properties, unused code, implicit returns and overrides, and switch fallthrough. Use `noEmit` for checking by default; override it locally when a requested library needs emitted output.

  Keep source paths and environment-specific settings out of the base config.

- Create only the environment configs that apply to the requested or existing codebase:

  - `tsconfig.browser.json`: browser environment with Vite-style bundler resolution, scoped to `src/` and excluding Vitest tests;
  - `tsconfig.react.json`: browser settings with React JSX support, scoped to `src/` including TSX and excluding Vitest tests;
  - `tsconfig.node.json`: Node environment and Node module resolution, covering root configuration modules and `lib/` scripts executed by Node via `pnpm run`;
  - `tsconfig.vitest.json`: Vitest environment, scoped to `src/**/*.test.ts` and corresponding TSX files when applicable;
  - `tsconfig.playwright.json`: Playwright environment, scoped to `tests/`.

  Extend the base config directly or through another applicable environment config. Use the React config instead of checking the same application under both browser and React configs. Keep framework-specific requirements scoped to their environment; Node scripts must not acquire React or Vite requirements.

  Put `include`, `exclude`, `references`, and any output or incremental metadata paths in the applicable environment configs. If a test config extends a production config, override inherited source selection and test exclusions so tests are actually included.

  Always create `tsconfig.node.json` in the project root and include `"*.mts"` so all root `.mts` configs, including `oxlint.config.mts`, `oxfmt.config.mts`, and `commitlint.config.mts`, are covered even when `lib/` does not exist. The Node config can start with:

  ```json
  {
    "extends": "./tsconfig.base.json",
    "compilerOptions": {
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "types": ["node"],
      "allowImportingTsExtensions": true,
      "erasableSyntaxOnly": true
    },
    "include": ["*.mts", "lib/**/*.ts", "lib/**/*.mts", "lib/**/*.cts"]
  }
  ```

  Set appropriate target and standard library options for each environment. Typecheck the generated root configuration modules even in a tooling-only scaffold. Do not create environment configs for nonexistent application/test source trees.

- Install the type dependencies required by active environments: for example, `@types/node`, `@types/react`, Vite, Vitest, or `@playwright/test`. Do not install frameworks or test runners solely to support unused configurations.

- Create `tsconfig.json`. For one environment it may extend that environment config. For multiple environments, use a solution config with `files: []`, `include: []`, and `references` pointing only to applicable local environment configs. Set project-reference options locally as needed.

  Add a `typecheck` script that actually checks every active environment using `tsc --noEmit --project <local-config>` for each leaf config. Running plain `tsc` against an empty solution does not check its references. Do not use `tsc --build` on a graph whose referenced projects disable emit. See [TypeScript's project references documentation](https://www.typescriptlang.org/docs/handbook/project-references.html).

  If a helper script is needed, propagate compiler failures rather than hiding diagnostics from empty or misconfigured projects.

## Git hooks and editor

- Create root `commitlint.config.mts` extending `@commitlint/config-conventional`.

- Keep Lefthook at the root. Add `prepare: "lefthook install"`. Configure `pre-commit` to run `pnpm run lint`, `pnpm run format`, and `pnpm run typecheck` in check mode. Configure `commit-msg` to run `pnpm exec commitlint --edit "{1}"`. Install the hooks when working in a Git repository; use pnpm's targeted build-script approval settings if installation requires them.

- Configure `.vscode/` to recommend `oxc.oxc-vscode` and `joshbolduc.commitlint`. Enable Oxlint and Oxfmt, linting on save, Oxfmt as the default formatter, formatting on save, and Oxlint fixes on save.

  Configure VS Code to use the project's local TypeScript runtime:

  ```json
  {
    "js/ts.experimental.useTsgo": true,
    "js/ts.tsdk.path": "./node_modules/typescript"
  }
  ```

- Ignore `node_modules/`, build artifacts, TypeScript incremental metadata, and test reports in Git. Keep generated artifacts out of linting and formatting.

## Verification

- Run `pnpm install` from the root to generate or update the lockfile.
- Run `pnpm run lint:fix` and `pnpm run format:fix`.
- Run `pnpm run lint`, `pnpm run format`, and `pnpm run typecheck`. Confirm the tooling-only scaffold passes without adding dummy application files, skipping real compiler errors, or requiring unused frameworks.
- Confirm `typecheck` checks every active environment, including root `.mts` configs through `tsconfig.node.json`, and Git hooks invoke the root scripts.
