"""Validation et normalisation stricte de liens vidéo YouTube.

Seul l'identifiant officiel d'une vidéo est conservé après analyse. Aucune URL
arbitraire ne sera jamais injectée dans le lecteur iframe côté Angular.
"""
import re
from urllib.parse import parse_qs, urlsplit

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}
SHORT_HOSTS = {"youtu.be", "www.youtu.be"}


def youtube_id(value: str) -> str | None:
    text = value.strip()
    if VIDEO_ID.fullmatch(text):
        return text
    try:
        parts = urlsplit(text)
        if parts.scheme not in ("http", "https") or parts.username or parts.password or parts.port:
            return None
        host = (parts.hostname or "").lower()
        segments = [segment for segment in parts.path.split("/") if segment]
        if host in SHORT_HOSTS and len(segments) == 1:
            candidate = segments[0]
        elif host in YOUTUBE_HOSTS and len(segments) == 1 and segments[0] == "watch":
            candidates = parse_qs(parts.query).get("v", [])
            candidate = candidates[0] if len(candidates) == 1 else ""
        elif host in YOUTUBE_HOSTS and len(segments) == 2 and segments[0] in ("embed", "shorts", "live", "v"):
            candidate = segments[1]
        else:
            return None
        return candidate if VIDEO_ID.fullmatch(candidate) else None
    except (ValueError, TypeError):
        return None


def canonical_youtube_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    video = youtube_id(value)
    if not video:
        raise ValueError("Collez un lien YouTube valide (youtube.com, youtu.be ou Shorts).")
    return f"https://www.youtube.com/watch?v={video}"
