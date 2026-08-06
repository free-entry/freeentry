import { describe, expect, it } from 'vitest';
import { classifyLicense, imagePathFor, parseArtist } from '../scripts/lib/images';

describe('classifyLicense', () => {
  it('accepts CC0', () => {
    expect(classifyLicense('CC0 1.0')).toBe('CC0 1.0');
  });

  it('accepts Public Domain wording, case-insensitively', () => {
    expect(classifyLicense('Public domain')).toBe('Public Domain');
    expect(classifyLicense('PD')).toBe('Public Domain');
  });

  it('accepts CC BY with a version number', () => {
    expect(classifyLicense('CC BY 3.0')).toBe('CC BY 3.0');
    expect(classifyLicense('CC BY 4.0')).toBe('CC BY 4.0');
  });

  it('accepts CC BY-SA with a version number', () => {
    expect(classifyLicense('CC BY-SA 4.0')).toBe('CC BY-SA 4.0');
    expect(classifyLicense('CC BY-SA 2.5')).toBe('CC BY-SA 2.5');
  });

  it('rejects non-commercial and no-derivatives licenses', () => {
    expect(classifyLicense('CC BY-NC 4.0')).toBe(null);
    expect(classifyLicense('CC BY-ND 4.0')).toBe(null);
    expect(classifyLicense('CC BY-NC-SA 4.0')).toBe(null);
  });

  it('rejects unrecognized or non-free licenses', () => {
    expect(classifyLicense('All rights reserved')).toBe(null);
    expect(classifyLicense('Fair use')).toBe(null);
  });
});

describe('parseArtist', () => {
  it('strips HTML tags from a linked author', () => {
    expect(parseArtist('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('decodes common HTML entities', () => {
    expect(parseArtist('Foo &amp; Bar')).toBe('Foo & Bar');
    expect(parseArtist('D&#39;Artagnan')).toBe("D'Artagnan");
  });

  it('collapses whitespace and trims', () => {
    expect(parseArtist('  Jane   Doe  ')).toBe('Jane Doe');
  });

  it('passes plain text through unchanged', () => {
    expect(parseArtist('Jane Doe')).toBe('Jane Doe');
  });
});

describe('imagePathFor', () => {
  it('builds the public/ relative path from a museum id', () => {
    expect(imagePathFor('arc-de-triomphe')).toBe('images/museums/arc-de-triomphe.jpg');
  });
});
