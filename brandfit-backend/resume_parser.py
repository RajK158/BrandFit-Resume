"""Local resume text extraction for Impulso (PDF / DOCX)."""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import List, Optional, Tuple

from docx import Document
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, PdfReadError

MAX_RESUME_BYTES = 5 * 1024 * 1024
MAX_RESUME_CHARS_FOR_AI = 50000
MIN_EXTRACTED_CHARS = 40

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


class ResumeExtractionError(Exception):
    """Raised when a resume file cannot be validated or read."""


@dataclass
class ExtractedResumeText:
    file_name: str
    text: str
    character_count: int
    truncated_for_ai: bool
    ai_text: str
    warnings: List[str]


def _extension(filename: str) -> str:
    name = (filename or "").strip().lower()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1]


def validate_resume_upload(
    filename: Optional[str],
    content_type: Optional[str],
    file_bytes: bytes,
) -> str:
    if file_bytes is None or len(file_bytes) == 0:
        raise ResumeExtractionError("The uploaded file is empty.")

    if len(file_bytes) > MAX_RESUME_BYTES:
        raise ResumeExtractionError("Resume must be 5 MB or smaller.")

    ext = _extension(filename or "")
    mime = (content_type or "").split(";")[0].strip().lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ResumeExtractionError("Unsupported file type. Please upload a PDF or DOCX file.")

    if mime and mime not in ALLOWED_CONTENT_TYPES and mime != "application/octet-stream":
        # Some browsers send odd MIME types; extension remains authoritative for PDF/DOCX.
        if ext not in ALLOWED_EXTENSIONS:
            raise ResumeExtractionError("Unsupported file type. Please upload a PDF or DOCX file.")

    return ext


def _extract_pdf_text(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes), strict=False)
    except FileNotDecryptedError as exc:
        raise ResumeExtractionError(
            "This PDF appears to be encrypted or password-protected. Please upload an unlocked file."
        ) from exc
    except PdfReadError as exc:
        raise ResumeExtractionError(
            "The PDF could not be read. It may be corrupted or unreadable."
        ) from exc
    except Exception as exc:
        raise ResumeExtractionError(
            "Failed to open the PDF file. It may be corrupted or unsupported."
        ) from exc

    if getattr(reader, "is_encrypted", False):
        try:
            result = reader.decrypt("")
            if result == 0:
                raise ResumeExtractionError(
                    "This PDF appears to be encrypted or password-protected. Please upload an unlocked file."
                )
        except ResumeExtractionError:
            raise
        except Exception as exc:
            raise ResumeExtractionError(
                "This PDF appears to be encrypted or password-protected. Please upload an unlocked file."
            ) from exc

    chunks: List[str] = []
    try:
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ""
            except Exception:
                page_text = ""
            if page_text.strip():
                chunks.append(page_text)
    except Exception as exc:
        raise ResumeExtractionError(
            "Failed while extracting text from the PDF. The file may be corrupted."
        ) from exc

    text = "\n".join(chunks).strip()
    if not text:
        raise ResumeExtractionError(
            "No readable text could be extracted. The PDF may be image-only or scanned. "
            "Please upload a text-based resume."
        )
    return text


def _extract_docx_text(file_bytes: bytes) -> str:
    try:
        document = Document(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ResumeExtractionError(
            "The DOCX file could not be read. It may be corrupted or unreadable."
        ) from exc

    parts: List[str] = []
    for paragraph in document.paragraphs:
        value = (paragraph.text or "").strip()
        if value:
            parts.append(value)

    for table in document.tables:
        for row in table.rows:
            cells = [(cell.text or "").strip() for cell in row.cells]
            row_text = " | ".join(cell for cell in cells if cell)
            if row_text:
                parts.append(row_text)

    text = "\n".join(parts).strip()
    if not text:
        raise ResumeExtractionError(
            "No readable text could be extracted from the DOCX file."
        )
    return text


def extract_resume_text(
    filename: Optional[str],
    content_type: Optional[str],
    file_bytes: bytes,
) -> ExtractedResumeText:
    ext = validate_resume_upload(filename, content_type, file_bytes)
    safe_name = (filename or f"resume{ext}").strip() or f"resume{ext}"

    if ext == ".pdf":
        text = _extract_pdf_text(file_bytes)
    else:
        text = _extract_docx_text(file_bytes)

    cleaned = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    cleaned = "\n".join(line for line in cleaned.splitlines() if line.strip())

    if len(cleaned) < MIN_EXTRACTED_CHARS:
        raise ResumeExtractionError(
            "Extracted text is too short to parse reliably. "
            "The file may be image-only, sparse, or unreadable."
        )

    warnings: List[str] = []
    truncated = len(cleaned) > MAX_RESUME_CHARS_FOR_AI
    ai_text = cleaned[:MAX_RESUME_CHARS_FOR_AI]
    if truncated:
        warnings.append(
            f"Resume text was truncated to {MAX_RESUME_CHARS_FOR_AI} characters before AI parsing."
        )

    return ExtractedResumeText(
        file_name=safe_name,
        text=cleaned,
        character_count=len(cleaned),
        truncated_for_ai=truncated,
        ai_text=ai_text,
        warnings=warnings,
    )


def prepare_text_for_ai(extracted: ExtractedResumeText) -> Tuple[str, List[str]]:
    return extracted.ai_text, list(extracted.warnings)
