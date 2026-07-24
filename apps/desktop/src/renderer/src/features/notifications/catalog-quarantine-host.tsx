import { useEffect } from "react";
import { toast } from "@/lib/toast";

/**
 * Drains startup Catalog quarantine notices from main and surfaces warning toasts.
 * Labels only — never file paths or raw JSON.
 */
export function CatalogQuarantineHost() {
  useEffect(() => {
    const api = window.piDesktop?.state;
    if (!api?.getCatalogQuarantineNotices) {
      return;
    }

    let cancelled = false;
    void api.getCatalogQuarantineNotices().then((notices) => {
      if (cancelled || !Array.isArray(notices)) {
        return;
      }
      for (const notice of notices) {
        const label =
          typeof notice?.catalogLabel === "string" && notice.catalogLabel
            ? notice.catalogLabel
            : "Catalog";
        toast.warning(`${label} recovered from corrupt data`, {
          description:
            "Defaults were restored. The previous file was quarantined.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
