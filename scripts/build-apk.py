#!/usr/bin/env python3
"""Build and sign the standalone Android game; keep update keys local."""
import argparse
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sign-only", action="store_true", help="Sign the already assembled release APK")
    args = parser.parse_args()
    sdk = os.environ.get("ANDROID_SDK_ROOT") or os.environ.get("ANDROID_HOME")
    if not sdk:
        raise SystemExit("Set ANDROID_HOME to an Android SDK with platform 35 and Build Tools 35.0.0.")
    tools = Path(sdk) / "build-tools" / "35.0.0"
    extension = ".bat" if os.name == "nt" else ""
    apksigner = tools / ("apksigner" + extension)
    zipalign = tools / ("zipalign.exe" if os.name == "nt" else "zipalign")
    if not apksigner.is_file() or not zipalign.is_file():
        raise SystemExit("Install Android SDK Build Tools 35.0.0 first.")
    if not args.sign_only:
        run(sys.executable, ROOT / "scripts" / "fetch-runtime-assets.py")
        run("npm.cmd" if os.name == "nt" else "npm", "run", "build")
        wrapper = ROOT / "android" / ("gradlew.bat" if os.name == "nt" else "gradlew")
        run(wrapper, "-p", ROOT / "android", "assembleRelease", "--no-daemon")
    unsigned = ROOT / "android/app/build/outputs/apk/release/app-release-unsigned.apk"
    if not unsigned.is_file():
        raise SystemExit("The unsigned release APK is missing; assembleRelease must finish first.")

    signing = ROOT / "android/.signing"
    signing.mkdir(mode=0o700, exist_ok=True)
    key = Path(os.environ.get("RUNKOV_ANDROID_KEYSTORE", signing / "release.jks"))
    password = Path(os.environ.get("RUNKOV_ANDROID_PASSWORD_FILE", signing / "release.pass"))
    if not key.exists():
        if not password.exists():
            password.parent.mkdir(parents=True, exist_ok=True)
            with password.open("x") as output:
                output.write(secrets.token_urlsafe(48) + "\n")
            password.chmod(0o600)
        run("keytool", "-genkeypair", "-alias", "runkov", "-keyalg", "RSA", "-keysize", "3072",
            "-validity", "10000", "-dname", "CN=Escape from Runkov, O=Duplicityy",
            "-keystore", key, "-storepass:file", password, "-keypass:file", password)
        key.chmod(0o600)
    elif not password.is_file():
        raise SystemExit("The signing key exists but its password file is missing. Restore the matching signing backup.")

    output = ROOT / "artifacts/android"
    output.mkdir(parents=True, exist_ok=True)
    aligned = output / "runkov-aligned.apk"
    apk = output / "Escape-from-Runkov-1.0.apk"
    run(zipalign, "-f", "4", unsigned, aligned)
    run(apksigner, "sign", "--ks", key, "--ks-key-alias", "runkov",
        "--ks-pass", "file:" + str(password),
        "--v1-signing-enabled", "true", "--v2-signing-enabled", "true",
        "--v3-signing-enabled", "true", "--v4-signing-enabled", "false", "--out", apk, aligned)
    run(apksigner, "verify", "--verbose", apk)
    run(zipalign, "-c", "4", apk)
    aligned.unlink()
    checksum = hashlib.sha256()
    with apk.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    digest = checksum.hexdigest()
    apk.with_suffix(".apk.sha256").write_text(f"{digest}  {apk.name}\n")
    print(f"Signed APK: {apk} ({apk.stat().st_size:,} bytes)")
    print("Keep android/.signing backed up privately: updates need the same signing key.")


if __name__ == "__main__":
    main()
