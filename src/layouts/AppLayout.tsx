import { type ReactNode, useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useUpdater } from "../hooks/useUpdater";

type Page = "issues" | "prs" | "repos" | "settings";

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "issues",
    label: "Issues",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4" />
        <circle cx="10" cy="13" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "prs",
    label: "Pull Requests",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="15" r="2" />
        <circle cx="14" cy="15" r="2" />
        <path d="M6 7v6M14 7v6" />
        <path d="M14 7a4 4 0 00-4-4H8" />
      </svg>
    ),
  },
  {
    id: "repos",
    label: "Repositories",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M3 4h14v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
        <path d="M3 4a2 2 0 012-2h5l2 2" />
        <path d="M3 9h14" />
      </svg>
    ),
  },
];

const SETTINGS_ITEM = {
  id: "settings" as Page,
  label: "Settings",
  icon: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.42 1.42M15.18 15.18l1.42 1.42M3.4 16.6l1.42-1.42M15.18 4.82l1.42-1.42" />
    </svg>
  ),
};

export function AppLayout({
  activePage,
  onNavigate,
  children,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const { phase, version: updateVersion, downloadAndInstall } = useUpdater();
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion);
  }, []);

  const renderNavButton = (item: { id: Page; label: string; icon: React.ReactNode }) => {
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        title={item.label}
        className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
          isActive
            ? "text-accent bg-accent-muted"
            : "text-text-tertiary hover:text-text-secondary hover:bg-hover"
        }`}
      >
        {item.icon}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-base text-text-primary font-sans">
      {/* Icon Rail */}
      <nav className="w-12 bg-raised border-r border-border flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-8 h-8 mb-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent">
            <defs>
              <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#aura-glow)" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        </div>

        {/* Main nav */}
        {NAV_ITEMS.map(renderNavButton)}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings at bottom */}
        {renderNavButton(SETTINGS_ITEM)}

        {/* Version */}
        {appVersion && (
          <span
            className="text-[9px] font-mono text-text-tertiary/50 select-none pb-1 tracking-tight"
            title={`Aura v${appVersion}`}
          >
            {appVersion}
          </span>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {phase === "available" && (
          <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              Update available: <span className="font-medium text-accent">v{updateVersion}</span>
            </span>
            <button
              onClick={downloadAndInstall}
              className="px-3 py-1 rounded bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              Update &amp; Restart
            </button>
          </div>
        )}
        {phase === "downloading" && (
          <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 text-sm text-text-secondary">
            Downloading update…
          </div>
        )}
        <div key={activePage} className="max-w-5xl mx-auto p-6 animate-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}

export type { Page };
