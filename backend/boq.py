"""BOQ + technical-specification parsing powered by Claude.

Given a Bill of Quantities and the accompanying technical specifications, extract
the BOQ line items, attach the technical requirements for each, classify each
item's spec as 'simple' or 'detailed', and propose how to group them into bid
evaluations — bundling simple commodity items into a single combined sheet and
giving each detailed / engineered item its own sheet.
"""
from __future__ import annotations

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

from evaluator import MODEL
from extract import extract_pages, pages_to_corpus, build_document_content


class BoqItem(BaseModel):
    item_no: str = Field(description="BOQ serial / item number as printed, or a running index if none.")
    description: str = Field(description="Concise item description as in the BOQ.")
    unit: str = Field(description="Unit of measure (nos, set, m, lot…), or '-'.")
    quantity: str = Field(description="Quantity as stated, or '-' if not given.")
    category: str = Field(description="Equipment category, e.g. 'Power Transformers', 'Switchgear', 'Cables'.")
    complexity: str = Field(description="'simple' (commodity, few parameters) or 'detailed' (engineered, many parameters / a full datasheet).")
    spec_summary: str = Field(description="The KEY technical requirements for this item from the specification — ratings, standards, material, tests, commercial terms — written as enough detail to evaluate a vendor bid against. If the spec is silent, say so.")
    group: str = Field(description="Group key. Items that should be evaluated on ONE combined sheet share the same key; each detailed item gets its own unique key.")


class BoqGroup(BaseModel):
    group: str = Field(description="Group key matching the items' `group`.")
    title: str = Field(description="Short evaluation title for this group.")
    combined: bool = Field(description="True if this group bundles multiple simple items into one sheet.")
    rationale: str = Field(description="One line: why these are combined, or why this item is on its own.")


class BoqParse(BaseModel):
    doc_type: str = Field(default="boq", description="'pr' if the upload is a single-item or closely-related Purchase Requisition / specification; 'boq' if it is a multi-item Bill of Quantities.")
    title: str = Field(description="Overall tender / package title.")
    summary: str = Field(description="One or two line summary of the package.")
    clarity: str = Field(default="clear", description="'clear' if the requirement is specific enough to confidently draft an RFQ / technical specification from without guessing what the buyer wants. 'ambiguous' if it is a thin/vague free-text description where the exact equipment, ratings, or scope cannot be pinned down without assuming.")
    clarity_note: str = Field(default="", description="If ambiguous, a one-line note on what is unclear or missing (e.g. 'rating, standard and application not specified'). Empty if clear.")
    items: list[BoqItem]
    groups: list[BoqGroup]


_BOQ_SYSTEM = """You are a senior procurement engineer preparing technical bid evaluations from a
tender package. You are given a Bill of Quantities (BOQ) and the technical specification documents.

Do two things:
1. Extract every BOQ line item: item number, description, unit, quantity, and the equipment category.
   For each item, pull the KEY technical requirements from the specification into `spec_summary`
   (ratings, applicable standards, material, tests, documentation, commercial terms) — enough detail
   that a vendor's bid could be evaluated against it. If the spec doesn't cover an item, say so.
2. Classify each item's spec as 'simple' (a commodity with only a handful of parameters) or 'detailed'
   (an engineered item with a full datasheet / many parameters).
3. Propose GROUPING for evaluation:
   - Bundle SIMPLE items of a similar nature into ONE combined evaluation group (same `group` key) so
     they can share a single comparison sheet.
   - Give each DETAILED item its OWN group (unique `group` key) so it gets a dedicated sheet.
   Return a `groups` entry for every distinct group key, with a title, `combined` flag, and a one-line
   rationale.

Be faithful to the documents — do not invent items or requirements. Keep descriptions concise.
"""


_INTAKE_SYSTEM = """You are a senior procurement engineer triaging an uploaded procurement requirement.
The upload may be EITHER a Purchase Requisition / technical specification for a single item (or a few
closely-related items), OR a Bill of Quantities (BOQ) listing many items with specifications.

First decide `doc_type`: 'pr' (single item / a few closely-related items) or 'boq' (a multi-item BOQ).

Then extract the line items. For a PR this is usually ONE item — but if the document genuinely covers
separable items that would each need their own evaluation, split them. For a BOQ, extract every line item.
For each item give item number, description, unit, quantity, category, a 'simple'/'detailed' complexity,
and pull the KEY technical requirements into `spec_summary` (ratings, standards, material, tests,
documentation, commercial terms) — enough to evaluate a vendor bid against, or to draft an RFQ from.

Then propose GROUPING for evaluation:
- Bundle SIMPLE items of a similar nature into ONE combined evaluation group (same `group` key).
- Give each DETAILED item its OWN group.
Return a `groups` entry for every distinct group key (title, `combined` flag, one-line rationale).
For a single-item PR, that is simply one group with one item.

CLARITY (important — do NOT assume what the buyer wants):
- If actual documents/specifications are attached, or the text is specific enough to draft an RFQ from
  with confidence, set clarity='clear'.
- If the input is only a short free-text description and the exact equipment, rating/capacity, governing
  standard, or scope genuinely cannot be determined without guessing, set clarity='ambiguous' and put a
  one-line `clarity_note` on what is missing. When ambiguous, still extract your best-effort item(s) and
  spec_summary, but do NOT fabricate specific ratings or requirements the buyer did not state.

Be faithful to the documents — do not invent items or requirements. Keep descriptions concise.
"""


def _client() -> AsyncAnthropic:
    return AsyncAnthropic()


async def parse_intake(files: list[tuple[str, bytes]], text: str = "") -> dict:
    """Unified intake: detect whether the upload is a PR or a BOQ, then extract
    items + a suggested grouping. `files` may mix a BOQ and its specifications."""
    if not files and not text.strip():
        raise ValueError("No requirement documents or text provided.")

    client = _client()

    # Scanned/image PDFs (no extractable text) are sent to Claude natively (vision).
    content = build_document_content(
        "UPLOADED DOCUMENTS (a PR, or a BOQ + technical specifications — determine which):",
        files, text,
    )

    resp = await client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=_INTAKE_SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=BoqParse,
    )
    out = resp.parsed_output.model_dump()
    out["model"] = MODEL
    return out


async def parse_boq(boq_files: list[tuple[str, bytes]], spec_files: list[tuple[str, bytes]]) -> dict:
    if not boq_files and not spec_files:
        raise ValueError("No BOQ or specification documents provided.")

    client = _client()

    boq_pages = []
    for filename, content in boq_files:
        boq_pages.extend(extract_pages(filename, content))
    boq_corpus, _ = pages_to_corpus(boq_pages, max_chars=40000)

    spec_pages = []
    for filename, content in spec_files:
        spec_pages.extend(extract_pages(filename, content))
    spec_corpus, spec_trunc = pages_to_corpus(spec_pages, max_chars=80000)

    user = (
        f"BILL OF QUANTITIES:\n{boq_corpus or '(none provided)'}\n\n"
        f"TECHNICAL SPECIFICATIONS:\n{spec_corpus or '(none provided)'}"
    )
    if spec_trunc:
        user += "\n\n(Specifications were long and have been truncated.)"

    resp = await client.messages.parse(
        model=MODEL,
        max_tokens=12000,
        system=_BOQ_SYSTEM,
        messages=[{"role": "user", "content": user}],
        output_format=BoqParse,
    )
    out = resp.parsed_output.model_dump()
    out["model"] = MODEL
    return out
