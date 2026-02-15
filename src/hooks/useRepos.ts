import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface LocalRepo {
  name: string;
  path: string;
  current_branch: string;
  is_dirty: boolean;
}

export function useRepos() {
  const [repos, setRepos] = useState<LocalRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (roots: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LocalRepo[]>("scan_repos", {
        roots,
        maxDepth: 4,
      });
      setRepos(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { repos, loading, error, scan };
}
