from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PLAYER_DIR = ROOT / "assets" / "barca-brand" / "players"
PLAYER_WEBP_DIR = PLAYER_DIR / "webp"
PLAYER_THUMB_DIR = PLAYER_DIR / "thumbs"
NEWS_DIR = ROOT / "assets" / "news"
BRAND_DIR = ROOT / "assets" / "barca-brand"


def save_webp(source: Path, destination: Path, max_size: tuple[int, int] | None, quality: int) -> None:
    if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
        return
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        if max_size:
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=quality, method=4, exact=image.mode == "RGBA")


PLAYER_WEBP_DIR.mkdir(parents=True, exist_ok=True)
PLAYER_THUMB_DIR.mkdir(parents=True, exist_ok=True)

player_count = 0
for source in sorted(PLAYER_DIR.glob("*.png")):
    save_webp(source, PLAYER_WEBP_DIR / f"{source.stem}.webp", None, 86)
    save_webp(source, PLAYER_THUMB_DIR / f"{source.stem}.webp", (280, 340), 82)
    player_count += 1

news_count = 0
for source in sorted(NEWS_DIR.iterdir() if NEWS_DIR.exists() else []):
    if not source.is_file() or source.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
        continue
    save_webp(source, NEWS_DIR / f"{source.stem}.webp", (1280, 800), 82)
    news_count += 1

print(f"球员图片：{player_count} 份高清 WebP + {player_count} 份列表缩略图")
print(f"新闻图片：{news_count} 份 WebP")

crest_source = BRAND_DIR / "fcb-crest.png"
if crest_source.exists():
    with Image.open(crest_source) as crest_original:
        crest = ImageOps.exif_transpose(crest_original).convert("RGBA")
        square = crest.crop((0, 0, min(crest.height, crest.width), crest.height))
        for size in (192, 512):
            canvas = Image.new("RGBA", (size, size), (5, 8, 20, 255))
            icon = square.copy()
            icon.thumbnail((int(size * 0.86), int(size * 0.86)), Image.Resampling.LANCZOS)
            canvas.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))
            canvas.save(BRAND_DIR / f"fcb-icon-{size}.png", optimize=True)
    print("应用图标：192px + 512px")
