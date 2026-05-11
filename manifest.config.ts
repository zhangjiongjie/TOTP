import manifestJson from './public/manifest.json';

type ManifestConfig = {
  manifest_version: 3;
  name: string;
  version: string;
  action: {
    default_popup: string;
  };
  permissions: string[];
  host_permissions: string[];
};

// public/manifest.json is the source of truth for the shipped extension manifest.
// This file provides a typed view for TS-side consumers without duplicating values.
export const manifest = manifestJson as ManifestConfig;

export default manifest;
