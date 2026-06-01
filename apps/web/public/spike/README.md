# public/spike/ — PDF spike sample files

Place the real IRS W-9 fillable PDF here:

  apps/web/public/spike/fw9-fillable.pdf

Download from: https://www.irs.gov/pub/irs-pdf/fw9.pdf

If this file is absent, the spike at /spike/pdf generates a synthetic AcroForm
stand-in using @cantoo/pdf-lib and labels it clearly on screen.

These files are DEV-only and are gitignored (*.pdf in this directory).
