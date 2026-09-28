/** GST helpers. Every GST particular on a quote is optional and entered by the freelancer; nothing here invents or defaults a GSTIN, rate or identity. */

/** 15-character GSTIN shape: 2 state digits, 10-character PAN, entity code, 'Z', check character. Case-insensitive on input; stored uppercase. */
export const gstinPattern = /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/;

export type GstTreatment = 'inclusive' | 'exclusive';
export type GstSplit = 'cgst_sgst' | 'igst';

export type GstBreakup = {
  rate: number;
  taxable: number;
  tax: number;
  total: number;
  split: GstSplit;
  cgst?: number;
  sgst?: number;
  igst?: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tax breakup from the quoted price. An inclusive price already contains the tax; an exclusive price has tax added on top. */
export function gstBreakup(price: number, rate: number, treatment: GstTreatment, split: GstSplit): GstBreakup {
  const total = treatment === 'exclusive' ? round2(price * (1 + rate / 100)) : round2(price);
  const taxable = treatment === 'exclusive' ? round2(price) : round2(total / (1 + rate / 100));
  const tax = round2(total - taxable);
  if (split === 'igst') return { rate, taxable, tax, total, split, igst: tax };
  const cgst = round2(tax / 2);
  return { rate, taxable, tax, total, split, cgst, sgst: round2(tax - cgst) };
}

/** A document may be headed "Tax Invoice" only when the freelancer entered their GSTIN plus the full rate/treatment/split set. */
export function isTaxInvoice(q: { supplier_gstin: string | null; gst_rate: number | null; gst_treatment: GstTreatment | null; gst_split: GstSplit | null }): boolean {
  return Boolean(q.supplier_gstin && q.gst_rate != null && q.gst_treatment && q.gst_split);
}
