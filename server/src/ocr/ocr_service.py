#!/usr/bin/env python3
"""
BharatSatya OCR & Document Parsing Service
Extracts text from text-based PDFs using PyMuPDF, falls back to Tesseract OCR
for scanned documents and image files when installed, and extracts structured fields
(Institution Name, Registration/Reference Number, Issue Date, Expiry Date, Land Area,
FDR Amount, Issuing Authority, Faculty Count, Programme Name) preserving exact page numbers
and bounding-box text coordinates wherever available.
"""

import sys
import os
import json
import re
import shutil
import subprocess
import tempfile
import csv
import io
from datetime import datetime

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

def normalize_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    # YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r'^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})$', date_str)
    if m:
        d, mon, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        return f"{y}-{mon}-{d}"
    return date_str

def get_field_coordinates(fitz_doc, page_num, search_term):
    if not fitz_doc or page_num < 1 or page_num > len(fitz_doc) or not search_term:
        return None
    try:
        page = fitz_doc[page_num - 1]
        term = search_term.strip()[:40]
        rects = page.search_for(term)
        if rects:
            r = rects[0]
            return [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)]
    except Exception:
        pass
    return None

def extract_fields_from_pages(page_data, doc_type, fitz_doc=None):
    """
    page_data: list of tuples (page_num, text, confidence)
    """
    fields = []
    found_field_names = set()

    for page_num, text, page_conf in page_data:
        if not text:
            continue

        # 1. Institution Name
        if 'INSTITUTION_NAME' not in found_field_names:
            inst_match = re.search(
                r'(?:Institution|Institute|College|Trust|Society|Establishment)\s*(?:Name|of)?[:\-]?\s*([A-Za-z0-9\s.,&\'\-]{5,80})',
                text,
                re.IGNORECASE
            )
            if inst_match:
                val = inst_match.group(1).strip().split('\n')[0].strip()
                coords = get_field_coordinates(fitz_doc, page_num, val)
                fields.append({
                    'fieldName': 'INSTITUTION_NAME',
                    'fieldLabel': 'Institution / Sponsoring Legal Entity Name',
                    'fieldValue': val,
                    'originalExtractedValue': val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': inst_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('INSTITUTION_NAME')

        # 2. Registration / Reference Number
        if 'REGISTRATION_REF_NO' not in found_field_names:
            ref_match = re.search(
                r'(?:Reg(?:istration)?\s*(?:No|Number)|Certificate\s*No|Order\s*No|Sanction\s*Order|NOC\s*No|Ref\s*No)[:\-]?\s*([A-Z0-9/\-_]{4,35})',
                text,
                re.IGNORECASE
            )
            if ref_match:
                ref_val = ref_match.group(1).strip()
                coords = get_field_coordinates(fitz_doc, page_num, ref_val)
                fields.append({
                    'fieldName': 'REGISTRATION_REF_NO',
                    'fieldLabel': 'Official Registration / Reference Order Number',
                    'fieldValue': ref_val,
                    'originalExtractedValue': ref_val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': ref_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('REGISTRATION_REF_NO')

        # 3. Issue Date
        if 'ISSUE_DATE' not in found_field_names:
            issue_match = re.search(
                r'(?:Date\s*of\s*Issue|Issue\s*Date|Issued\s*On|Sanction\s*Date|Approved\s*On)[:\-]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})',
                text,
                re.IGNORECASE
            )
            if issue_match:
                norm_issue = normalize_date(issue_match.group(1))
                coords = get_field_coordinates(fitz_doc, page_num, issue_match.group(1))
                fields.append({
                    'fieldName': 'ISSUE_DATE',
                    'fieldLabel': 'Statutory Order Sanction / Issue Date',
                    'fieldValue': norm_issue,
                    'originalExtractedValue': issue_match.group(1),
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': issue_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('ISSUE_DATE')

        # 4. Expiry / Validity Date
        if 'EXPIRY_DATE' not in found_field_names:
            expiry_match = re.search(
                r'(?:Valid\s*(?:Up\s*To|Until|Upto|through)|Expiry\s*Date|Certificate\s*Valid\s*Till)[:\-]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})',
                text,
                re.IGNORECASE
            )
            if expiry_match:
                norm_exp = normalize_date(expiry_match.group(1))
                coords = get_field_coordinates(fitz_doc, page_num, expiry_match.group(1))
                fields.append({
                    'fieldName': 'EXPIRY_DATE',
                    'fieldLabel': 'Statutory Order Validity / Expiry Date',
                    'fieldValue': norm_exp,
                    'originalExtractedValue': expiry_match.group(1),
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': expiry_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('EXPIRY_DATE')

                if doc_type == 'FIRE_SAFETY_NOC':
                    fields.append({
                        'fieldName': 'FIRE_NOC_EXPIRY_DATE',
                        'fieldLabel': 'Fire Safety NOC Validity / Expiry Date',
                        'fieldValue': norm_exp,
                        'originalExtractedValue': expiry_match.group(1),
                        'confidence': page_conf,
                        'evidencePage': page_num,
                        'evidenceSnippet': expiry_match.group(0),
                        'evidenceCoordinates': coords,
                    })
                    found_field_names.add('FIRE_NOC_EXPIRY_DATE')

        # 5. Land Area (Acres)
        if 'LAND_AREA_ACRES' not in found_field_names:
            if doc_type == 'LAND_TITLE_DEED' or 'Acres' in text or 'acres' in text:
                area_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:Acres?|acres?|Ac\b)', text, re.IGNORECASE)
                if area_match:
                    coords = get_field_coordinates(fitz_doc, page_num, area_match.group(0))
                    fields.append({
                        'fieldName': 'LAND_AREA_ACRES',
                        'fieldLabel': 'Contiguous Land Area (Acres)',
                        'fieldValue': area_match.group(1),
                        'originalExtractedValue': area_match.group(0),
                        'confidence': page_conf,
                        'evidencePage': page_num,
                        'evidenceSnippet': area_match.group(0),
                        'evidenceCoordinates': coords,
                    })
                    found_field_names.add('LAND_AREA_ACRES')

        # 6. FDR Amount
        if 'FDR_AMOUNT_INR' not in found_field_names:
            if doc_type == 'FDR_FINANCIAL_ENDOWMENT' or 'FDR' in text or 'Deposit' in text:
                fdr_match = re.search(r'(?:Amount|Principal|Sum\s*of)\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)', text, re.IGNORECASE)
                if fdr_match:
                    numeric_val = fdr_match.group(1).replace(',', '')
                    coords = get_field_coordinates(fitz_doc, page_num, fdr_match.group(0))
                    fields.append({
                        'fieldName': 'FDR_AMOUNT_INR',
                        'fieldLabel': 'Joint FDR Corpus Amount (INR)',
                        'fieldValue': numeric_val,
                        'originalExtractedValue': fdr_match.group(0),
                        'confidence': page_conf,
                        'evidencePage': page_num,
                        'evidenceSnippet': fdr_match.group(0),
                        'evidenceCoordinates': coords,
                    })
                    found_field_names.add('FDR_AMOUNT_INR')

        # 7. Issuing Authority
        if 'ISSUING_AUTHORITY' not in found_field_names:
            auth_match = re.search(
                r'(?:Issuing\s*Authority|Issued\s*By|Competent\s*Authority|Sanctioning\s*Authority|Directorate\s*of|Department\s*of)[:\-]?\s*([A-Za-z0-9\s.,&\'\-]{5,80})',
                text,
                re.IGNORECASE
            )
            if auth_match:
                auth_val = auth_match.group(1).strip().split('\n')[0].strip()
                coords = get_field_coordinates(fitz_doc, page_num, auth_val)
                fields.append({
                    'fieldName': 'ISSUING_AUTHORITY',
                    'fieldLabel': 'Statutory Issuing Authority / Competent Department',
                    'fieldValue': auth_val,
                    'originalExtractedValue': auth_val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': auth_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('ISSUING_AUTHORITY')

        # 8. Faculty Count
        if 'FACULTY_COUNT' not in found_field_names:
            fac_match = re.search(
                r'(?:Faculty\s*Count|Total\s*Faculty|Teaching\s*Faculty|Approved\s*Faculty|Faculty\s*Members?)[:\-]?\s*(\d{1,4})',
                text,
                re.IGNORECASE
            )
            if fac_match:
                coords = get_field_coordinates(fitz_doc, page_num, fac_match.group(0))
                fields.append({
                    'fieldName': 'FACULTY_COUNT',
                    'fieldLabel': 'Approved Teaching Faculty Count',
                    'fieldValue': fac_match.group(1),
                    'originalExtractedValue': fac_match.group(0),
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': fac_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('FACULTY_COUNT')

        # 9. Programme Name
        if 'PROGRAMME_NAME' not in found_field_names:
            prog_match = re.search(
                r'(?:Programme|Program|Course|Discipline)\s*(?:Name)?[:\-]?\s*([A-Za-z0-9\s.,&\'\-]{3,60})',
                text,
                re.IGNORECASE
            )
            if prog_match:
                prog_val = prog_match.group(1).strip().split('\n')[0].strip()
                coords = get_field_coordinates(fitz_doc, page_num, prog_val)
                fields.append({
                    'fieldName': 'PROGRAMME_NAME',
                    'fieldLabel': 'Approved Academic Discipline / Programme',
                    'fieldValue': prog_val,
                    'originalExtractedValue': prog_val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': prog_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('PROGRAMME_NAME')

        # 10. AICTE Permanent Institution ID
        if 'AICTE_PERMANENT_ID' not in found_field_names:
            pid_match = re.search(
                r'(?:AICTE\s*(?:Permanent\s*ID|PID|Perm\s*ID)|Permanent\s*(?:Institute\s*ID|Institution\s*ID|ID))[:\-]?\s*([1-9][0-9\-_]{3,20}|AICTE-[A-Z0-9\-_]+)',
                text,
                re.IGNORECASE
            )
            if pid_match:
                pid_val = pid_match.group(1).strip()
                coords = get_field_coordinates(fitz_doc, page_num, pid_val)
                fields.append({
                    'fieldName': 'AICTE_PERMANENT_ID',
                    'fieldLabel': 'AICTE Permanent Institution ID',
                    'fieldValue': pid_val,
                    'originalExtractedValue': pid_val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': pid_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('AICTE_PERMANENT_ID')

        # 11. Application Reference Number
        if 'APPLICATION_REF_NO' not in found_field_names:
            app_ref_match = re.search(
                r'(?:Application\s*(?:Ref(?:erence)?\s*(?:No|Number|ID)?|Number|No|ID)|Dossier\s*(?:Ref|No))[:\-]?\s*([A-Z0-9\-_/]{4,35})',
                text,
                re.IGNORECASE
            )
            if app_ref_match:
                app_ref_val = app_ref_match.group(1).strip()
                coords = get_field_coordinates(fitz_doc, page_num, app_ref_val)
                fields.append({
                    'fieldName': 'APPLICATION_REF_NO',
                    'fieldLabel': 'Application Reference / Dossier Number',
                    'fieldValue': app_ref_val,
                    'originalExtractedValue': app_ref_val,
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': app_ref_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('APPLICATION_REF_NO')

        # 12. Approved Annual Student Intake
        if 'APPROVED_INTAKE' not in found_field_names:
            intake_match = re.search(
                r'(?:Approved\s*(?:Intake|Capacity|Seats)|Annual\s*Intake|Sanctioned\s*Intake|Intake)[:\-]?\s*(\d{1,5})',
                text,
                re.IGNORECASE
            )
            if intake_match:
                intake_val = intake_match.group(1).strip()
                coords = get_field_coordinates(fitz_doc, page_num, intake_match.group(0))
                fields.append({
                    'fieldName': 'APPROVED_INTAKE',
                    'fieldLabel': 'Approved Annual Student Intake',
                    'fieldValue': intake_val,
                    'originalExtractedValue': intake_match.group(0),
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': intake_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('APPROVED_INTAKE')

        # 13. Statutory Approval / Certificate Validity Status
        if 'VALIDITY_STATUS' not in found_field_names:
            stat_match = re.search(
                r'(?:Validity\s*Status|Approval\s*Status|Order\s*Status|Clearance\s*Status)[:\-]?\s*(APPROVED|VALID|GRANTED|SUBSISTING|PROVISIONAL|EXTENDED|COMPLIANT)',
                text,
                re.IGNORECASE
            )
            if stat_match:
                stat_val = stat_match.group(1).strip().upper()
                coords = get_field_coordinates(fitz_doc, page_num, stat_match.group(0))
                fields.append({
                    'fieldName': 'VALIDITY_STATUS',
                    'fieldLabel': 'Statutory Approval / Certificate Validity Status',
                    'fieldValue': stat_val,
                    'originalExtractedValue': stat_match.group(0),
                    'confidence': page_conf,
                    'evidencePage': page_num,
                    'evidenceSnippet': stat_match.group(0),
                    'evidenceCoordinates': coords,
                })
                found_field_names.add('VALIDITY_STATUS')

        # Floor-plan areas (m²) feeding the infrastructure norm rules
        if doc_type == 'FLOOR_PLAN':
            for field_name, field_label, label_pattern in (
                ('LIBRARY_AREA_SQM', 'Library and Reading Room Area (m²)', r'Library|Reading\s*Room'),
                ('CLASSROOM_AREA_SQM', 'Total Classroom Area (m²)', r'Class\s*rooms?'),
            ):
                if field_name in found_field_names:
                    continue
                area_match = re.search(
                    r'(?:' + label_pattern + r')[^\n\d]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm|m2|m²|square\s*met)',
                    text,
                    re.IGNORECASE
                )
                if area_match:
                    coords = get_field_coordinates(fitz_doc, page_num, area_match.group(0))
                    fields.append({
                        'fieldName': field_name,
                        'fieldLabel': field_label,
                        'fieldValue': area_match.group(1).replace(',', ''),
                        'originalExtractedValue': area_match.group(0),
                        'confidence': page_conf,
                        'evidencePage': page_num,
                        'evidenceSnippet': area_match.group(0),
                        'evidenceCoordinates': coords,
                    })
                    found_field_names.add(field_name)

    return fields

def extract_fields(text, doc_type):
    """Backward-compatible single-text extraction helper."""
    return extract_fields_from_pages([(1, text, None)], doc_type)

def process_file(file_path, doc_type):
    if not os.path.exists(file_path):
        return {
            'rawText': '',
            'confidence': None,
            'fields': [],
            'error': f'File not found: {file_path}',
            'isRecoverable': True
        }

    if fitz is None:
        return {'rawText': '', 'confidence': None, 'fields': [], 'error': 'PyMuPDF is not installed.', 'isRecoverable': True}

    doc = None
    try:
        doc = fitz.open(file_path)
        pages = list(doc)
        if not pages:
            return {'rawText': '', 'confidence': None, 'fields': [], 'error': 'Document contains no pages.', 'isRecoverable': True}
        if len(pages) > 100:
            return {'rawText': '', 'confidence': None, 'fields': [], 'error': 'Document exceeds the 100-page extraction limit.', 'isRecoverable': True}

        page_texts = [page.get_text() for page in pages]
        text_confidence = None

        # Check if digital embedded text was found
        if not ''.join(page_texts).strip():
            if len(pages) > 6:
                return {'rawText': '', 'confidence': None, 'fields': [], 'error': 'Scanned document exceeds the 6-page OCR processing limit.', 'isRecoverable': True}
            tesseract = shutil.which('tesseract')
            if not tesseract:
                return {'rawText': '', 'confidence': None, 'fields': [], 'error': 'No embedded text was found and Tesseract is unavailable for OCR.', 'isRecoverable': True}
            language = os.environ.get('OCR_TESSERACT_LANG', 'eng')
            recognized = []
            word_scores = []
            with tempfile.TemporaryDirectory(prefix='bharatsatya-ocr-') as work_dir:
                for index, page in enumerate(pages):
                    image_path = os.path.join(work_dir, f'page-{index + 1}.png')
                    page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(image_path)
                    result = subprocess.run([tesseract, image_path, 'stdout', '-l', language, 'tsv'], capture_output=True, text=True, timeout=15, check=True)
                    lines = {}
                    for row in csv.DictReader(io.StringIO(result.stdout), delimiter='\t'):
                        try:
                            score = float(row.get('conf', '-1'))
                            if score >= 0 and row.get('text', '').strip():
                                word_scores.append(score)
                                line_id = (row.get('block_num'), row.get('par_num'), row.get('line_num'))
                                lines.setdefault(line_id, []).append(row['text'].strip())
                        except (TypeError, ValueError):
                            pass
                    recognized.append('\n'.join(' '.join(words) for words in lines.values()))
            page_texts = recognized
            text_confidence = (sum(word_scores) / len(word_scores) / 100) if word_scores else None

        raw_text = '\n'.join(page_texts).strip()
        if not raw_text:
            return {'rawText': '', 'confidence': text_confidence, 'fields': [], 'error': 'No readable text was extracted from the document.', 'isRecoverable': True}

        # Build page_data for extraction
        page_data = [(idx + 1, p_text, text_confidence) for idx, p_text in enumerate(page_texts)]
        fields = extract_fields_from_pages(page_data, doc_type, fitz_doc=doc)

        return {'rawText': raw_text[:5000], 'confidence': text_confidence, 'fields': fields, 'error': None, 'isRecoverable': True}
    except Exception as exc:
        return {'rawText': '', 'confidence': None, 'fields': [], 'error': f'Document could not be read or OCR failed: {type(exc).__name__}.', 'isRecoverable': True}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Missing arguments. Usage: python ocr_service.py <file_path> [doc_type]'}))
        sys.exit(1)

    file_path = sys.argv[1]
    doc_type = sys.argv[2] if len(sys.argv) > 2 else 'GENERAL'

    result = process_file(file_path, doc_type)
    print(json.dumps(result))
