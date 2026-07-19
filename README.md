# AI Bid Evaluator

A full-stack app that runs a **real** technical bid evaluation over uploaded vendor
documents. Upload any number of vendors' technical/commercial bid documents plus the
Material Requisition (MR) requirements; Claude reads the actual documents, evaluates each
bid against the MR, and builds a Technical Bid Evaluation (TBE) matrix. **Click any cell**
and the exact source document page is shown on the right, with the extracted value
highlighted — every value is traceable to where it came from.

```
bid-evaluator/
├── frontend/   React + Vite UI (upload screen, evaluation matrix, source-doc panel)
└── backend/    FastAPI + Claude (document extraction + evaluation pipeline)
```

Unlike the earlier prototype, **nothing is hard-coded** — vendors, documents, and
requirements are all user-supplied, and the matrix is generated from the real content of
the uploaded files via LLM calls.

## How it works

1. **Extract** — the backend pulls per-page text from each uploaded PDF / DOCX / TXT
   (`backend/extract.py`).
2. **Parse requirements** — Claude turns the MR text/documents into a structured,
   ordered list of evaluation parameters (works for any commodity, any requirements).
3. **Evaluate each vendor** — for every parameter, Claude finds the vendor's offered
   value in their documents, judges compliance (ok / warn / fail / na), and returns the
   exact source file, page, and a verbatim quote.
4. **Assemble** — the backend builds the matrix, attaches the real source-page text behind
   each cell, computes compliance scores, and ranks the vendors.

Each cell's `source` carries `{file, page, quote, page_text}`, so the frontend highlights
the quote inside the actual page text.

## Running it

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=sk-ant-...        # required — see .env.example
# optional: export BID_EVAL_MODEL=claude-opus-4-8   (default)

uvicorn main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5174
```

The frontend calls the backend at `http://localhost:8000` by default. To point elsewhere,
set `VITE_API_URL` (e.g. `VITE_API_URL=http://host:8000 npm run dev`).

Open http://localhost:5174, add vendors + documents, paste or attach the requirements, and
click **Run Technical Bid Evaluation**.

## API

`POST /api/evaluate` — multipart form:

| field               | type        | notes                                                              |
| ------------------- | ----------- | ------------------------------------------------------------------ |
| `payload`           | JSON string | `{"requirements_text": str, "vendors": [{"name","file_count"}]}`   |
| `requirement_files` | file[]      | optional MR documents (folded into the requirements text)          |
| `vendor_files`      | file[]      | all vendor documents, in vendor order (sliced by each `file_count`)|

Returns the TBE matrix JSON: `{title, mr_summary, vendors, rows[], compliance, ranking}`.

## Model

Uses `claude-opus-4-8` via the official `anthropic` Python SDK with structured outputs
(`messages.parse`). Override with the `BID_EVAL_MODEL` env var.

## Notes / limitations

- **Text-based documents.** Text is extracted with `pypdf` / `python-docx`. Scanned,
  image-only PDFs won't have extractable text — OCR (e.g. via a vision model or Tesseract)
  is the natural next step.
- **Cost.** Evaluation makes real, billable API calls — roughly one call to parse the MR
  plus one per vendor. Larger documents cost more tokens.
- **Vendor documents are sliced by order**, so the frontend appends each vendor's files
  contiguously and sends a matching `file_count`.
