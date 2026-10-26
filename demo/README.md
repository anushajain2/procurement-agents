# Product demo video

[`oton_demo.mp4`](oton_demo.mp4) is a 4½-minute captioned walkthrough of Oton (1920×1080, 30 fps, no audio).
It follows one 10 MVA power transformer package through the whole cycle:

| # | Chapter | What's shown |
| --- | --- | --- |
| – | Overview | Dashboard: evaluations, sign-offs and projects in one workspace |
| 1 | Intake | Upload a BOQ → Claude detects it, extracts line items, proposes evaluation sheets |
| 2 | RFQ drafting | Standards-based spec drafted; code-derived limits flagged, then confirmed by the engineer |
| 3 | Bid evaluation | Three vendors' bids uploaded; evaluation runs in the background |
| 4 | Comparison sheet | TBE matrix, standards, click-to-source with highlighted quotes, commercial view, editing |
| 5 | Approvals | Procurement Manager → Category Head → CFO sign-off, with audit trail |
| 6 | Award & track | Issue the PO with contract terms; track the package in its project |
| 7 | Vendors | Supplier performance across evaluations |

## How it was made

Everything on screen is the real frontend, driven by Playwright. The three AI
endpoints (`/api/parse-intake`, `/api/generate-spec`, `/api/evaluate`) were
**stubbed** with realistic responses in [`mocks.mjs`](mocks.mjs), shaped exactly
like the backend's output, because no `ANTHROPIC_API_KEY` was available when it
was recorded. The vendor names, prices and document pages in the evaluation are
illustrative sample data.

## Regenerating it

Requires Node 18+, Playwright with Chromium, Python 3 and ffmpeg.

```bash
cd frontend && npm install && npx vite --port 5174 --host 127.0.0.1 &   # app on :5174
cd demo
node record.mjs     # drives the UI, writes frames + timeline to out/
node assets.mjs     # renders background, captions and title cards
python3 assemble.py # composites everything into oton_demo.mp4
```

If Playwright is installed globally, point the scripts at it with
`PLAYWRIGHT_ROOT=$(npm root -g)/`. Captions, pacing and the click path all live
in `record.mjs`; card text lives in `assets.mjs`.
