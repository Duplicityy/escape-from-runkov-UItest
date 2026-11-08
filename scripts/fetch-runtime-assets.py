#!/usr/bin/env python3
"""Fetch the pinned OSRS runtime files used by the Runkov release.

Only Python's standard library is required. curl is used when installed;
otherwise urllib handles downloads. Both inherit normal proxy/CA settings.
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
DEFAULT_MANIFEST = SCRIPT_DIR / "runtime-assets.json"
DEFAULT_DEST = REPO_DIR / "public" / "assets"
CURL = shutil.which("curl")
READ_SIZE = 1024 * 1024


def read_manifest(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") != 1 or data.get("columns") != ["path", "bytes", "sha256"]:
        raise ValueError("Unsupported runtime asset manifest format")
    entries = []
    seen = set()
    for row in data.get("files", []):
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError("Each manifest entry needs path, byte size and SHA-256")
        name, size, digest = row
        if not isinstance(name, str) or not name or "\\" in name:
            raise ValueError(f"Invalid asset path: {name!r}")
        relative = PurePosixPath(name)
        if relative.is_absolute() or ".." in relative.parts or name in seen:
            raise ValueError(f"Unsafe or duplicate asset path: {name!r}")
        if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
            raise ValueError(f"Invalid byte size for {name}")
        if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
            raise ValueError(f"Invalid SHA-256 for {name}")
        seen.add(name)
        entries.append((name, size, digest))
    if not entries:
        raise ValueError("Runtime asset manifest is empty")
    return data, entries


def validate(path, entry):
    name, expected_size, expected_digest = entry
    if not path.is_file():
        raise ValueError("file is missing")
    actual_size = path.stat().st_size
    if actual_size != expected_size:
        raise ValueError(f"expected {expected_size:,} bytes, found {actual_size:,}")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        header = stream.read(256)
        digest.update(header)
        for chunk in iter(lambda: stream.read(READ_SIZE), b""):
            digest.update(chunk)
    if header.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        raise ValueError("server returned HTML instead of a runtime asset")
    if name.endswith(".glb"):
        if len(header) < 12 or header[:4] != b"glTF":
            raise ValueError("invalid GLB header")
        version, declared_size = struct.unpack("<II", header[4:12])
        if version != 2 or declared_size != actual_size:
            raise ValueError("invalid GLB version or declared length")
    elif name.endswith(".png"):
        if header[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("invalid PNG header")
    elif name.endswith(".json"):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, UnicodeError) as error:
            raise ValueError(f"invalid JSON: {error}") from error
    if digest.hexdigest() != expected_digest:
        raise ValueError("SHA-256 differs from the pinned release asset")


def download(url, path):
    if CURL:
        result = subprocess.run(
            [CURL, "--fail", "--location", "--silent", "--show-error",
             "--connect-timeout", "20", "--max-time", "180",
             "--output", str(path), url],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            check=False,
        )
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or f"curl exited {result.returncode}")
        return
    request = Request(url, headers={"User-Agent": "Runkov-runtime-assets/1.0"})
    with urlopen(request, timeout=180) as response, path.open("wb") as output:
        shutil.copyfileobj(response, output, length=READ_SIZE)


def fetch(entry, destination, base_url, verify_only):
    name, size, _ = entry
    target = destination.joinpath(*PurePosixPath(name).parts)
    try:
        validate(target, entry)
        return name, size, "verified", None
    except (OSError, ValueError) as error:
        if verify_only:
            return name, 0, "failed", str(error)
    target.parent.mkdir(parents=True, exist_ok=True)
    url = urljoin(base_url, quote(name, safe="/"))
    last_error = ""
    for attempt in range(3):
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=target.parent, prefix=target.name + ".", suffix=".part", delete=False
            ) as stream:
                temporary = Path(stream.name)
            download(url, temporary)
            validate(temporary, entry)
            os.replace(temporary, target)
            return name, size, "downloaded", None
        except (OSError, ValueError, RuntimeError) as error:
            last_error = str(error)
            if attempt < 2:
                time.sleep(1 << attempt)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return name, 0, "failed", f"after 3 attempts: {last_error}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    parser.add_argument("--base-url", help="Override the manifest's source URL")
    parser.add_argument("--workers", type=int, default=12, help="Concurrent files, 1 to 16 (default: 12)")
    parser.add_argument("--verify-only", action="store_true", help="Check local files; never access the network")
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        parser.error("--workers must be between 1 and 16")
    try:
        metadata, entries = read_manifest(args.manifest.resolve())
        base_url = (args.base_url or metadata["baseUrl"]).rstrip("/") + "/"
        source = urlparse(base_url)
        if source.scheme not in ("https", "http") or not source.netloc or source.query or source.fragment:
            raise ValueError("--base-url must be an HTTP(S) directory URL")
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))
    destination = args.dest.resolve()
    total_bytes = sum(entry[1] for entry in entries)
    mode = "Verifying" if args.verify_only else "Fetching"
    print(f"{mode} {len(entries):,} pinned files ({total_bytes:,} bytes) in {destination}", flush=True)
    completed = verified = downloaded = verified_bytes = 0
    failures = []
    started = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(fetch, entry, destination, base_url, args.verify_only): entry[0]
            for entry in entries
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                name, size, status, error = future.result()
            except Exception as error:
                failures.append((futures[future], str(error)))
                print(f"ERROR {futures[future]}: {error}", file=sys.stderr, flush=True)
            else:
                verified_bytes += size
                verified += status == "verified"
                downloaded += status == "downloaded"
                if error:
                    failures.append((name, error))
                    print(f"ERROR {name}: {error}", file=sys.stderr, flush=True)
            completed += 1
            if completed % 100 == 0 or completed == len(entries):
                print(
                    f"{completed:,}/{len(entries):,} files; {verified_bytes:,}/{total_bytes:,} bytes; "
                    f"{verified:,} cached, {downloaded:,} downloaded, {len(failures):,} failed",
                    flush=True,
                )
    elapsed = time.monotonic() - started
    if failures:
        print(f"Asset validation failed for {len(failures):,} files after {elapsed:.1f}s.", file=sys.stderr)
        return 1
    print(f"All {len(entries):,} files match the pinned sizes, SHA-256 hashes and formats ({elapsed:.1f}s).", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
