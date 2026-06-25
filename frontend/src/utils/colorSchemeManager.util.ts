import { MantineColorScheme, MantineColorSchemeManager } from "@mantine/core";
import { getCookie, setCookie } from "cookies-next";

const COOKIE_KEY = "mantine-color-scheme";

export function cookieColorSchemeManager(): MantineColorSchemeManager {
  let handleStorageEvent: ((event: StorageEvent) => void) | undefined;

  return {
    get: (defaultValue) => {
      if (typeof window === "undefined") return defaultValue;
      const value = getCookie(COOKIE_KEY);
      return (value as MantineColorScheme) || defaultValue;
    },

    set: (value) => {
      setCookie(COOKIE_KEY, value, { sameSite: "lax" });
    },

    subscribe: () => {},

    unsubscribe: () => {
      if (handleStorageEvent) {
        window.removeEventListener("storage", handleStorageEvent);
      }
    },

    clear: () => {
      setCookie(COOKIE_KEY, "", { maxAge: 0 });
    },
  };
}
