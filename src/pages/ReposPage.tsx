import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos, type LocalRepo } from "../hooks/useRepos";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

export function ReposPage() {
  const { repos, loading, error, scan } = useRepos();
  const [roots, setRoots] = useState<string[]>([]);
  const [newRoot, setNewRoot] = useState("");
  const [tools, setTools] = useState<SessionTool[]>([]);

  // Load saved scan roots from DB and detect tools
  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools);
    (async () => {
      const db = await Database.load("sqlite:aura.db");
      const rows = await db.select<{ path: string }[]>(
        "SELECT path FROM scan_roots"
      );
      const paths = rows.map((r) => r.path);
      setRoots(paths);
      if (paths.length > 0) {
        scan(paths);
      }
    })();
  }, [scan]);

  const addRoot = async () => {
    const trimmed = newRoot.trim();
    if (!trimmed || roots.includes(trimmed)) return;
    const db = await Database.load("sqlite:aura.db");
    await db.execute(
      "INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)",
      [crypto.randomUUID(), trimmed]
    );
    const updated = [...roots, trimmed];
    setRoots(updated);
    setNewRoot("");
    scan(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Repositories</h2>
        {roots.length > 0 && (
          <button
            onClick={() => scan(roots)}
            disabled={loading}
            className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>

      {roots.length === 0 && (
        <p className="text-zinc-400 mb-4">
          Add a directory to scan for local Git repositories.
        </p>
      )}

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newRoot}
          onChange={(e) => setNewRoot(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRoot()}
          placeholder="/Users/you/dev"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={addRoot}
          className="px-3 py-1.5 bg-zinc-800 text-sm rounded-md hover:bg-zinc-700 transition-colors"
        >
          Add
        </button>
      </div>

      {loading && <p className="text-zinc-500 animate-pulse">Scanning...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && repos.length > 0 && (
        <ul className="space-y-1">
          {repos.map((repo) => (
            <RepoRow key={repo.path} repo={repo} tools={tools} />
          ))}
        </ul>
      )}

      {!loading && repos.length === 0 && roots.length > 0 && (
        <p className="text-zinc-500">No Git repositories found in the configured directories.</p>
      )}
    </div>
  );
}

function RepoRow({ repo, tools }: { repo: LocalRepo; tools: SessionTool[] }) {
  const availableTools = tools.filter((t) => t.available);

  const launch = async (toolId: string) => {
    try {
      await invoke("launch_session", { toolId, repoPath: repo.path });
    } catch (err) {
      console.error("Failed to launch:", err);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-zinc-900 transition-colors group">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-200">
          {repo.name}
          {repo.is_dirty && (
            <span className="ml-2 text-xs text-amber-500">modified</span>
          )}
        </p>
        <p className="text-xs text-zinc-500 truncate">{repo.path}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {availableTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => launch(tool.id)}
            title={tool.name}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            {tool.name}
          </button>
        ))}
      </div>
      <span className="text-xs text-zinc-500 font-mono ml-3">{repo.current_branch}</span>
    </div>
  );
}
