import { describe, expect, it } from 'vitest';
import { attribution } from './marketing';

describe('attribution', () => {
  it("credits Product Hunt's own ?ref=producthunt link to the launch", () => {
    expect(attribution({ ref: 'producthunt' })).toEqual({ utm_source: 'producthunt', utm_medium: 'directory', utm_campaign: 'launch' });
  });

  it('accepts explicit Product Hunt UTM tags', () => {
    expect(attribution({ utm_source: 'producthunt', utm_medium: 'directory', utm_campaign: 'launch' })).toEqual({ utm_source: 'producthunt', utm_medium: 'directory', utm_campaign: 'launch' });
  });

  it('lets explicit UTM tags win over ?ref', () => {
    expect(attribution({ ref: 'producthunt', utm_source: 'reddit', utm_medium: 'community', utm_campaign: 'week1' })?.utm_source).toBe('reddit');
  });

  it('ignores unknown sources and other ref values', () => {
    expect(attribution({ ref: 'someone-else' })).toBeNull();
    expect(attribution({ utm_source: 'evil.example', utm_medium: 'social', utm_campaign: 'launch' })).toBeNull();
  });
});
