SkillDash — Mobile-First Prototype
====================================

This version is optimized for PHONES first:
- Single-column layout, larger tap targets (≥44px), 16px+ inputs to avoid iOS zoom.
- Big, high-contrast buttons; no hover dependence; touch-friendly.
- Same gameplay: 10 questions, 90 seconds, need ≥8 correct to 'win'.

How to run
----------
Because questions.json is fetched, serve via a simple local server:

- Python: `python -m http.server 8000` → http://localhost:8000
- Node: `npx http-server .`

Deploy
------
- Vercel or Netlify (static). No build step required.

Next steps
----------
- Add server-side score verification and real gift-card delivery integration.
- Auth + abuse-prevention; geo-restrictions if needed.

Generated: 2025-08-21T18:15:51.514805
