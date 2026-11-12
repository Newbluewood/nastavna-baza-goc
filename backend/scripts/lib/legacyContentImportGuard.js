'use strict';

/**
 * Legacy Firecrawl → MySQL importers overwrite CMS rows.
 * Refuse unless ALLOW_LEGACY_CONTENT_IMPORT=1.
 */
function assertLegacyContentImportAllowed(scriptName) {
  if (process.env.ALLOW_LEGACY_CONTENT_IMPORT === '1') return;
  console.error(
    [
      `${scriptName} is locked.`,
      'It can overwrite live CMS content from outdated Firecrawl JSON.',
      'Production backup = Aiven MySQL.',
      'First boot / empty DB = npm run seed:content:first-boot',
      'Refresh agent knowledge = CMS button.',
      'To run this legacy importer anyway: ALLOW_LEGACY_CONTENT_IMPORT=1',
    ].join('\n')
  );
  process.exit(1);
}

module.exports = { assertLegacyContentImportAllowed };
