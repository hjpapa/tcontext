/** Header carrying this tab's random request-limit ID. */
export const TAB_ID_HEADER = "x-tcontext-tab";

export const TAB_ID_PATTERN = /^[0-9a-f]{32}$/;

let tabId: string | undefined;

/**
 * Lets the server limit one tab fairly when many teachers share a school
 * network. The ID lives only in this tab's memory: it is never written to a
 * cookie or Web Storage, and a reload starts a new one.
 */
export function getTabId(): string {
  if (!tabId) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    tabId = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  return tabId;
}

export function jsonRequestHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [TAB_ID_HEADER]: getTabId(),
  };
}
