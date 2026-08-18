import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const KEY = "ek-cookie-notice-v1";

/**
 * The app only uses strictly necessary storage (auth session, technical session id,
 * offline queue, UI prefs), so this is an informational notice — no fake toggles.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(KEY) !== "ack");
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100000] mx-auto max-w-2xl rounded-xl border border-border bg-card/95 p-4 text-sm shadow-lg backdrop-blur">
      <p className="text-foreground">
        Ta aplikacja używa wyłącznie mechanizmów niezbędnych technicznie: sesji logowania,
        identyfikatora sesji, kolejki offline i preferencji interfejsu. Zapisujemy też adres IP w
        logach bezpieczeństwa.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            try {
              localStorage.setItem(KEY, "ack");
            } catch {
              /* pamięć niedostępna */
            }
            setVisible(false);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Rozumiem
        </button>
        <Link to="/polityka-prywatnosci" className="text-sm underline text-muted-foreground">
          Polityka prywatności
        </Link>
      </div>
    </div>
  );
}
