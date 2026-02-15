import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { FogBugzAuthStatus, FogBugzCase, FogBugzConfig } from "../types";

async function loadFogBugzConfig(): Promise<FogBugzConfig | null> {
  const db = await Database.load("sqlite:aura.db");
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key IN ('fogbugz_instance_url', 'fogbugz_email', 'fogbugz_password')"
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (map.fogbugz_instance_url && map.fogbugz_email && map.fogbugz_password) {
    return {
      instance_url: map.fogbugz_instance_url,
      email: map.fogbugz_email,
      password: map.fogbugz_password,
    };
  }
  return null;
}

export function useFogBugzAuth() {
  const [config, setConfig] = useState<FogBugzConfig | null>(null);
  const [status, setStatus] = useState<FogBugzAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await loadFogBugzConfig();
      setConfig(cfg);
      if (!cfg) {
        setStatus(null);
        return;
      }
      const result = await invoke<FogBugzAuthStatus>("check_fogbugz_auth", {
        instanceUrl: cfg.instance_url,
        email: cfg.email,
        password: cfg.password,
      });
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

  return { config, status, loading, refresh };
}

export function useFogBugzCases() {
  const [cases, setCases] = useState<FogBugzCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (config: FogBugzConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FogBugzCase[]>("fogbugz_fetch_cases", {
        instanceUrl: config.instance_url,
        email: config.email,
        password: config.password,
      });
      setCases(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { cases, loading, error, fetch };
}

export async function saveFogBugzConfig(config: FogBugzConfig): Promise<void> {
  const db = await Database.load("sqlite:aura.db");
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('fogbugz_instance_url', ?)",
    [config.instance_url]
  );
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('fogbugz_email', ?)",
    [config.email]
  );
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('fogbugz_password', ?)",
    [config.password]
  );
}

export async function deleteFogBugzConfig(): Promise<void> {
  const db = await Database.load("sqlite:aura.db");
  await db.execute(
    "DELETE FROM settings WHERE key IN ('fogbugz_instance_url', 'fogbugz_email', 'fogbugz_password')",
    []
  );
}
