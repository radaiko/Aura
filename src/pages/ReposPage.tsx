import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos, type LocalRepo } from "../hooks/useRepos";
import { PathAutocomplete } from "../components/PathAutocomplete";
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
  const [dbError, setDbError] = useState<string | null>(null);

  // Load saved scan roots from DB and detect tools
  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools).catch(() => {});
    loadRoots();
  }, []);

  const loadRoots = async () => {
    try {
      const db = await Database.load("sqlite:aura.db");
      const rows = await db.select<{ path: string }[]>(
        "SELECT path FROM scan_roots"
      );
      const paths = rows.map((r) => r.path);
      setRoots(paths);
      if (paths.length > 0) {
        scan(paths);
      }
    } catch (err) {
      setDbError(String(err));
    }
  };

  const addRoot = async () => {
    const trimmed = newRoot.trim().replace(/\/+$/, "");
    if (!trimmed || roots.includes(trimmed)) return;
    try {
      const db = await Database.load("sqlite:aura.db");
      await db.execute(
        "INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)",
        [crypto.randomUUID(), trimmed]
      );
      const updated = [...roots, trimmed];
      setRoots(updated);
      setNewRoot("");
      setDbError(null);
      scan(updated);
    } catch (err) {
      setDbError(String(err));
    }
  };

  const removeRoot = async (path: string) => {
    try {
      const db = await Database.load("sqlite:aura.db");
      await db.execute("DELETE FROM scan_roots WHERE path = ?", [path]);
      const updated = roots.filter((r) => r !== path);
      setRoots(updated);
      if (updated.length > 0) {
        scan(updated);
      }
    } catch (err) {
      setDbError(String(err));
    }
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

      {roots.length === 0 && !dbError && (
        <p className="text-zinc-400 mb-4">
          Add a directory to scan for local Git repositories.
        </p>
      )}

      {dbError && (
        <p className="text-red-400 text-sm mb-4">{dbError}</p>
      )}

      {/* Configured scan roots */}
      {roots.length > 0 && (
        <div className="space-y-1 mb-4">
          {roots.map((root) => (
            <div
              key={root}
              className="flex items-center justify-between bg-zinc-900 rounded-md px-3 py-1.5"
            >
              <span className="text-xs text-zinc-400 font-mono truncate">{root}</span>
              <button
                onClick={() => removeRoot(root)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors ml-2 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <PathAutocomplete
          value={newRoot}
          onChange={setNewRoot}
          onSubmit={addRoot}
          placeholder="/Users/you/dev"
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

      {!loading && repos.length === 0 && roots.length > 0 && !error && (
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
