# Landing-page photography

Refreshed on 2026-10-19 with the built-in `image_gen.imagegen` tool, using the previous landing-page images as scene references. These are illustrative generated scenes, not photographs of client projects. The comparison retains its visible AI-assisted illustration caption.

## Final assets

All files live in `frontend/public/images/` and replace the existing assets at their original URLs, so seeded service and category records continue to work.

| Asset | Native pixels | Purpose |
| --- | --- | --- |
| `hero.jpg` | 1672 × 941 | Fallback hero, boardroom cleaning |
| `use-cases/offices.jpg` | 1695 × 928 | Corporate office cleaning |
| `use-cases/shortlets.jpg` | 1697 × 927 | Guest turnover preparation |
| `use-cases/real-estate.jpg` | 1695 × 928 | Property handover |
| `use-cases/interior-decor.jpg` | 1695 × 928 | Fit-out aftercare |
| `services/standard.jpg` | 1672 × 941 | Routine meeting-room cleaning and team-care section |
| `services/deep.jpg` | 1672 × 941 | Carpet extraction and high dusting |
| `services/move.jpg` | 1672 × 941 | Move-in-ready office and comparison after scene |
| `services/post-construction.jpg` | 1672 × 941 | Post-build floor and window cleaning |
| `services/facility.jpg` | 1672 × 941 | Corporate pantry support |
| `cleaning-before.webp` | 1672 × 941 | Dusty edit of the exact new `services/move.jpg` scene |

The previous assets were 1408 × 768. The generated native files above were preserved without upscaling. Although the generation prompts requested larger outputs, these are the actual delivered dimensions, not 4K assets. JPEG sources use quality 95 and 4:4:4 chroma; the before scene uses WebP quality 95. Next.js still serves responsive AVIF/WebP at quality 90.

## Composition and delivery

- Recreated the scenes with clearer natural detail and plain navy uniforms, removing baked-in dashboard chrome, lettering and certification graphics.
- Removed the office-specific 1.28× CSS enlargement that hid the former dashboard frame.
- Adjusted responsive `sizes` for the hero, category cards and service thumbnails to account for the full image width needed by `object-fit: cover` in tall containers.
- The shared `Photo` component resolves bundled image paths to static imports. Content-hashed URLs invalidate cached photos when a source changes; uploaded admin photos continue through the existing media path.
- The before scene changes removable dust and glass smudges while retaining the clean scene's architecture, camera, lighting, crop and dimensions. Replace both together with matched, consented client photography when available.

## Generation record

The complete final prompt set, original generated PNG paths, workspace destinations, native dimensions and file sizes are recorded in [homepage-image-generation.json](homepage-image-generation.json). The original PNGs remain in Codex's generated-images directory; all production assets are saved in the repository.
