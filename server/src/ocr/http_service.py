"""Private HTTP wrapper for the OCR parser. Run with uvicorn http_service:app."""
import hmac
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

try:
    from .ocr_service import process_file
except ImportError:  # Running directly from this directory.
    from ocr_service import process_file

MAX_BYTES = 10 * 1024 * 1024
MIME_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class ExtractBodyLimitMiddleware:
    """Bound the raw multipart request stream, including chunked requests."""
    def __init__(self, app, limit: int):
        self.app = app
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("path") != "/v1/extract" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return
        received = 0
        exceeded = False
        response_started = False

        async def limited_receive():
            nonlocal received, exceeded
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b""))
                if received > self.limit:
                    exceeded = True
                    return {"type": "http.disconnect"}
            return message

        async def limited_send(message):
            nonlocal response_started
            if not exceeded:
                await send(message)
                return
            if message.get("type") == "http.response.start" and not response_started:
                response_started = True
                await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json")]})
            elif message.get("type") == "http.response.body" and response_started:
                await send({"type": "http.response.body", "body": b'{"detail":"Request exceeds the 10 MB limit"}', "more_body": False})

        await self.app(scope, limited_receive, limited_send)


app.add_middleware(ExtractBodyLimitMiddleware, limit=MAX_BYTES + 64 * 1024)


def valid_signature(content: bytes, mime_type: str) -> bool:
    if mime_type == "application/pdf":
        return content.startswith(b"%PDF-")
    if mime_type == "image/png":
        return content.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10]))
    if mime_type == "image/jpeg":
        return content.startswith(bytes([255, 216, 255]))
    return False


@app.get("/healthz")
async def health():
    return {"status": "UP"}


@app.post("/v1/extract")
async def extract_document(
    file: UploadFile = File(...),
    documentType: str = Form(...),
    authorization: str | None = Header(default=None),
):
    token = os.environ.get("OCR_SERVICE_TOKEN")
    expected = f"Bearer {token}" if token else ""
    if not token or len(token) < 32 or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Authentication required")
    extension = MIME_EXTENSIONS.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=415, detail="Unsupported document content type")

    content = bytearray()
    while True:
        chunk = await file.read(min(1024 * 1024, MAX_BYTES + 1 - len(content)))
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Document exceeds the 10 MB limit")
    content_bytes = bytes(content)
    if not valid_signature(content_bytes, file.content_type or ""):
        raise HTTPException(status_code=400, detail="File signature does not match content type")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="bharatsatya-ocr-", suffix=extension, delete=False) as temp:
            temp_path = temp.name
            temp.write(content_bytes)
        return await run_in_threadpool(process_file, temp_path, documentType)
    except Exception:
        raise HTTPException(status_code=503, detail="Document extraction failed")
    finally:
        await file.close()
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
