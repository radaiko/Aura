import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AzureAuthStatus, AzureWorkItem, AzurePullRequest } from "../types";

export function useAzureAuth() {
  const [status, setStatus] = useState<AzureAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<AzureAuthStatus>("check_azure_auth");
      setStatus(result);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}

export function useAzureWorkItems() {
  const [items, setItems] = useState<AzureWorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AzureWorkItem[]>("azure_fetch_work_items");
      setItems(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, fetch };
}

export function useAzurePRs() {
  const [prs, setPrs] = useState<AzurePullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AzurePullRequest[]>("azure_fetch_prs");
      setPrs(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { prs, loading, error, fetch };
}
