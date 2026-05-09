// Source-side Manifest V3 definition for the extension.
// public/manifest.json mirrors this shape for the current minimal build.
export const manifest = {
  manifest_version: 3,
  name: 'TOTP App',
  version: '0.1.0',
  action: {
    default_popup: 'index.html'
  },
  permissions: ['storage'],
  host_permissions: ['<all_urls>']
} as const;

export default manifest;
