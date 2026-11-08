---
name: lolmaus-monorepo-boilerplate
description: Scaffold a pnpm workspace monorepo with Turborepo, reusable Oxlint and TypeScript configuration packages, and repository-wide formatting and Git hooks.
license: MIT
compatibility: Requires pnpm
metadata:
  author: Andrey Mikhaylov (@lolmaus)
---

Scaffold a boilerplate for a monorepo using pnpm workspaces and Turborepo.

Use the following instructions as defaults. User's request overrides the defaults.

Work from the project's root folder. Create only tooling packages initially; add applications and libraries when requested. When working in an existing codebase, merge configuration and preserve existing packages and scripts.

Prefer `.mts` extension and corresponding module format for configs where applicable. Use `type: "module"` for generated package manifests.

Use exact version numbers for external `dependencies` and `devDependencies`, keeping versions consistent across the workspace. Use `workspace:*` for internal package dependencies, including shared config packages. Declare tools and environment-specific type dependencies in each package that uses them; do not rely on hoisting or another package's dependencies.

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

  Pin that exact version in the root `package.json`, substituting the learned version:

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

## Workspace layout and dependencies

- Create `pnpm-workspace.yaml` with these package globs:

  ```yaml
  packages:
    - apps/*
    - packages/*
  ```

  Reserve `apps/` for applications and `packages/` for reusable packages. Do not scaffold example applications, libraries, or frameworks by default.

- Create two private packages, each with version `0.1.0`:
  - `packages/oxlint-config`, named `@repo/oxlint-config`;
  - `packages/typescript-config`, named `@repo/typescript-config`.

- Install `turbo`, `oxlint`, `oxfmt`, `typescript`, `@commitlint/cli`, `@commitlint/config-conventional`, and `lefthook` as root dev dependencies using `pnpm add --workspace-root --save-dev --save-exact`.

  Add shared config packages to the root and each consuming workspace's `devDependencies` with `workspace:*`. Install exact versions of Oxlint and TypeScript in each workspace that runs them, including the Oxlint config package. Keep a single root `pnpm-lock.yaml`.

## Reusable Oxlint configuration

- In `@repo/oxlint-config`, create `index.mts` and expose it as the package's `.` export. Export a default config without rule customizations:

  ```ts
  import { defineConfig } from "oxlint";

  export default defineConfig({});
  ```

  This is a private source package; no build step is needed for its `.mts` export with the pinned Node runtime and pnpm workspace links.

- At the root and in every workspace containing JavaScript or TypeScript, create `oxlint.config.mts` that imports the shared config:

  ```ts
  import config from "@repo/oxlint-config";
  import { defineConfig } from "oxlint";

  export default defineConfig({ extends: [config] });
  ```

  In the Oxlint config package itself, import `./index.mts` to reuse its own config. Use the object-based `extends` supported by [Oxlint's TypeScript configuration](https://oxc.rs/docs/guide/usage/linter/nested-config).

- Give each workspace with lintable files `lint: "oxlint ."` and `lint:fix: "oxlint --fix ."` scripts. These scripts invoke Oxlint directly; only root aggregate scripts invoke Turbo.

- Add root-only `lint:root` and `lint:root:fix` scripts. Run Oxlint from the root but exclude `apps/**` and `packages/**` with quoted `--ignore-pattern` arguments, so workspace sources are checked by their own tasks. Still lint root configuration modules and any root `lib/` scripts.

## Reusable TypeScript configuration

- In `@repo/typescript-config`, create and export all six JSON presets under their filenames:

  - `tsconfig.base.json`: shared modern compiler settings with maximum strictness;
  - `tsconfig.browser.json`: browser environment with Vite-style bundler resolution;
  - `tsconfig.react.json`: extends the browser preset with React JSX settings;
  - `tsconfig.node.json`: Node environment, Node module resolution, and settings for scripts executed by Node via `pnpm run`;
  - `tsconfig.vitest.json`: Vitest environment;
  - `tsconfig.playwright.json`: Playwright environment.

  Environment presets extend the base preset, directly or through another preset in this package. Keep framework-specific requirements scoped to their environment; a Node consumer must not acquire React or Vite requirements.

  Enable `strict` and additional checks for unchecked indexed access, exact optional properties, unused code, implicit returns and overrides, and switch fallthrough. Use `noEmit` for checking by default; override it locally when a requested library needs emitted output.

  Keep `files`, `include`, `exclude`, `references`, `rootDir`, `outDir`, `tsBuildInfoFile`, and other consumer-relative paths out of shared presets. [TypeScript resolves inherited relative paths against the file that declares them](https://www.typescriptlang.org/tsconfig/extends.html), so these belong in consumer configs.

- At the root and in each TypeScript workspace, create only the local environment configs that apply. Always create a local `tsconfig.node.json` in the project root extending the shared Node preset and include `"*.mts"` so all root `.mts` configs, including `oxlint.config.mts`, `oxfmt.config.mts`, and `commitlint.config.mts`, are covered even when `lib/` does not exist. Keep this source selection in the local config rather than the shared preset. For example, the root `tsconfig.node.json`:

  ```json
  {
    "extends": "@repo/typescript-config/tsconfig.node.json",
    "include": ["*.mts", "lib/**/*.ts", "lib/**/*.mts", "lib/**/*.cts"]
  }
  ```

  Scope browser or React code to local `src/`, excluding Vitest tests. Use the React preset instead of checking the same app under both browser and React configs. Scope Vitest tests to local `src/**/*.test.ts` and corresponding TSX files when applicable; scope Playwright tests to local `tests/`.

  Install the type dependencies required by the active environments in that consumer: for example, `@types/node`, `@types/react`, Vite, Vitest, or `@playwright/test`. Merely exporting an unused preset does not require installing its framework or test runner.

- Create a local `tsconfig.json`. For one environment it may directly extend the applicable preset. For multiple environments, use a solution config with `files: []`, `include: []`, and `references` pointing only to that package's applicable local environment configs. Set project-reference options locally as needed.

  Each package's `typecheck` script must actually check every active environment. Use `tsc --noEmit --project <local-config>` for each leaf config; running plain `tsc` against an empty solution does not check its references. Do not use `tsc --build` on a graph whose referenced projects disable emit. If a helper script is needed, propagate compiler failures rather than hiding diagnostics from empty or misconfigured projects.

  Typecheck the Oxlint config package's `.mts` files, and root configuration modules and scripts. A JSON-only TypeScript preset package needs no dummy TypeScript source or typecheck script.

- Add a root `typecheck:root` script that checks the root's active local configs directly, including `tsconfig.node.json` for root `.mts` configs. Root and workspace checks must not recursively traverse one another's sources. Do not create environment configs for nonexistent application/test source trees.

## Turborepo

- Create a root `turbo.json` using `tasks` and the schema `https://turborepo.com/schema.json`. Start with:

  ```json
  {
    "$schema": "https://turborepo.com/schema.json",
    "globalDependencies": [".nvmrc", "packages/oxlint-config/**", "packages/typescript-config/**"],
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**"]
      },
      "dev": {
        "cache": false,
        "persistent": true
      },
      "lint": {
        "dependsOn": ["^lint"],
        "outputs": []
      },
      "lint:fix": {
        "cache": false
      },
      "typecheck": {
        "dependsOn": ["^typecheck", "^build"],
        "outputs": []
      },
      "//#lint:root": {
        "outputs": []
      },
      "//#lint:root:fix": {
        "cache": false
      },
      "//#typecheck:root": {
        "outputs": []
      }
    }
  }
  ```

  Shared config changes must invalidate consumer caches, including for config packages without executable tasks. Dependency task edges must account for upstream source changes; typechecking must wait for dependency builds when it consumes emitted declarations. See [Turbo's task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks) and [global dependencies](https://turborepo.dev/docs/reference/configuration#globaldependencies).

  When applications or libraries are added, tailor build outputs to their real artifacts, including declarations, and declare any environment variables that affect cached outputs. If checks write incremental metadata, either disable that behavior or cache the package-local metadata too. Keep fixing tasks uncached. Use local caching by default.

- Configure root scripts:

  ```json
  {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint lint:root",
    "lint:fix": "turbo run lint:fix lint:root:fix",
    "typecheck": "turbo run typecheck typecheck:root"
  }
  ```

  Keep root task scripts direct: `lint:root`, `lint:root:fix`, and `typecheck:root` must not call these aggregates. Do not add placeholder `build` or `dev` scripts to config packages.

## Repository-wide tools and editor

- Keep Oxfmt at the root. Create `oxfmt.config.mts` using `defineConfig` from `oxfmt` without customizations. Add root scripts `format: "oxfmt --check ."` and `format:fix: "oxfmt --write ."`. Format all workspace files in this single invocation; do not create workspace formatting tasks or config packages.

- Keep commitlint at the root. Create `commitlint.config.mts` extending `@commitlint/config-conventional`.

- Keep Lefthook at the root. Add `prepare: "lefthook install"`. Configure `pre-commit` to run the root `lint`, `format`, and `typecheck` scripts in check mode. Configure `commit-msg` to run `pnpm exec commitlint --edit "{1}"`. Install the hooks when working in a Git repository; use pnpm's targeted build-script approval settings if installation requires them.

- Configure `.vscode/` to recommend `oxc.oxc-vscode` and `joshbolduc.commitlint`. Enable Oxlint and Oxfmt, linting on save, Oxfmt as the default formatter, formatting on save, and Oxlint fixes on save. Ensure linting resolves each workspace's config.

  Configure VS Code to use the root's local TypeScript runtime:

  ```json
  {
    "js/ts.experimental.useTsgo": true,
    "js/ts.tsdk.path": "./node_modules/typescript"
  }
  ```

- Ignore `node_modules/`, `.turbo/`, build artifacts, and TypeScript incremental metadata in Git. Keep generated artifacts out of linting and formatting.

## Verification

- Run `pnpm install` from the root to resolve workspace links and generate the shared lockfile.
- Run `pnpm run lint:fix` and `pnpm run format:fix`.
- Run root `lint`, `format`, and `typecheck` checks. Confirm the tooling-only scaffold passes without adding dummy app files, skipping real compiler errors, or requiring unused frameworks.
- Inspect `pnpm exec turbo run lint lint:root typecheck typecheck:root --dry=json` to confirm that workspace and root tasks are included without recursion. Confirm the task configuration accounts for shared config changes and upstream dependency changes. Build and dev definitions may have no executable tasks until applications or libraries are requested.
