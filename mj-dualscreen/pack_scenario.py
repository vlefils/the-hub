"""Prepare a standalone web edition of an author's .mjscreen file (requires Pillow)."""

import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image


def pack(source, destination):
    manifest = json.loads(source.read_text(encoding="utf-8"))
    maps = {scene.get("mapAssetId") for scene in manifest["scenes"]}
    maps.update(plan["assetId"] for scene in manifest["scenes"] for plan in scene.get("maps", []))
    for asset in manifest["assets"]:
        if asset["id"] in maps or asset["type"] != "image/png":
            continue
        original = base64.b64decode(asset["data"].split(",", 1)[1])
        output = io.BytesIO()
        with Image.open(io.BytesIO(original)) as image:
            image.save(output, format="WEBP", quality=90, method=4)
        if output.tell() < len(original):
            asset["type"] = "image/webp"
            asset["name"] = str(Path(asset["name"]).with_suffix(".webp"))
            asset["data"] = "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode("ascii")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    pack(args.source, args.destination)
