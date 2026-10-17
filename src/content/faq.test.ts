import { describe, expect, it } from 'vitest';
import { faqs } from './faq';

const copy = JSON.stringify(faqs);

describe('public plan and payment claims', () => {
  it('does not promise that paid plans will never exist', () => {
    expect(copy).not.toContain('There are no paid plans');
  });

  it('describes the current free plan without ruling out Pro forever', () => {
    expect(copy).toContain('free plan');
  });

  it('describes UPI as direct payment details, not FirmQuote payment processing', () => {
    expect(copy).toContain('UPI details');
    expect(copy).not.toContain('UPI payments');
  });
});
