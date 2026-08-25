# Security Policy

## Scope

This is a frontend-only Home Assistant Lovelace card (a browser custom
element). It doesn't run any backend code, doesn't make network requests of
its own, and doesn't store credentials — it only calls Home Assistant
services (`switch.turn_on`/`turn_off`, `valve.open_valve`/`close_valve`)
through the `hass` object the dashboard already gives every card. The actual
security boundary (authentication, entity access) is Home Assistant's, not
this card's.

That said, if you find an issue here — e.g. a way the card's rendering could
be abused (XSS via a crafted entity name/state, for example) — please report
it.

## Reporting a vulnerability

Please **don't** open a public issue for a security report. Instead, use
GitHub's private reporting:

**[Repository → Security → Report a vulnerability](https://github.com/kdinya/smart-water-valve/security/advisories/new)**

Include what you found, how to reproduce it, and its potential impact. I'll
respond as soon as I can — this is a small side project maintained by one
person, so please bear with me on timing.

## Supported versions

Only the latest release is supported. Please update to the newest version
via HACS before reporting an issue, in case it's already fixed.
