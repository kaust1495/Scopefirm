'use client';

/** Prints the document; every modern browser offers "Save as PDF" in the print dialog. */
export function PrintButton() {
  return <button className="primary" type="button" onClick={() => window.print()}>Print or save as PDF</button>;
}
