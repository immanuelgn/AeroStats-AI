from collections import defaultdict, deque
from time import time
from fastapi import HTTPException, Request, UploadFile
from .config import Settings

ALLOWED_EXTENSIONS = {".csv", ".json", ".txt", ".zip"}
SUSPICIOUS_EXTENSIONS = {".exe", ".bat", ".cmd", ".ps1", ".sh", ".js", ".html", ".svg", ".php", ".py"}

_requests: dict[str, deque[float]] = defaultdict(deque)


async def enforce_rate_limit(request: Request, settings: Settings) -> None:
    client = request.client.host if request.client else "unknown"
    now = time()
    bucket = _requests[client]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")
    bucket.append(now)


def validate_upload_file(file: UploadFile, settings: Settings) -> str:
    filename = file.filename or ""
    lowered = filename.lower()
    extension = "." + lowered.rsplit(".", 1)[-1] if "." in lowered else ""
    if extension in SUSPICIOUS_EXTENSIONS or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported or suspicious file type.")
    content_length = file.headers.get("content-length")
    if content_length and int(content_length) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit.")
    return extension


def validate_file_size(content: bytes, settings: Settings) -> None:
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit.")
