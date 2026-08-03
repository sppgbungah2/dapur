/**
 * Safe wrapper utilities for localStorage operations to prevent QuotaExceededError
 * and browser storage quota crashes on mobile devices (gawai) or desktop.
 */

export function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    console.warn(`[LocalStorage] Unable to set item for key "${key}":`, e);
    // Detect quota exceeded exceptions across browsers
    const isQuotaError =
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22 ||
      e?.code === 1014 ||
      (typeof e?.message === 'string' && e.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      try {
        // Clear non-critical temporary logs to liberate memory
        const expendableKeys = [
          'sppg_saved_reports_excel_v1',
          'sppg_waste_logs',
          'sppg_shipping_docs'
        ];
        for (const k of expendableKeys) {
          if (k !== key) {
            localStorage.removeItem(k);
          }
        }
        // Attempt setItem again
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[LocalStorage] QuotaExceeded retry failed for "${key}". Continuing without local cache.`);
      }
    }
    return false;
  }
}

export function safeLocalStorageGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[LocalStorage] Unable to read key "${key}":`, e);
    return null;
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[LocalStorage] Unable to remove key "${key}":`, e);
  }
}
