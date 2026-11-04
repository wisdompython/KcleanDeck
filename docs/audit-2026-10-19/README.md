# Audit artifacts — 19 October 2026

Start with [browser-report.md](browser-report.md) for the usability score, workflow coverage, observed browser defects and limits; [backend-findings.md](backend-findings.md) contains the financial/configuration findings and exact in-process reproduction details.

Evidence index:

- `existing-e2e.json`: final unmodified Playwright suite, 63 passed / 1 ambiguous test locator failure / 0 skipped.
- `e2e-results/`: failed test screenshot, trace and exact strict-mode locator error.
- `browser-final.json`: seven focused workflow outcomes, with corrected-selector rechecks applied, plus four edge scenarios. Raw runs remain in `browser-all.json`, `browser-recheck.json`, `browser-edgecases.json` and matching logs. Guard assertions deliberately fail when the undesired behavior is observed. The zero-price case is inconclusive and must not be counted as a confirmed product bug.
- `browser-snapshots.json`: 18 page/width overflow measurements plus settings draft retention; all structural checks passed. Screenshot review separately found unusably narrow tablet frequency fields.
- `invalid-code-evidence.json`, `hidden-units-evidence.json`, `hidden-service-evidence.json`, `contact-edit-evidence.json`, `nojs-login-evidence.json`: focused observed outputs.
- `backend-probe-results.json`, `backend-tests.log`, `frontend-lint.log`: backend scenario evidence and existing check results.
- `layout-390-new.png`, `layout-768-settings_tab_frequencies.png`, `layout-1440-settings_tab_frequencies.png`: representative phone, tablet and desktop views. Other PNGs show the discount and hidden-service problems.

Reproduction scripts are local test infrastructure only: `local-proxy.cjs`, `browser-audit.cjs`, `browser-recheck.cjs`, `browser-edgecases.cjs`, `browser-nojs-login.cjs`, `consolidate-browser-results.cjs`, and `backend-probes.py`. Do not point them at a live deployment. Start with a fresh throwaway database and the seeded owner credentials in `e2e/e2e.env`; test fixtures intentionally modify catalogue/settings/bookings.

The documented `e2e/npm run e2e` Docker stack remains the preferred normal rerun. This audit used an isolated SQLite fallback because Docker engine access was denied. Its safe settings were: an explicit `DATABASE_URL` pointing to this folder's database, local-only Paystack URL `http://127.0.0.1:8099` and test key, `EMAIL_HOST` empty, media/TEMP/TMP under this folder, audit backend :8019 and frontend :3019. `local-proxy.cjs` mirrors Caddy on :8089 and forwards the development websocket. Browser base URL and Django callback/CSRF origins were `http://localhost:8089`.

With that disposable stack running, use `E2E_BASE_URL=http://localhost:8089`, `E2E_FAKE_PAYSTACK_URL=http://localhost:8099`, `CI=1`, `PLAYWRIGHT_JSON_OUTPUT_FILE=../docs/audit-2026-10-19/existing-e2e.json`, then run `npx playwright test --reporter=list,json --retries=0` from `e2e`. Run focused scripts from the repository root in this order: `node docs/audit-2026-10-19/browser-audit.cjs snapshots`, `node docs/audit-2026-10-19/browser-audit.cjs all`, `node docs/audit-2026-10-19/browser-recheck.cjs`, `node docs/audit-2026-10-19/browser-edgecases.cjs`, `node docs/audit-2026-10-19/browser-nojs-login.cjs`, then the consolidation script. The audit scripts are evidence probes, not an exhaustive regression suite.

Only audit-owned servers were started and stopped for this task. Application source and the user's preexisting uncommitted changes were preserved. Local DB/session files contain disposable test records only.
