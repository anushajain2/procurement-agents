"""Technical bid evaluation powered by Claude.

Pipeline:
  1. Parse the Material Requisition (MR) text into a structured parameter list
     (dynamic — works for any requirements, any commodity).
  2. For each vendor, read their extracted document text and extract the offered
     value + compliance status + exact source (file/page/quote) for every
     parameter.
  3. Assemble the TBE matrix, attach the real source-page text behind each cell,
     compute compliance scores, and rank the vendors.

Every value the matrix shows is grounded in the vendors' actual documents, and
each cell carries the verbatim quote + page so the frontend can show exactly
where it came from.
"""
from __future__ import annotations

import asyncio
import os
import re

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

from extract import Page, extract_pages, pages_to_corpus, build_document_content

MODEL = os.environ.get("BID_EVAL_MODEL", "claude-opus-4-8")

# Standards editions/limits come from the model's own knowledge by default (fast).
# Set BID_EVAL_WEB_SEARCH=1 to additionally verify current editions via web search
# (slower — adds a bounded web-search step per spec/evaluation).
WEB_SEARCH = os.environ.get("BID_EVAL_WEB_SEARCH", "0").lower() in ("1", "true", "yes")


# ── Structured-output schemas ────────────────────────────────────────────────
class ParamSpec(BaseModel):
    category: str = Field(description="Section this parameter belongs to, e.g. 'A. General Data', 'C. Performance'.")
    parameter: str = Field(description="The parameter / requirement name.")
    unit: str = Field(description="Unit of measure, or '-' if not applicable.")
    mr_requirement: str = Field(description="What the Purchase Requisition (PR) requires for this parameter (value, spec, or 'Required'). Use '-' if the PR is silent and only a standard governs it.")
    governing: str = Field(default="pr", description="Which source sets the binding requirement: 'pr' (only the requisition), 'standard' (only an engineering code), or 'both'.")
    standard: str = Field(default="", description="The specific governing standard + clause where applicable, e.g. 'IS 1180:2014 Cl.6', 'IEC 60076-1', 'ASME B16.34', 'API 610'. Empty if no standard governs this parameter.")
    standard_requirement: str = Field(default="", description="The limit/value mandated by that standard, e.g. '≤ 9 kW', 'Dyn11', 'Class 600'. Empty if none.")


class CommercialParam(BaseModel):
    parameter: str = Field(description="Commercial line item, e.g. 'Basic Price', 'GST / Taxes', 'Freight & Insurance', 'Total Landed Price', 'Delivery Period', 'Payment Terms', 'Price Validity', 'Warranty', 'Performance Bank Guarantee', 'Price Basis (firm/variable)'.")
    unit: str = Field(description="Unit, e.g. '₹', '%', 'weeks', 'months', or '-'.")
    mr_requirement: str = Field(description="What the PR asks for this commercial item, or '-' if the PR is silent.")


class MRParse(BaseModel):
    title: str = Field(description="Short title for the evaluation, e.g. the item and tender reference.")
    mr_summary: str = Field(description="One or two line summary of what is being procured.")
    standards: list[str] = Field(default_factory=list, description="The engineering standards/codes applicable to THIS equipment that were applied, e.g. ['IS 2026 — Power transformers', 'IEC 60076-1', 'IS 1180:2014 EEL-1'].")
    parameters: list[ParamSpec] = Field(description="TECHNICAL parameters only (ratings, design, performance, construction, documentation) — NOT price/commercial.")
    commercial_parameters: list[CommercialParam] = Field(default_factory=list, description="Commercial line items to compare across bids (price components, delivery, payment, validity, warranty, PBG). Derive from the PR; if the PR is purely technical, still include the standard commercial line items a vendor would quote so their offers can be compared.")


class CellSource(BaseModel):
    file: str = Field(description="Exact source file name the value was read from.")
    page: int = Field(description="1-indexed page number within that file.")
    quote: str = Field(description="Short verbatim snippet copied exactly from the document that contains the value.")


class Cell(BaseModel):
    parameter: str = Field(description="The parameter name this cell answers (echo it back exactly).")
    value: str = Field(description="The vendor's offered value, or 'Not found'.")
    status: str = Field(description="One of: ok (meets MR), warn (minor deviation/unclear), fail (does not meet), na (not in documents).")
    source: CellSource | None = Field(default=None, description="Where the value came from; null if not found.")
    remark: str = Field(default="", description="Brief evaluator note, or empty.")


class VendorExtraction(BaseModel):
    cells: list[Cell]
    commercial_cells: list[Cell] = Field(default_factory=list, description="One cell per commercial parameter, in order. If the vendor's documents contain no commercial/price information, return an empty list.")
    total_price: str = Field(default="", description="The vendor's total evaluated / landed price with currency if stated (e.g. '₹ 1.85 Cr', '18500000'), or 'Not quoted' if no price is given.")


# ── Prompts ──────────────────────────────────────────────────────────────────
_MR_SYSTEM = """You are a senior procurement engineer building a Technical Bid Evaluation (TBE).
Given the Purchase Requisition (PR) / requirements for a procurement, build the list of
parameters that every vendor bid must be evaluated against — judged not only against the PR
but ALSO against the engineering standards that govern this type of equipment.

Standards step (important):
- First identify the equipment from the PR, then determine which engineering standards/codes
  apply to it (e.g. transformers → IS 2026, IEC 60076, IS 1180 for efficiency; valves → API 600/602,
  ASME B16.34; pumps → API 610; switchgear → IEC 62271; cables → IS 7098 / IEC 60502; pressure
  vessels → ASME Sec VIII). List every applicable standard in `standards`.
- Then derive parameters from BOTH the PR and those standards. Include standard-mandated parameters
  even when the PR is silent on them (set governing='standard' and mr_requirement='-').

For each parameter set:
- governing: 'pr' (only the requisition), 'standard' (only a code), or 'both'.
- standard: the specific code + clause, e.g. 'IS 1180:2014 Cl.6', 'IEC 60076-1', 'ASME B16.34'. Empty if none.
- standard_requirement: the limit/value the standard mandates (e.g. '≤ 9 kW', 'Dyn11'). Empty if none.
- mr_requirement: what the PR asks for; '-' if the PR is silent and only a standard governs.

Commercial step:
- `parameters` must be TECHNICAL only (ratings, design, performance, construction, documentation).
- Put commercial line items in `commercial_parameters` instead: price components (Basic Price,
  GST/Taxes, Freight & Insurance, Total Landed Price), Delivery Period, Payment Terms, Price Validity,
  Warranty, Performance Bank Guarantee, Price Basis. Derive from the PR where stated; if the PR is
  purely technical, still include the standard commercial line items a vendor would quote.

Rules:
- Group technical parameters into logical, ordered categories (General Data, Design, Performance,
  Construction, Documentation). Prefix categories with a letter (A., B., C., ...).
- Be accurate about standards: only cite a code/clause you are confident applies. Do not invent
  clause numbers; if unsure of the exact clause, give the standard without a clause.
- If a "Current standards research" section is provided below the requirements, PREFER it for standard
  names, editions and limits (it reflects the latest editions verified via live web search). Cite the
  edition/year where the research confirms it (e.g. 'IS 1180:2014').
- Keep parameter names concise. Use '-' for unit when not applicable.
"""

_EVAL_SYSTEM = """You are a senior procurement engineer evaluating ONE vendor's bid against a
Purchase Requisition (PR) AND the governing engineering standards. You are given the list of
parameters (each with the PR requirement and, where applicable, the governing standard + its
limit) and the full text of the vendor's submitted documents (each page marked with
[FILE: ... | PAGE n]).

For EACH parameter in the list, in the same order, return a cell with:
- value: the vendor's offered value (copy the actual figure/spec). If the documents do not
  contain it, use "Not found".
- status: judge against the BINDING requirement = the stricter of the PR requirement and the
  governing standard. ok = meets both PR and the applicable standard; warn = minor deviation,
  ambiguous, or meets the PR but is borderline/unclear on the standard; fail = clearly violates
  the PR or the governing standard; na = not found in the documents.
- source: the exact file name, the page number, and a SHORT verbatim quote copied exactly from
  the document text that contains the value. If value is "Not found", set source to null.
- remark: a brief note. If the vendor meets the PR but VIOLATES the applicable standard (or vice
  versa), say so explicitly and cite the standard/clause. Empty string if nothing to note.

Be strict and evidence-based. Only mark 'ok' when the documents support both the PR and the
standard. The quote MUST be copied verbatim from the provided document text so it can be located.

COMMERCIAL: You are also given a list of commercial parameters (price components, delivery,
payment terms, warranty, PBG, validity, etc.). If — and only if — the vendor's documents contain
commercial/price information:
- Return `commercial_cells`: one cell per commercial parameter, in the SAME order, with value +
  source (verbatim quote) exactly as for technical cells. Use status 'na' for a commercial item the
  vendor does not address; otherwise 'ok'. Use "Not quoted" as value where the vendor is silent.
- Return `total_price`: the vendor's total evaluated / landed price WITH currency as stated
  (e.g. '₹ 1.85 Cr', '₹ 18,500,000'). If several totals exist, use the final landed/total price.
If the documents contain NO commercial information at all, return an empty `commercial_cells` list
and set `total_price` to "Not quoted". Never invent prices.
"""


def _client() -> AsyncAnthropic:
    # Reads ANTHROPIC_API_KEY from the environment.
    return AsyncAnthropic()


_RESEARCH_SYSTEM = """You are a senior standards engineer. From the equipment described, identify the
engineering standards/codes that govern it (IS, IEC, ISO, ASME, API, IEEE, etc.), then USE WEB SEARCH
to verify the CURRENT edition / amendment of each and gather any publicly available key requirements.

Prefer official sources (BIS, IEC, ISO, ASME, API) and reputable references. Return a concise briefing:
for each applicable standard give its number, title, the latest edition/amendment you can confirm (with
year), and any concrete limits or mandatory clauses you found. Be explicit when the full normative text
is paywalled and a value is only indicative. Do NOT invent edition numbers or clause values — state only
what the search supports or what is well established, and flag anything uncertain."""


# Web-search standards research is OPTIONAL and time-bounded — it must not make a
# spec/evaluation take many minutes. If it doesn't finish quickly, we proceed with
# the model's own knowledge of the standards.
_RESEARCH_TIMEOUT_S = 75


async def _research_standards(client: AsyncAnthropic, requirements: str) -> str:
    """Pull the current edition/limits of the applicable standards via web search,
    bounded by a hard timeout so it never dominates the request time."""
    async def _search(tool_type: str) -> str:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=3000,
            system=_RESEARCH_SYSTEM,
            tools=[{"type": tool_type, "name": "web_search", "max_uses": 3}],
            messages=[{"role": "user", "content": f"Equipment / requirements:\n\n{requirements[:6000]}"}],
        )
        return "\n".join(b.text for b in resp.content if getattr(b, "type", "") == "text" and getattr(b, "text", "")).strip()

    for tool_type in ("web_search_20260209", "web_search_20250305"):
        try:
            return await asyncio.wait_for(_search(tool_type), timeout=_RESEARCH_TIMEOUT_S)
        except asyncio.TimeoutError:
            return ""  # took too long — proceed on the model's knowledge
        except Exception:
            continue  # tool variant unavailable — try the basic one, then give up
    return ""


async def _parse_requirements(
    client: AsyncAnthropic, requirements: str, research: str = "", vendor_context: str = ""
) -> MRParse:
    user = f"Purchase Requisition / requirements:\n\n{requirements}"
    if vendor_context:
        user += (
            "\n\n---\nVENDOR SUBMISSIONS (excerpts). The requirement above may be thin or ambiguous. "
            "Use these submissions ONLY to understand WHAT equipment is actually being procured, so you "
            "can apply the correct engineering standards and the parameters a proper evaluation of THIS "
            "equipment demands. Derive the standard, expected parameters and their typical/mandated limits "
            "from the equipment type and its governing codes — do NOT copy a single vendor's offered "
            "numbers as if they were the requirement, and do not bias the parameter list toward any one "
            "vendor. Where the buyer stated nothing, set mr_requirement='-' and let the standard govern.\n"
            + vendor_context
        )
    if research:
        user += (
            "\n\n---\nCurrent standards research (editions and limits gathered via live web search — "
            "PREFER these for standard names, editions and limits over your prior knowledge):\n" + research
        )
    resp = await client.messages.parse(
        model=MODEL,
        max_tokens=8000,
        system=_MR_SYSTEM,
        messages=[{"role": "user", "content": user}],
        output_format=MRParse,
    )
    return resp.parsed_output


async def _evaluate_vendor(
    client: AsyncAnthropic,
    vendor_name: str,
    files: list[tuple[str, bytes]],
    params: list[ParamSpec],
    commercial_params: list[CommercialParam] | None = None,
) -> VendorExtraction:
    def _line(i: int, p: ParamSpec) -> str:
        base = f"{i + 1}. [{p.category}] {p.parameter} (unit: {p.unit}) — PR requires: {p.mr_requirement}"
        if p.standard:
            base += f" | Governing standard {p.standard}: {p.standard_requirement or 'as per code'}"
        return base

    param_lines = "\n".join(_line(i, p) for i, p in enumerate(params))
    commercial_params = commercial_params or []
    comm_block = ""
    if commercial_params:
        comm_lines = "\n".join(
            f"{i + 1}. {p.parameter} (unit: {p.unit}) — PR: {p.mr_requirement}"
            for i, p in enumerate(commercial_params)
        )
        comm_block = (
            f"\n\nCommercial parameters (return one cell per parameter in `commercial_cells`, in this "
            f"order, ONLY if the documents contain commercial/price info):\n{comm_lines}\n"
        )
    header = (
        f"Vendor: {vendor_name}\n\n"
        f"Parameters to evaluate (return one cell per parameter, in this order):\n{param_lines}\n"
        f"{comm_block}\n"
        f"Vendor documents:"
    )
    # Scanned/image bid PDFs (no extractable text) are sent to Claude natively (vision).
    content = build_document_content(header, files)
    resp = await client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=_EVAL_SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=VendorExtraction,
    )
    return resp.parsed_output


def _locate_page_text(pages: list[Page], file: str, page: int) -> str:
    for p in pages:
        if p.file == file and p.page == page:
            return p.text
    # fall back to first page of that file
    for p in pages:
        if p.file == file:
            return p.text
    return ""


def _status_rank(cells: list[dict]) -> int:
    return sum(1 for c in cells if c["status"] == "ok")


def _parse_price(raw: str) -> float | None:
    """Best-effort parse of a quoted price into a comparable number (in ₹).
    Handles crore/lakh suffixes and thousands separators. Returns None if no
    number can be read (e.g. 'Not quoted')."""
    if not raw:
        return None
    s = raw.strip().lower().replace(",", "").replace("₹", "").replace("rs", "").replace("inr", "")
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if not m:
        return None
    val = float(m.group(1))
    if "cr" in s or "crore" in s:
        val *= 10_000_000
    elif "lakh" in s or "lac" in s or re.search(r"\bl\b", s):
        val *= 100_000
    elif "mn" in s or "million" in s:
        val *= 1_000_000
    return val


async def evaluate(requirements: str, vendors: list[dict]) -> dict:
    """Run the full evaluation.

    `vendors` is a list of {"name": str, "pages": list[Page]}.
    Returns the TBE matrix as a JSON-serialisable dict.
    """
    if not requirements.strip():
        raise ValueError("No requirements provided.")
    if not vendors:
        raise ValueError("No vendor documents provided.")

    client = _client()

    # First, look up the current editions/limits of the governing standards (web search),
    # then derive the parameter list grounded in both the PR and that research.
    research = await _research_standards(client, requirements) if WEB_SEARCH else ""

    # When the requirement is thin (e.g. a short free-text description), ground the
    # equipment understanding in the vendor submissions so we evaluate against the
    # RIGHT technical parameters instead of assuming what the buyer meant.
    vendor_context = ""
    if len(requirements.strip()) < 600:
        digest_pages: list[Page] = []
        for v in vendors:
            digest_pages.extend(v.get("pages", []))
        corpus, _ = pages_to_corpus(digest_pages, max_chars=24000)
        vendor_context = corpus

    mr = await _parse_requirements(client, requirements, research, vendor_context)
    params = mr.parameters
    commercial_params = mr.commercial_parameters or []
    if not params:
        raise ValueError("Could not derive any evaluation parameters from the requirements.")

    # Evaluate every vendor concurrently.
    async def run(v: dict) -> tuple[dict, VendorExtraction]:
        extraction = await _evaluate_vendor(client, v["name"], v["files"], params, commercial_params)
        return v, extraction

    results = await asyncio.gather(*(run(v) for v in vendors))

    vendor_names = [v["name"] for v in vendors]

    # Index each vendor's cells by parameter name for assembly.
    by_vendor: dict[str, dict[str, Cell]] = {}
    comm_by_vendor: dict[str, dict[str, Cell]] = {}
    total_price_by_vendor: dict[str, str] = {}
    pages_by_vendor: dict[str, list[Page]] = {}
    for v, extraction in results:
        name = v["name"]
        pages_by_vendor[name] = v["pages"]
        cells = {c.parameter.strip().lower(): c for c in extraction.cells}
        by_vendor[name] = cells
        comm_by_vendor[name] = {c.parameter.strip().lower(): c for c in (extraction.commercial_cells or [])}
        total_price_by_vendor[name] = (extraction.total_price or "").strip()

    # Assemble rows in MR/category order.
    rows: list[dict] = []
    counts = {name: {"ok": 0, "warn": 0, "fail": 0, "na": 0} for name in vendor_names}
    for spec in params:
        key = spec.parameter.strip().lower()
        cells_out: dict[str, dict] = {}
        for name in vendor_names:
            cell = by_vendor[name].get(key)
            if cell is None:
                cells_out[name] = {"value": "—", "status": "na", "source": None, "remark": ""}
                counts[name]["na"] += 1
                continue
            status = cell.status if cell.status in ("ok", "warn", "fail", "na") else "na"
            counts[name][status] += 1
            source = None
            if cell.source is not None:
                page_text = _locate_page_text(pages_by_vendor[name], cell.source.file, cell.source.page)
                source = {
                    "file": cell.source.file,
                    "page": cell.source.page,
                    "quote": cell.source.quote,
                    "page_text": page_text,
                }
            cells_out[name] = {
                "value": cell.value,
                "status": status,
                "source": source,
                "remark": cell.remark,
            }
        rows.append(
            {
                "category": spec.category,
                "parameter": spec.parameter,
                "unit": spec.unit,
                "mr": spec.mr_requirement,
                "governing": spec.governing,
                "standard": spec.standard,
                "standard_requirement": spec.standard_requirement,
                "cells": cells_out,
            }
        )

    total = len(params)
    compliance = {}
    for name in vendor_names:
        ok = counts[name]["ok"]
        compliance[name] = {
            "ok": ok,
            "total": total,
            "score": f"{ok}/{total}",
            "counts": counts[name],
        }

    # Rank by ok-count desc.
    ranked = sorted(vendor_names, key=lambda n: counts[n]["ok"], reverse=True)
    ranking = " > ".join(f"L{i + 1}: {n} ({compliance[n]['score']})" for i, n in enumerate(ranked))

    # ── Commercial comparative sheet (only if the PR/bids carry commercial data) ──
    commercial = _build_commercial(
        commercial_params, vendor_names, comm_by_vendor, total_price_by_vendor, pages_by_vendor
    )

    return {
        "title": mr.title,
        "mr_summary": mr.mr_summary,
        "standards": mr.standards,
        "standards_verified": bool(research),
        "vendors": vendor_names,
        "rows": rows,
        "compliance": compliance,
        "ranking": ranking,
        "commercial": commercial,
        "model": MODEL,
    }


def _build_commercial(
    commercial_params: list[CommercialParam],
    vendor_names: list[str],
    comm_by_vendor: dict[str, dict[str, Cell]],
    total_price_by_vendor: dict[str, str],
    pages_by_vendor: dict[str, list[Page]],
) -> dict | None:
    """Assemble a commercial comparative sheet. Returns None when no vendor
    submitted any commercial/price information (technical-only evaluation)."""
    has_data = any(comm_by_vendor.get(n) for n in vendor_names) or any(
        _parse_price(total_price_by_vendor.get(n, "")) is not None for n in vendor_names
    )
    if not commercial_params or not has_data:
        return None

    rows: list[dict] = []
    for spec in commercial_params:
        key = spec.parameter.strip().lower()
        cells_out: dict[str, dict] = {}
        for name in vendor_names:
            cell = comm_by_vendor.get(name, {}).get(key)
            if cell is None:
                cells_out[name] = {"value": "—", "status": "na", "source": None, "remark": ""}
                continue
            status = cell.status if cell.status in ("ok", "warn", "fail", "na") else "na"
            source = None
            if cell.source is not None:
                page_text = _locate_page_text(pages_by_vendor[name], cell.source.file, cell.source.page)
                source = {
                    "file": cell.source.file,
                    "page": cell.source.page,
                    "quote": cell.source.quote,
                    "page_text": page_text,
                }
            cells_out[name] = {
                "value": cell.value,
                "status": status,
                "source": source,
                "remark": cell.remark,
            }
        rows.append(
            {
                "category": "Commercial",
                "parameter": spec.parameter,
                "unit": spec.unit,
                "mr": spec.mr_requirement,
                "governing": "pr",
                "standard": "",
                "standard_requirement": "",
                "cells": cells_out,
            }
        )

    # Prices + ranking by lowest total (L1 = cheapest that quoted a price).
    prices = {name: total_price_by_vendor.get(name, "") or "Not quoted" for name in vendor_names}
    parsed = {name: _parse_price(prices[name]) for name in vendor_names}
    quoted = [n for n in vendor_names if parsed[n] is not None]
    ranked = sorted(quoted, key=lambda n: parsed[n])
    ranking = " > ".join(f"L{i + 1}: {n} ({prices[n]})" for i, n in enumerate(ranked))
    awarded = ranked[0] if ranked else None

    return {
        "vendors": vendor_names,
        "rows": rows,
        "prices": prices,
        "ranking": ranking,
        "awarded": awarded,
    }


# Convenience used by the API layer to turn uploaded files into pages.
def build_vendor(name: str, files: list[tuple[str, bytes]]) -> dict:
    # `pages` (extracted text) power the click-cell → source-highlight panel;
    # `files` are kept so scanned/image bid PDFs can be sent to Claude natively.
    pages: list[Page] = []
    for filename, content in files:
        pages.extend(extract_pages(filename, content))
    return {"name": name, "pages": pages, "files": files}
