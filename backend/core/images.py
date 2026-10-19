"""Photo uploads for services and categories.

Every upload is re-encoded into two WebP files so the website gets sharp but
light images without depending on Next.js image optimisation:

    uploads/services/<token>.webp        up to 2000px wide (hero / large cards)
    uploads/services/<token>-card.webp   up to 960px wide  (cards, phones)

EXIF data (including GPS) is dropped and phone-camera rotation is applied.
"""

import secrets
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}  # MPO = JPEGs from some phone cameras
SIZES = (("", 2000), ("-card", 960))
# Below this width a photo looks soft on large, high-density screens.
RECOMMENDED_WIDTH = 1600


class ImageError(ValueError):
    pass


def card_url(url: str) -> str:
    return url[: -len(".webp")] + "-card.webp" if url.endswith(".webp") else url


def _open(upload) -> Image.Image:
    if upload.size > MAX_UPLOAD_BYTES:
        raise ImageError("That photo is over 15 MB. Please use a smaller file.")
    try:
        probe = Image.open(upload)
        probe.verify()
        upload.seek(0)
        image = Image.open(upload)
        fmt = image.format
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ImageError("That file isn't a photo we can use. Upload a JPG, PNG or WebP.") from exc
    if fmt not in ALLOWED_FORMATS:
        raise ImageError("Upload a JPG, PNG or WebP photo.")
    if image.width < 400 or image.height < 300:
        raise ImageError("That photo is too small. Use one at least 1600 pixels wide.")
    return image.convert("RGB")


def save_photo(upload, folder: str) -> tuple[str, int]:
    """Process an uploaded file; returns (stored name of the large version, original width)."""
    image = _open(upload)
    base = f"uploads/{folder}/{secrets.token_hex(8)}"
    for suffix, width in SIZES:
        variant = image.copy()
        if variant.width > width:
            variant.thumbnail((width, width * 4), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        variant.save(buffer, "WEBP", quality=86, method=6)
        default_storage.save(f"{base}{suffix}.webp", ContentFile(buffer.getvalue()))
    return f"{base}.webp", image.width


def delete_photo(name: str) -> None:
    if not name:
        return
    for path in (name, card_url(name)):
        if default_storage.exists(path):
            default_storage.delete(path)


def copy_photo(name: str, folder: str) -> str:
    """Duplicate both versions of a stored photo (so deleting one copy can't break the other)."""
    if not name or not default_storage.exists(name):
        return ""
    base = f"uploads/{folder}/{secrets.token_hex(8)}"
    for src, dst in ((name, f"{base}.webp"), (card_url(name), f"{base}-card.webp")):
        if default_storage.exists(src):
            with default_storage.open(src, "rb") as fh:
                default_storage.save(dst, ContentFile(fh.read()))
    return f"{base}.webp"


def replace_photo(instance, upload, folder: str) -> None:
    """Store a new photo on a PhotoMixin model instance, removing the old files."""
    name, width = save_photo(upload, folder)
    old = instance.photo.name
    instance.photo.name = name
    instance.photo_width = width
    instance.save(update_fields=["photo", "photo_width"])
    delete_photo(old)


def clear_photo(instance) -> None:
    old = instance.photo.name
    instance.photo.name = ""
    instance.photo_width = 0
    instance.save(update_fields=["photo", "photo_width"])
    delete_photo(old)
