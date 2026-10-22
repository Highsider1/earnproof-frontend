/**
 * Coarse, privacy-safe device labeling from a User-Agent string (#158).
 *
 * Deliberately produces only an OS + browser family label (e.g. "macOS -
 * Chrome"), never the raw User-Agent string, an IP address, or any other
 * fingerprint-grade detail — the acceptance criterion is "privacy-safe
 * device ... metadata", and a raw UA string alone is often near-unique per
 * device/install.
 */
export function labelDevice(userAgent: string): string {
  const os = detectOs(userAgent);
  const browser = detectBrowser(userAgent);
  return `${os} - ${browser}`;
}

function detectOs(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

function detectBrowser(ua: string): string {
  // Order matters: Edge and Opera also match the Chrome/Safari substrings.
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "Unknown browser";
}
