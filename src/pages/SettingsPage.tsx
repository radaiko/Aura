import { useEffect, useState } from "react";
import { useGitHubAuth } from "../hooks/useGitHub";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

export function SettingsPage() {
  const { status, loading, refresh } = useGitHubAuth();
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [roots, setRoots] = useState<{ id: string; path: string }[]>([]);
  const [newRoot, setNewRoot] = useState("");

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools);
    loadRoots();
  }, []);

  const loadRoots = async () => {
    const db = await Database.load("sqlite:aura.db");
    const rows = await db.select<{ id: string; path: string }[]>(
      "SELECT id, path FROM scan_roots ORDER BY path"
    );
    setRoots(rows);
  };

  const addRoot = async () => {
    const trimmed = newRoot.trim();
    if (!trimmed) return;
    const db = await Database.load("sqlite:aura.db");
    await db.execute(
      "INSERT OR IGNORE INTO scan_roots (id, path) VALUES (?, ?)",
      [crypto.randomUUID(), trimmed]
    );
    setNewRoot("");
    loadRoots();
  };

  const removeRoot = async (id: string) => {
    const db = await Database.load("sqlite:aura.db");
    await db.execute("DELETE FROM scan_roots WHERE id = ?", [id]);
    loadRoots();
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* GitHub Connection */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          GitHub Connection
        </h3>
        <div className="bg-zinc-900 rounded-lg p-4">
          {loading ? (
            <p className="text-zinc-500 animate-pulse">Checking...</p>
          ) : status ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Auth method</span>
                <span className="text-sm text-zinc-400">{status.auth_method}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">CLI installed</span>
                <span className={`text-sm ${status.cli_available ? "text-green-400" : "text-red-400"}`}>
                  {status.cli_available ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Authenticated</span>
                <span className={`text-sm ${status.cli_authenticated ? "text-green-400" : "text-red-400"}`}>
                  {status.cli_authenticated ? "Yes" : "No"}
                </span>
              </div>
              {status.username && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Username</span>
                  <span className="text-sm text-zinc-300">@{status.username}</span>
                </div>
              )}
              <button
                onClick={refresh}
                className="mt-2 text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Re-check
              </button>
            </div>
          ) : (
            <p className="text-red-400 text-sm">Unable to check auth status</p>
          )}
        </div>
      </section>

      {/* Scan Directories */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Repository Scan Directories
        </h3>
        <div className="space-y-2 mb-3">
          {roots.map((root) => (
            <div
              key={root.id}
              className="flex items-center justify-between bg-zinc-900 rounded-md px-3 py-2"
            >
              <span className="text-sm text-zinc-300 font-mono">{root.path}</span>
              <button
                onClick={() => removeRoot(root.id)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
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
      </section>

      {/* Detected Tools */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Detected Tools
        </h3>
        <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
          {tools.map((tool) => (
            <div key={tool.id} className="flex items-center justify-between">
              <span className="text-sm">{tool.name}</span>
              <span
                className={`text-xs ${
                  tool.available ? "text-green-400" : "text-zinc-600"
                }`}
              >
                {tool.available ? "Available" : "Not found"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
