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

  it('ignores other ref values', () => {
    expect(attribution({ ref: 'someone-else' })).toBeNull();
  });

  it('keeps new platforms and campaigns without a code change', () => {
    expect(attribution({ utm_source: 'facebook', utm_medium: 'group', utm_campaign: 'firmquote-in-oct26' })).toEqual({ utm_source: 'facebook', utm_medium: 'group', utm_campaign: 'firmquote-in-oct26' });
    expect(attribution({ utm_source: 'devto', utm_medium: 'article', utm_campaign: 'launch' })?.utm_source).toBe('devto');
  });

  it('still drops URLs, junk and overlong tags, and requires all three core tags', () => {
    expect(attribution({ utm_source: 'https://x.evil/?a=1', utm_medium: 'social', utm_campaign: 'launch' })).toBeNull();
    expect(attribution({ utm_source: '<script>', utm_medium: 'social', utm_campaign: 'launch' })).toBeNull();
    expect(attribution({ utm_source: 'a'.repeat(51), utm_medium: 'social', utm_campaign: 'launch' })).toBeNull();
    expect(attribution({ utm_source: 'facebook', utm_campaign: 'launch' })).toBeNull();
  });

  it('carries an optional utm_content slug', () => {
    expect(attribution({ utm_source: 'facebook', utm_medium: 'group', utm_campaign: 'firmquote-in-oct26', utm_content: 'post-3' })?.utm_content).toBe('post-3');
    expect(attribution({ utm_source: 'facebook', utm_medium: 'group', utm_campaign: 'firmquote-in-oct26' })?.utm_content).toBeUndefined();
    expect(attribution({ utm_source: 'facebook', utm_medium: 'group', utm_campaign: 'firmquote-in-oct26', utm_content: 'bad slug!' })?.utm_content).toBeUndefined();
  });
});
