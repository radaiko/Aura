import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos, type LocalRepo } from "../hooks/useRepos";
import { PageHeader } from "../components/PageHeader";
import { SkeletonRows } from "../components/SkeletonRows";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

interface TreeNode {
  repos: LocalRepo[];
  children: Map<string, TreeNode>;
}

function buildTree(repos: LocalRepo[], roots: string[]): TreeNode {
  const root: TreeNode = { repos: [], children: new Map() };

  for (const repo of repos) {
    const scanRoot = roots.find((r) => repo.path.startsWith(r + "/"));
    const relative = scanRoot ? repo.path.slice(scanRoot.length + 1) : repo.name;
    const segments = relative.split("/");

    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!node.children.has(seg)) {
        node.children.set(seg, { repos: [], children: new Map() });
      }
      node = node.children.get(seg)!;
    }
    node.repos.push(repo);
  }

  return collapseTree(root);
}

function collapseTree(node: TreeNode): TreeNode {
  const collapsed: TreeNode = { repos: node.repos, children: new Map() };

  for (const [name, child] of node.children) {
    let collapsedChild = collapseTree(child);
    let label = name;
    while (collapsedChild.repos.length === 0 && collapsedChild.children.size === 1) {
      const [subName, subChild] = [...collapsedChild.children.entries()][0];
      label = `${label}/${subName}`;
      collapsedChild = subChild;
    }
    collapsed.children.set(label, collapsedChild);
  }

  return collapsed;
}

function countRepos(node: TreeNode): number {
  let count = node.repos.length;
  for (const child of node.children.values()) {
    count += countRepos(child);
  }
  return count;
}

export function ReposPage({ active }: { active: boolean }) {
  const { repos, loading, error, scan } = useRepos();
  const [roots, setRoots] = useState<string[]>([]);
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const mounted = useRef(false);
  const rootsRef = useRef<string[]>([]);

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools).catch(() => {});
    loadRoots();
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) loadRoots();
  }, [active]);

  const loadRoots = async () => {
    try {
      const db = await Database.load("sqlite:aura.db");
      const rows = await db.select<{ path: string }[]>("SELECT path FROM scan_roots");
      const paths = rows.map((r) => r.path);
      setRoots(paths);
      rootsRef.current = paths;
      if (paths.length > 0) scan(paths);
    } catch (err) {
      setDbError(String(err));
    }
  };

  const tree = useMemo(() => buildTree(repos, roots), [repos, roots]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleFolder = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Repositories"
        loading={loading && repos.length > 0}
        count={repos.length > 0 ? repos.length : undefined}
        onRefresh={roots.length > 0 ? () => scan(roots) : undefined}
        refreshDisabled={loading}
      />

      {dbError && (
        <div className="bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">{dbError}</p>
        </div>
      )}
      {error && (
        <div className="bg-status-red/10 border border-status-red/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-status-red">{error}</p>
        </div>
      )}

      {roots.length === 0 && !dbError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-raised flex items-center justify-center mb-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-text-tertiary">
              <path d="M3 4h14v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
              <path d="M3 4a2 2 0 012-2h5l2 2" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-1">No scan directories configured</p>
          <p className="text-xs text-text-tertiary">Add directories in Settings to discover repositories.</p>
        </div>
      )}

      {loading && repos.length === 0 && roots.length > 0 && <SkeletonRows count={6} />}

      {repos.length > 0 && (
        <FolderTree node={tree} tools={tools} collapsed={collapsed} onToggle={toggleFolder} />
      )}

      {!loading && repos.length === 0 && roots.length > 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-secondary">No Git repositories found in the configured directories.</p>
        </div>
      )}
    </div>
  );
}

function FolderTree({
  node,
  tools,
  depth = 0,
  collapsed,
  onToggle,
  pathPrefix = "",
}: {
  node: TreeNode;
  tools: SessionTool[];
  depth?: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  pathPrefix?: string;
}) {
  const sortedFolders = [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sortedRepos = [...node.repos].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={depth > 0 ? "ml-5 border-l border-border pl-3" : ""}>
      {sortedFolders.map(([name, child]) => {
        const folderPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        const isCollapsed = collapsed.has(folderPath);
        const repoCount = countRepos(child);
        return (
          <div key={name} className={depth > 0 ? "mt-1" : "mt-2 first:mt-0"}>
            <button
              onClick={() => onToggle(folderPath)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-2 py-1.5 rounded-md hover:bg-hover transition-colors w-full text-left"
            >
              <svg
                className={`h-3 w-3 shrink-0 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-text-tertiary">
                <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.622 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
              </svg>
              <span>{name}</span>
              {isCollapsed && (
                <span className="text-text-tertiary font-mono font-normal text-[10px] ml-auto">{repoCount}</span>
              )}
            </button>
            {!isCollapsed && (
              <FolderTree
                node={child}
                tools={tools}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                pathPrefix={folderPath}
              />
            )}
          </div>
        );
      })}
      {sortedRepos.map((repo) => (
        <RepoRow key={repo.path} repo={repo} tools={tools} />
      ))}
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
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-hover transition-colors group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            repo.is_dirty ? "bg-status-amber" : "bg-status-green"
          }`}
        />
        <span className="text-[13px] font-medium text-text-primary truncate">{repo.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {availableTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => launch(tool.id)}
            title={tool.name}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-text-primary hover:bg-accent-muted transition-colors"
          >
            <ToolIcon name={tool.name} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 text-text-tertiary">
          <path d="M5 3v10M11 3v6" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <path d="M11 9c0 2.2-1.8 4-4 4" />
        </svg>
        <span className="text-xs text-text-secondary font-mono">{repo.current_branch}</span>
      </div>
    </div>
  );
}

function ToolIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("code") || lower.includes("vs")) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M11.5 1l-7 5.5L11.5 12V1zM4 6.5L1 4v8l3-2.5" />
      </svg>
    );
  }
  if (lower.includes("terminal")) {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
        <path d="M2 4l4 4-4 4M8 12h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8h6" />
    </svg>
  );
}
