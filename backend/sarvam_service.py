"""Optional Sarvam API adapters and conservative spoken-reference binding.

The service is fully disabled until SARVAM_API_KEY is supplied. Voice transcripts
and model tool calls are treated as untrusted input; financial truth stays in engine.py.
"""
from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
from typing import Any

import requests


def _load_local_env() -> None:
    """Load backend/.env without overriding process-level environment variables."""
    env_path = Path(__file__).with_name(".env")
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key.replace("_", "").isalnum():
            os.environ.setdefault(key, value)


_load_local_env()

SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
SARVAM_CHAT_MODEL = os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b")
SARVAM_ASR_MODEL = os.getenv("SARVAM_ASR_MODEL", "saaras:v4")
SARVAM_TTS_MODEL = os.getenv("SARVAM_TTS_MODEL", "bulbul:v4-flash")
SARVAM_TTS_SPEAKER = os.getenv("SARVAM_TTS_SPEAKER", "").strip()


def api_key() -> str:
    return os.getenv("SARVAM_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(api_key())


def _headers() -> dict[str, str]:
    key = api_key()
    if not key:
        raise RuntimeError("SARVAM_API_KEY is not configured")
    return {"api-subscription-key": key}


def transcribe_audio(audio: bytes, filename: str, keyterms: list[str] | None = None, content_type: str | None = None) -> dict[str, Any]:
    if not audio:
        raise ValueError("Audio upload is empty")
    if len(audio) > 10 * 1024 * 1024:
        raise ValueError("Audio upload must be 10 MB or smaller")
    data = {"model": SARVAM_ASR_MODEL}
    if SARVAM_ASR_MODEL == "saaras:v3":
        data["mode"] = "transcribe"
    terms = [str(x)[:64] for x in (keyterms or [])[:50] if str(x).strip()]
    if SARVAM_ASR_MODEL == "saaras:v4" and terms:
        data["keyterms"] = json.dumps(terms, ensure_ascii=False)
    response = requests.post(
        f"{SARVAM_BASE_URL}/speech-to-text",
        headers=_headers(),
        files={"file": (filename or "merchant-audio.webm", audio, content_type or "application/octet-stream")},
        data=data,
        timeout=45,
    )
    response.raise_for_status()
    body = response.json()
    transcript = str(body.get("transcript") or "").strip()
    if not transcript:
        raise RuntimeError("Sarvam returned an empty transcript")
    return {"transcript": transcript, "language_code": body.get("language_code"), "request_id": body.get("request_id"), "model": SARVAM_ASR_MODEL, "mode": "LIVE_SAARAS_ASR"}


def synthesize_speech(text: str, language_code: str = "hi-IN") -> bytes:
    clean = str(text).strip()
    if not clean:
        raise ValueError("Text for speech is empty")
    if len(clean) > 2500:
        clean = clean[:2500]
    payload: dict[str, Any] = {
        "text": clean,
        "language_code": language_code,
        "model": SARVAM_TTS_MODEL,
        "speech_sample_rate": 24000,
        "pace": 1.0,
        "output_audio_codec": "wav",
    }
    if SARVAM_TTS_SPEAKER:
        payload["speaker"] = SARVAM_TTS_SPEAKER
    response = requests.post(
        f"{SARVAM_BASE_URL}/text-to-speech",
        headers={**_headers(), "Content-Type": "application/json"},
        json=payload,
        timeout=45,
    )
    response.raise_for_status()
    body = response.json()
    audios = body.get("audios") or []
    if not audios or not isinstance(audios[0], str):
        raise RuntimeError("Sarvam returned no valid base64 audio")
    try:
        decoded = base64.b64decode(audios[0], validate=True)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Sarvam returned malformed base64 audio") from exc
    if not decoded:
        raise RuntimeError("Sarvam returned an empty audio payload")
    return decoded


def chat_completion(messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
    response = requests.post(
        f"{SARVAM_BASE_URL}/v1/chat/completions",
        headers={**_headers(), "Content-Type": "application/json"},
        json={"model": SARVAM_CHAT_MODEL, "messages": messages, "tools": tools, "tool_choice": "auto", "parallel_tool_calls": False, "reasoning_effort": None, "max_tokens": 500},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def normalize_reference(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value).upper())


def levenshtein_distance(a: str, b: str) -> int:
    """Standard dynamic-programming Levenshtein distance; O(min(n,m)) memory."""
    a, b = str(a), str(b)
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1]


def suggest_reference_binding(spoken: str, candidates: list[dict[str, str]], max_distance: int = 2) -> dict[str, Any]:
    """Suggest a single closest candidate but always require explicit confirmation."""
    spoken_norm = normalize_reference(spoken)
    if not spoken_norm:
        return {"status": "NO_REFERENCE", "spoken": spoken, "candidates": [], "requires_confirmation": True}
    scored = []
    for candidate in candidates:
        candidate_id = str(candidate.get("id", ""))
        candidate_norm = normalize_reference(candidate_id)
        if not candidate_norm:
            continue
        distance = levenshtein_distance(spoken_norm, candidate_norm)
        if distance <= max_distance:
            scored.append({"id": candidate_id, "label": str(candidate.get("label") or candidate_id), "distance": distance})
    scored.sort(key=lambda item: (item["distance"], item["id"]))
    if not scored:
        return {"status": "NO_SAFE_MATCH", "spoken": spoken, "candidates": [], "requires_confirmation": True}
    best_distance = scored[0]["distance"]
    best = [item for item in scored if item["distance"] == best_distance]
    if len(best) != 1:
        return {"status": "AMBIGUOUS", "spoken": spoken, "candidates": best[:5], "requires_confirmation": True}
    return {"status": "EXACT_MATCH" if best_distance == 0 else "CANDIDATE_REQUIRES_CONFIRMATION", "spoken": spoken, "candidate": best[0], "alternatives": scored[1:5], "requires_confirmation": True, "warning": "ASR text is not authoritative. Confirm the reference against the source record before acting."}
