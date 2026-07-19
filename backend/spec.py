"""Technical specification / RFQ drafting powered by Claude.

Generates an issue-ready equipment specification: a structured parameter datasheet
plus narrative sections, grounded in (in priority order) the customer's own reference
specs/engineering standards, publicly-established values, and standard *references*.

Honesty model: exact code-derived limits that can't be sourced from the reference
documents or well-established public knowledge are NOT fabricated — they come back
flagged (`needs_review=True`, low confidence, a "[confirm per …]" placeholder) so an
engineer confirms them before the RFQ is issued.
"""
from __future__ import annotations

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

from evaluator import MODEL, WEB_SEARCH, _research_standards
from extract import build_document_content


# ── Structured-output schemas ────────────────────────────────────────────────
class SpecParam(BaseModel):
    category: str = Field(description="Section, e.g. 'A. Ratings', 'C. Performance', 'E. Testing'.")
    parameter: str = Field(description="Parameter / requirement name.")
    unit: str = Field(description="Unit, or '-' if not applicable.")
    requirement: str = Field(description="The specified value/requirement. If a code-derived value can't be sourced or confirmed, put a placeholder like '[confirm per IS 1180:2014 Table 6]' rather than a guessed number.")
    basis: str = Field(description="Where the value comes from: 'reference' (customer docs), 'standard' (code-referenced/public), 'engineering' (good-practice default), or 'pr' (user's brief).")
    standard: str = Field(default="", description="Governing standard + clause where applicable, e.g. 'IS 1180:2014 Cl.6'. Empty if none.")
    confidence: str = Field(description="'high' (from a reference doc or the brief), 'medium' (well-established/public), or 'low' (uncertain / needs confirmation).")
    needs_review: bool = Field(default=False, description="True if an engineer must confirm this value before issue (any low-confidence code-derived limit).")
    note: str = Field(default="", description="Brief note — source, or what to confirm. Empty if none.")


class SpecSection(BaseModel):
    heading: str = Field(description="Section heading, e.g. 'Scope', 'Testing & Inspection'.")
    body: str = Field(description="Section text (plain prose / bullet lines). Reference standards by number; never paste copyrighted clause text.")


class SpecDraft(BaseModel):
    title: str = Field(description="Spec title, e.g. the item + a tag like 'Technical Specification'.")
    equipment: str = Field(description="Short equipment identifier.")
    summary: str = Field(description="One or two line summary of what is being procured.")
    standards: list[str] = Field(default_factory=list, description="Applicable standards/codes (number + title + edition where known).")
    sections: list[SpecSection]
    parameters: list[SpecParam]


_SPEC_SYSTEM = """You are a senior EPC procurement & design engineer drafting a Technical Specification /
RFQ datasheet for a piece of equipment, to be issued to vendors for quotation.

Produce:
1. A structured parameter DATASHEET — every parameter a vendor must meet, grouped into ordered,
   letter-prefixed categories (A. Ratings, B. Design, C. Performance, D. Construction, E. Testing,
   F. Documentation, G. Commercial).
2. NARRATIVE sections: Scope, Service / Site Conditions, Design & Construction, Performance,
   Testing & Inspection, Documentation & Drawings, Quality Assurance, Painting & Finish,
   Packing / Marking / Delivery, Guarantee, and Deviations & Compliance.

Sourcing & honesty rules (critical — a wrong limit in an issued RFQ propagates to every bid):
- Identify the applicable standards and REFERENCE them by number + edition. Referencing is fine;
  NEVER reproduce copyrighted clause text or tables.
- For exact code-derived numeric limits (loss/tolerance/material-grade/test-severity values): use the
  CUSTOMER REFERENCE DOCUMENTS provided as the PRIMARY source. When a reference gives the value, set
  basis='reference', confidence='high'.
- For well-established/public requirements (vector groups, IP ratings, standard test lists), use
  basis='standard' or 'engineering', confidence='medium'.
- If a code-derived value is NOT supported by the references and you are not certain, DO NOT invent it.
  Put a placeholder like '[confirm per IS 1180:2014 Table 6]' in `requirement`, set confidence='low'
  and needs_review=true, and say what to confirm in `note`.
- Prefer the 'Current standards research' section (if present) for standard names/editions.
Keep parameter names concise; use '-' for unit when not applicable. Do not leave the datasheet sparse —
cover ratings, design, performance, construction, testing, documentation and commercial terms.
"""


def _client() -> AsyncAnthropic:
    return AsyncAnthropic()


async def generate_spec(brief: str, category: str, reference_files: list[tuple[str, bytes]]) -> dict:
    """Draft a specification/RFQ. `reference_files` are the customer's own licensed
    specs / engineering standards / datasheet templates used as the primary value source."""
    if not brief.strip():
        raise ValueError("No equipment brief provided.")

    client = _client()

    research = await _research_standards(client, f"{brief}\nEquipment category: {category}") if WEB_SEARCH else ""

    header = f"Equipment / brief:\n{brief}\n\nEquipment category: {category}"
    if research:
        header += "\n\n---\nCurrent standards research (editions/limits gathered via web search — prefer for standard names & editions):\n" + research
    if reference_files:
        header += ("\n\n---\nCUSTOMER REFERENCE DOCUMENTS below (their own specs / engineering standards / "
                   "datasheet templates — use as the PRIMARY source for exact code-derived values):")
    else:
        header += ("\n\n(No customer reference documents were provided — reference standards you can justify, "
                   "use well-established public values where sound, and FLAG every code-derived limit you "
                   "cannot confirm for engineer review rather than guessing.)")

    # Scanned reference PDFs are sent to Claude natively (vision); others as text.
    content = build_document_content(header, reference_files)

    resp = await client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=_SPEC_SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=SpecDraft,
    )
    out = resp.parsed_output.model_dump()
    out["standards_verified"] = bool(research)
    out["used_references"] = bool(reference_files)
    out["model"] = MODEL
    return out
