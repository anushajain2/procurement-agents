# Short demo (1:39)

[`oton_short_demo.mp4`](oton_short_demo.mp4) is a 1920×1080, 30 fps, captioned cut
that tells the story as problem → solution → impact. It has no audio. A
voiceover script timed to the picture is below; record it and lay it over the
video, with or without music.

| Time | Section | On screen |
| --- | --- | --- |
| 0:00 | Problem | Vendor bids pile up: three vendors, 640 pages |
| 0:06 | Problem | Values hand-copied from PDFs into a spreadsheet; errors creep in |
| 0:14 | Problem | The spreadsheet is emailed up the approval chain: "Which page is this?" |
| 0:21 | Turn | Everything collapses into the logo: *Meet Oton* |
| 0:26 | Solution | Requisition parsed, line items grouped |
| 0:37 | Solution | Vendor bids uploaded |
| 0:43 | Solution | Comparison sheet → click a value → source page with the quote highlighted |
| 0:56 | Solution | Commercial view: the cheapest bid isn't compliant |
| 1:03 | Solution | CFO signs off; full approval chain |
| 1:12 | Solution | PO issued and tracked in the project |
| 1:22 | Impact | Four benefits |
| 1:31 | Close | Lifecycle hub → *Oton. Procurement decisions you can trace.* |

## Voiceover script

Roughly 2.3 words per second. Each line starts at its timecode.

| Time | Line |
| --- | --- |
| 0:00 | Every engineered purchase ends in a pile of vendor bids. Hundreds of pages, for every package. |
| 0:06 | Today, engineers read every page and retype each value into a spreadsheet, by hand. |
| 0:14 | Then it's emailed up for sign-off, and nobody can easily check where a number came from. |
| 0:21 | Meet Oton: AI bid evaluation that shows its work. |
| 0:26 | Drop in the requisition or bill of quantities. Claude reads it, pulls out every line item, and groups them for evaluation. |
| 0:37 | Add each vendor's technical and commercial bids, in any format. |
| 0:43 | In minutes, you get the full comparison: every requirement, every vendor, a compliance verdict on each. Click any value, and Oton shows you the exact page and quote it came from. |
| 0:56 | The cheapest bid isn't compliant, and the sheet shows you exactly why. |
| 1:03 | The evaluation routes through each approver, with a full audit trail. |
| 1:12 | Then issue the purchase order, and track it through to delivery. |
| 1:22 | Faster awards. Fewer errors. Decisions your team can defend. |
| 1:31 | Oton. Procurement decisions you can trace. |

## How it's made

- **Problem, transition, impact and close** (`motion.html`) are HTML/SVG
  scenes written as functions of time. `motion.mjs` renders them frame by
  frame at 30 fps.
- **Product shots** (`product.mjs`) drive the real frontend with Playwright.
  The page renders at 2× (a 1440×810 layout in a 2880×1620 viewport) so the
  camera can zoom in sharply. The script logs camera targets from real element
  positions, plus every cursor move, click and caption. As in the long demo,
  the three AI endpoints are stubbed with backend-shaped sample data from
  [`../mocks.mjs`](../mocks.mjs), so the vendor names, prices and pages are
  illustrative.
- `compose.py` applies the eased camera moves and draws the cursor, click
  ripples and caption pills at 30 fps. `final.py` joins everything with
  crossfades.

To rebuild (app running on :5174 as in [`../README.md`](../README.md)):

```bash
cd demo/short
node motion.mjs && node product.mjs && python3 compose.py && python3 final.py
```
