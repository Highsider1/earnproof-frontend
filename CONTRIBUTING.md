# Contributing to EarnProof Frontend

Thanks for improving EarnProof. This repository contains the public web app and frontend flows for wallet authentication, payment review, proof creation, and public verification.

## Setup

```bash
npm install
git config core.hooksPath .githooks
cp .env.example .env.local
npm run dev
```

Default local URL: `http://localhost:3000`.

`npm install` configures the tracked Git hooks automatically. The explicit Git
command above also enables them in an existing checkout. The pre-commit hook
runs unit tests when staged frontend code or configuration changes. The
commit-message hook accepts conventional subjects such as `feat: add proof
search` and `fix(wallet): handle rejected signatures`; scopes and issue IDs are
optional.

## Validation

Run these before opening a pull request:

```bash
npm run lint
npm run build
```

## Visual regression baselines

`e2e/visual/` contains a Playwright suite that screenshots representative
routes/states and compares them to committed baseline images (see
`e2e/visual/README.md`). If your change intentionally alters a covered
layout:

- Regenerate baselines with `npm run test:e2e:visual:update`, generated
  from the same environment CI runs in (see the README for why).
- Review every changed baseline image yourself before committing it.
- Call this out explicitly in your pull request description (e.g. a
  `## Visual baseline update` section naming which snapshots changed and
  why). A PR that updates baseline images without that note should be
  treated as unreviewed and not approved as-is.

## Contribution Expectations

- Keep changes scoped to the issue you are solving.
- Do not put secret keys, private wallet material, or signing data in client code.
- Make Stellar network state visible when a workflow depends on testnet.
- Keep verification pages limited to intentionally disclosed proof data.
- Add tests or fixtures when changing behavior that can regress.
- Update documentation when user-facing behavior changes.
- Never commit real user data, wallet material, or credentials in test fixtures — visual/e2e fixtures must be synthetic.

## Definition of Done

- The feature or fix satisfies the issue acceptance criteria.
- Lint and build pass.
- User-facing text is accurate about implemented behavior.
- Sensitive data is not exposed in logs, URLs, screenshots, or public verification payloads.
- The pull request explains validation performed.

