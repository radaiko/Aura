import { ReactNode } from "react";

type Page = "issues" | "prs" | "repos" | "settings";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "issues", label: "Issues" },
  { id: "prs", label: "Pull Requests" },
  { id: "repos", label: "Repositories" },
  { id: "settings", label: "Settings" },
];

export function AppLayout({
  activePage,
  onNavigate,
  children,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <nav className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-1">
        <h1 className="text-lg font-bold mb-4 px-2">Aura</h1>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
              activePage === item.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

export type { Page };
