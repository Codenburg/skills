---
name: webapp-testing
description: "Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs."
license: Complete terms in LICENSE.txt
metadata:
  author: Codenburg
  version: "1.0.0"
---

## Activation Contract

Load this skill when verifying frontend functionality of a local web app, debugging UI behavior, capturing browser screenshots, viewing browser console logs, or driving any browser interaction with Playwright against a running or static site.

## Hard Rules

- Treat scripts in `scripts/` as black boxes. Run `--help` first, then invoke directly. Do NOT read the source unless a customized solution is absolutely necessary — these scripts are large and pollute the context window.
- Always launch Chromium in headless mode: `p.chromium.launch(headless=True)`.
- On dynamic apps, always `page.wait_for_load_state('networkidle')` before inspecting the DOM or asserting state. Inspecting before `networkidle` yields pre-hydration markup.
- Always close the browser (`browser.close()`) when done, even on errors.
- Use `sync_playwright()` for synchronous scripts.
- Wrap the script body in `with sync_playwright() as p:` so resources are released on exit.
- Use `scripts/with_server.py` to manage server lifecycle (start, health-check, teardown) for one or more dev servers; never spawn servers inline.
- Pick descriptive selectors — prefer `text=`, `role=`, semantic CSS, or stable IDs over positional XPath.

## Decision Gates

```
User task → Is it static HTML?
    ├─ Yes → Read the HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails / Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No  → `python scripts/with_server.py --help`, then use it
        │         to manage the server and run the script.
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and `wait_for_load_state('networkidle')`.
            2. Screenshot or inspect DOM.
            3. Identify selectors from rendered state.
            4. Execute actions with discovered selectors.
```

## Execution Steps

1. Determine if the target is static HTML or a dynamic webapp (Decision Gates).
2. For dynamic targets, decide whether the server is already running. If not, run `python scripts/with_server.py --help` and use it to start the server(s) before launching the script.
3. Write a Playwright script that launches headless Chromium, navigates, waits for `networkidle`, performs the action / capture, and closes the browser.
4. For unknown DOM, use the reconnaissance-then-action pattern: screenshot, dump `page.content()`, enumerate `page.locator(...)`, then act.
5. Capture logs via `page.on('console', ...)` and `page.on('pageerror', ...)` when debugging.

## Output Contract

Return:

- The Playwright script (or the path to it).
- The screenshot path when applicable.
- A one-line log / console summary (errors, warnings, relevant `console.log`s).
- The server command used (or "static file" if no server).

## References

- [scripts/with_server.py](scripts/with_server.py) — black-box helper that starts and stops one or more dev servers; run `--help` first.
- [examples/element_discovery.py](examples/element_discovery.py) — discovering buttons, links, and inputs on a page.
- [examples/static_html_automation.py](examples/static_html_automation.py) — using `file://` URLs for local HTML.
- [examples/console_logging.py](examples/console_logging.py) — capturing console logs and page errors during automation.
