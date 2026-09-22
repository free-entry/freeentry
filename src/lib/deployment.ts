import defaults from '../../config/deployment.json';

/** Override at build time when the custom domain becomes available. */
export const SITE_URL = (import.meta.env?.PUBLIC_SITE_URL || defaults.siteUrl).replace(/\/$/, '');

/** Single-country development uses local images; Pages builds use the shared image site. */
export function imageUrl(
  file: string,
  baseUrl: string,
  imageBaseUrl = import.meta.env?.PUBLIC_IMAGE_BASE_URL || '',
): string {
  return `${(imageBaseUrl || baseUrl).replace(/\/$/, '')}/${file.replace(/^\//, '')}`;
}
