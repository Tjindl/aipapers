"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getStored(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(getStored());
  }, []);

  function cycle() {
    // system → light → dark → system
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", next);
    }
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={cycle}
      aria-label="Toggle theme"
      className="byline transition-opacity hover:opacity-60"
      style={{ color: "var(--ink-3)", lineHeight: 1 }}
      title={theme === "system" ? "System theme" : theme === "light" ? "Light mode" : "Dark mode"}
    >
      {theme === "system" ? "◑" : isDark ? "☾" : "☀"}
    </button>
  );
}
