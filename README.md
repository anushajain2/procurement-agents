# Oton — AI Procurement Suite

**Oton turns procurement documents into decisions you can trace and sign off.** It
reads a Purchase Requisition (PR) or Bill of Quantities (BOQ), drafts the RFQ
(request for quotation) to send to vendors, compares the bids that come back
against the requirements, and takes the result through approval to a Purchase
Order (PO). Claude does the reading. Every value it pulls from a document links
back to the exact page and quote it came from, so an engineer can check it in
one click.

## Who it's for

Procurement and engineering teams buying **engineered equipment**, especially
EPC (engineering, procurement and construction) contractors, utilities and
industrial project owners. The demo data is electrical substation equipment
(transformers, switchgear, protection relays), but nothing in the pipeline is
specific to a commodity.

| Role | What they use Oton for |
| --- | --- |
| **Procurement / design engineers** | Turn a PR or BOQ into standards-based RFQs, then build the technical and commercial bid comparison (TBE) from vendor responses in minutes instead of days. |
| **Procurement managers & category heads** | Review a comparison where every cell is backed by its source page, edit or override it, and approve, reject or send it back. |
| **Finance / leadership approvers** | Sign off the final level of the award with the full audit trail in front of them. |
| **Project teams** | Track each package from PR through award, PO, delivery and close-out, along with its contract terms. |

## The problem it solves

Technical bid evaluation is usually done by hand. An engineer reads hundreds of
pages of vendor PDFs, copies values into a spreadsheet, checks each one against
the requisition and the governing standards (IEC, IS, ASME, API…), and then
passes the spreadsheet up an approval chain. It is slow and error-prone, and
reviewers can't easily check where a number came from. Oton automates the
reading and comparison and keeps the evidence attached to every value.

## What it does

The app follows the procurement lifecycle:

1. **Intake.** Upload a PR, a BOQ with its specifications, or paste free text.
   Claude works out which it is and extracts the line items with their key
   requirements. It also proposes how to group them: simple commodity items
   share one comparison sheet, and each engineered item gets its own. If the
   requirement is too vague to act on, it says what's missing instead of
   guessing.
2. **Draft RFQs (if you haven't gone to vendors yet).** For each package, Claude
   writes a technical specification: a parameter datasheet plus narrative
   sections (scope, testing, documentation, guarantees…). Applicable standards
   are referenced by number and edition. Where possible, values come from your
   own reference specs. Any code-derived limit Claude can't confirm is
   **flagged for engineer review** with a placeholder, never made up.
3. **Evaluate bids (once vendors respond).** Upload any number of vendors'
   technical and commercial documents. Claude builds the **Technical Bid
   Evaluation (TBE) matrix**:
   - every requirement, plus the governing standard clause where relevant;
   - each vendor's offered value, marked compliant, minor deviation,
     non-compliant or not stated;
   - a commercial comparison (price, delivery, payment terms, warranty, PBG);
   - compliance scores and a recommended ranking.

   **Click any cell** to open the source page with the quoted text highlighted.
4. **Review & approve.** The engineer can edit values, statuses and remarks, add
   rows or columns, pick the recommended vendor, and submit the evaluation up a
   multi-level approval chain (Procurement Manager → Category Head → CFO).
   Approvers can approve, reject or request changes, and every action is logged.
5. **Award & track.** Turn an approved evaluation into a PO under a project, with
   contract terms (price basis, Incoterms, payment, LDs, PBG, retention). Then
   follow it through delivery to close-out. A **Vendors** view shows how each
   supplier has performed across all evaluations.

Supported inputs: PDF (including scanned PDFs, which Claude reads with vision),
DOCX, XLSX/XLSM, TXT, CSV and Markdown.

## Project status

This is a working prototype, not a production system:

- **The AI features are real.** Intake, RFQ drafting and bid evaluation all call
  Claude on the documents you upload.
- **The workflow layer is a single-browser demo.** Users, approvals, projects and
  saved evaluations are held in the browser's `localStorage`. There are no
  accounts and no shared database. A **user switcher** in the header lets you act
  as each approver to walk through the sign-off chain. The app ships with sample
  evaluations, specs and projects so it isn't empty on first run.

## Architecture

```
procurement-agents/
├── frontend/   React + Vite: dashboard, intake wizard, comparison sheet with
│               source-page viewer, specs/RFQs, approvals, projects, vendors
└── backend/    FastAPI + Claude: document extraction and the AI pipelines
    ├── main.py       HTTP endpoints
    ├── extract.py    per-page text extraction (PDF/DOCX/XLSX/TXT), vision fallback for scans
    ├── boq.py        intake: PR vs BOQ detection, line items, evaluation grouping
    ├── spec.py       RFQ / technical-specification drafting
    └── evaluator.py  bid evaluation → TBE matrix, scoring, ranking
```

### How bid evaluation works

1. **Extract.** Text is pulled from each uploaded document page by page.
   Scanned PDFs are sent to Claude as documents instead.
2. **Parse requirements.** Claude turns the requisition into an ordered list of
   technical and commercial parameters, each tagged with whether the PR, a
   standard, or both governs it.
3. **Evaluate each vendor.** For every parameter, Claude finds the vendor's
   offered value, judges compliance, and returns the source file, page and a
   verbatim quote. Vendors are evaluated in parallel.
4. **Assemble.** The backend builds the matrix, attaches the real page text
   behind each cell, computes compliance scores, and ranks the vendors.

## Running it

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env    # then set ANTHROPIC_API_KEY (or export it in your shell)

uvicorn main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BID_EVAL_MODEL` | `claude-opus-4-8` | Claude model used by every pipeline. |
| `BID_EVAL_WEB_SEARCH` | `0` | Set to `1` to check current standard editions with web search before drafting or evaluating. More accurate, but slower. |

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5174
```

The frontend calls the backend at `http://localhost:8000`. To use a different
backend, set `VITE_API_URL` (e.g. `VITE_API_URL=http://host:8000 npm run dev`).

Open http://localhost:5174 and click **New Evaluation** to start from a PR or
BOQ, or **Specs & RFQs** to draft a specification from a short brief.

## API

All endpoints take `multipart/form-data`.

| Endpoint | Purpose | Fields |
| --- | --- | --- |
| `POST /api/parse-intake` | Detect PR vs BOQ, extract line items, propose evaluation grouping. | `files` (file[]), `text` (optional pasted text) |
| `POST /api/parse-boq` | Same, when the BOQ and the specifications are uploaded separately. | `boq_files`, `spec_files` (file[]) |
| `POST /api/generate-spec` | Draft an RFQ / technical specification. | `payload` = `{"brief": str, "category": str}`, `reference_files` (optional file[]) |
| `POST /api/evaluate` | Build the TBE matrix from vendor bids. | `payload` = `{"requirements_text": str, "vendors": [{"name", "file_count"}]}`, `requirement_files` (optional file[]), `vendor_files` (file[]) |

`/api/evaluate` returns `{title, mr_summary, standards, vendors, rows[], commercial, compliance, ranking, …}`.
Each cell's `source` is `{file, page, quote, page_text}`, which is what the
frontend uses to highlight the quote on the source page. Vendor files are sliced
by order, so send each vendor's files together and set a matching `file_count`.

## Notes & limitations

- **Cost.** Every pipeline makes real, billable Claude API calls: roughly one to
  parse the requirements plus one per vendor for an evaluation. Large documents
  use more tokens. Very long documents are truncated before being sent.
- **Human review is expected.** Values are traceable so they can be checked, and
  RFQ values that can't be sourced are flagged instead of filled in. An engineer
  should still review before anything is issued or awarded.
- **Standards.** Standards are referenced by number and edition. Copyrighted
  clause text is never reproduced. For exact limits, upload your own licensed
  copies as reference documents.
