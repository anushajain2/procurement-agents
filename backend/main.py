"""FastAPI backend for the AI Bid Evaluator.

POST /api/evaluate  — multipart form:
    payload            : JSON string {"requirements_text": str,
                                       "vendors": [{"name": str, "file_count": int}, ...]}
    requirement_files  : 0+ files describing the MR requirements (optional)
    vendor_files       : all vendor documents, in vendor order (sliced by file_count)

Returns the Technical Bid Evaluation matrix as JSON, grounded in the uploaded documents.
"""
from __future__ import annotations

import json

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env (ANTHROPIC_API_KEY, optional BID_EVAL_MODEL) before the
# Anthropic client is constructed.
load_dotenv()

from evaluator import build_vendor, evaluate
from extract import extract_pages
from spec import generate_spec
from boq import parse_boq, parse_intake

app = FastAPI(title="AI Bid Evaluator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: frontend on :5174 talks to backend on :8000
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/evaluate")
async def evaluate_endpoint(
    payload: str = Form(...),
    requirement_files: list[UploadFile] = File(default=[]),
    vendor_files: list[UploadFile] = File(default=[]),
) -> dict:
    try:
        meta = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="payload is not valid JSON")

    requirements_text = (meta.get("requirements_text") or "").strip()
    vendor_specs = meta.get("vendors") or []

    # Fold any uploaded requirement documents into the requirements text.
    req_chunks: list[str] = [requirements_text] if requirements_text else []
    for f in requirement_files:
        content = await f.read()
        for page in extract_pages(f.filename, content):
            if page.text:
                req_chunks.append(page.text)
    requirements = "\n\n".join(req_chunks).strip()

    if not requirements:
        raise HTTPException(status_code=400, detail="No requirements provided (text or document).")
    if not vendor_specs:
        raise HTTPException(status_code=400, detail="No vendors provided.")

    # Read all vendor files up front, then slice them per vendor by file_count.
    all_files: list[tuple[str, bytes]] = []
    for f in vendor_files:
        all_files.append((f.filename, await f.read()))

    vendors: list[dict] = []
    cursor = 0
    for spec in vendor_specs:
        name = (spec.get("name") or "Vendor").strip()
        count = int(spec.get("file_count") or 0)
        files = all_files[cursor : cursor + count]
        cursor += count
        if not files:
            raise HTTPException(status_code=400, detail=f"Vendor '{name}' has no documents.")
        vendors.append(build_vendor(name, files))

    try:
        return await evaluate(requirements, vendors)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # surface Anthropic / runtime errors cleanly
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}")


@app.post("/api/generate-spec")
async def generate_spec_endpoint(
    payload: str = Form(...),
    reference_files: list[UploadFile] = File(default=[]),
) -> dict:
    """Draft a technical specification / RFQ.

    payload           : JSON string {"brief": str, "category": str}
    reference_files   : 0+ of the customer's own licensed specs / engineering standards /
                        datasheet templates, used as the primary source for exact values.
    """
    try:
        meta = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="payload is not valid JSON")

    brief = (meta.get("brief") or "").strip()
    category = (meta.get("category") or "Equipment").strip()
    if not brief:
        raise HTTPException(status_code=400, detail="No equipment brief provided.")

    refs: list[tuple[str, bytes]] = []
    for f in reference_files:
        refs.append((f.filename, await f.read()))

    try:
        return await generate_spec(brief, category, refs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Spec generation failed: {exc}")


@app.post("/api/parse-boq")
async def parse_boq_endpoint(
    boq_files: list[UploadFile] = File(default=[]),
    spec_files: list[UploadFile] = File(default=[]),
) -> dict:
    """Parse a BOQ + technical specifications into line items with a suggested
    grouping for bid evaluations."""
    boq: list[tuple[str, bytes]] = [(f.filename, await f.read()) for f in boq_files]
    specs: list[tuple[str, bytes]] = [(f.filename, await f.read()) for f in spec_files]
    if not boq and not specs:
        raise HTTPException(status_code=400, detail="No BOQ or specification documents provided.")
    try:
        return await parse_boq(boq, specs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"BOQ parsing failed: {exc}")


@app.post("/api/parse-intake")
async def parse_intake_endpoint(
    files: list[UploadFile] = File(default=[]),
    text: str = Form(default=""),
) -> dict:
    """Unified intake — detect PR vs BOQ from the uploaded requirement and return
    the items + suggested grouping."""
    docs: list[tuple[str, bytes]] = [(f.filename, await f.read()) for f in files]
    if not docs and not text.strip():
        raise HTTPException(status_code=400, detail="No requirement documents or text provided.")
    try:
        return await parse_intake(docs, text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Requirement parsing failed: {exc}")
