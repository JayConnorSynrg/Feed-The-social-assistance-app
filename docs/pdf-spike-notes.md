# PDF Engine Spike — @cantoo/pdf-lib v2.7

## How to run

```bash
cd apps/web
npm install            # installs @cantoo/pdf-lib@^2.7.1 added to package.json
npm run dev            # starts Next.js dev server on :3000
```

Open `/spike/pdf` in a browser, or on a physical device via:

- **LAN:** `http://<your-mac-ip>:3000/spike/pdf` (find IP with `ipconfig getifaddr en0`)
- **Capacitor:** Build the web app (`npm run build`), sync (`npx cap sync`), run on device (`npx cap run ios`), then use deep-link or Dev Tools to navigate to `/spike/pdf`.

## Sample PDFs

| File | Source |
|------|--------|
| `/spike/fw9-fillable.pdf` | Real IRS W-9 — download from https://www.irs.gov/pub/irs-pdf/fw9.pdf and place at `apps/web/public/spike/fw9-fillable.pdf`. The spike falls back to a **synthetic** AcroForm if this file is absent. |
| Flat PDF | Always **synthetic** — generated at runtime by @cantoo/pdf-lib; includes a 50pt coordinate grid. |

## What to look for

### Test A — AcroForm fill + flatten
- Click "Fill first 2 fields + flatten()" on the INPUT PDF.
- The OUTPUT should show the filled text permanently baked into the page.
- Open the downloaded `spike-acroform-flattened.pdf` in Adobe Reader / Preview.
- **Pass:** filled text visible; no interactive form fields remain; no layout breaks.
- **Fail:** text missing, misaligned by more than ~2pt, or interactive fields still present.

### Test B — Free-position text overlay
- Enter placement mode, tap the page at a recognisable location (e.g., a grid line).
- The transform debug panel shows the computed PDF coordinates.
- Click "Export PDF with overlay" and download `spike-overlay-text.pdf`.
- **Pass:** blue text appears at the same position as the blue dot on the input preview; alignment ≤ 2pt error; visually matches tap location on both desktop and physical device.
- **Fail:** text lands in the wrong quadrant (Y-axis flip bug) or is off by more than 5pt.

### Test C — Photo embed
- Take a photo using the native camera (on device) or select an image file.
- **Pass:** image fills the PDF page at correct aspect ratio (no stretching); file opens cleanly.
- **Fail:** blank PDF, distorted aspect ratio, or embedJpg/embedPng throws.

## Coordinate transform formula

```
scale    = canvasCSSWidth / pdfPageWidth    // pdfjs render scale
pdfX     = clickCSS_x / scale
pdfY     = pdfPageHeight - (clickCSS_y / scale)
```

`getBoundingClientRect()` returns CSS pixels, which are DPR-independent. DPR affects
canvas buffer resolution (`canvas.width = cssWidth * dpr`) but does NOT appear in the
coordinate formula.

## Gate criteria (gates P3 migration)

All three tests must pass on a physical iOS or Android device:

- [ ] (A) AcroForm flatten: filled text visible, no field boxes remain, no layout breaks
- [ ] (B) Free-position: text lands ≤ 2pt from tap position at all screen DPRs tested
- [ ] (C) Image embed: photo fills page at correct aspect; no error thrown

If all three pass: remove `pdf-lib@1.17.1` from `package.json` and complete the P3 migration to `@cantoo/pdf-lib`.
