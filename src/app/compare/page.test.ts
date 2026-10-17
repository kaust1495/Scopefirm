import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ComparePage from './page';

const html = renderToStaticMarkup(createElement(ComparePage));

describe('compare page public claims', () => {
  it('distinguishes the free plan from a no-subscription promise', () => {
    expect(html).toContain('Free plan, no cut of payments');
    expect(html).not.toContain('with no subscription');
  });

  it('keeps the free payments sheet and calendar reminder claims', () => {
    expect(html).toContain('Excel payments sheet and calendar reminders');
  });
});
