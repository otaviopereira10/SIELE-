"""Genera los audios del contenido de ejemplo a partir de content/audio/scripts.json.

Usa voces neuronales sintéticas (paquete edge-tts) de distintas variedades del español y ffmpeg
para unir los fragmentos con pausas. Los audios resultantes se marcan en la plataforma como
«voz sintética». Para un ambiente más cercano al examen, sustitúyalos por grabaciones humanas
desde el panel de administración.

Uso:
    pip install edge-tts
    python scripts/generate_audio.py            # genera los que faltan
    python scripts/generate_audio.py --force    # regenera todos
Requiere ffmpeg en el PATH.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "content" / "audio" / "scripts.json"
OUT_DIR = ROOT / "content" / "audio" / "files"
PUBLIC_DEMO = ROOT / "public" / "demo"


async def synth(text: str, voice: str, target: Path) -> None:
    communicate = edge_tts.Communicate(text, voice, rate="-6%")
    await communicate.save(str(target))


def run_ffmpeg(args: list[str]) -> None:
    result = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr)


async def build(entry: dict, force: bool) -> Path:
    target = OUT_DIR / entry["file"]
    if target.exists() and not force:
        return target
    pause = entry.get("pause_ms", 400) / 1000
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        silence = tmp / "silence.mp3"
        run_ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{pause:.2f}", "-c:a", "libmp3lame", "-b:a", "48k", str(silence)])
        parts: list[Path] = []
        for i, seg in enumerate(entry["segments"]):
            piece = tmp / f"seg{i:03d}.mp3"
            for attempt in range(3):
                try:
                    await synth(seg["text"], seg["voice"], piece)
                    break
                except Exception:  # red inestable: reintentar
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2)
            parts.append(piece)
            parts.append(silence)
        listing = tmp / "list.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(listing), "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", str(target)])
    return target


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        print("ffmpeg no está instalado o no está en el PATH.", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DEMO.mkdir(parents=True, exist_ok=True)
    data = json.loads(SCRIPTS.read_text(encoding="utf-8"))
    for entry in data["files"]:
        path = await build(entry, args.force)
        print(f"ok  {path.relative_to(ROOT)}")
        if entry["file"].startswith("demo-"):
            shutil.copyfile(path, PUBLIC_DEMO / entry["file"])
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
