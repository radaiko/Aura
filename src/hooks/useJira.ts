import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { JiraAuthStatus, JiraIssue, JiraConfig } from "../types";

async function loadJiraConfig(): Promise<JiraConfig | null> {
  const db = await Database.load("sqlite:aura.db");
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key IN ('jira_instance_url', 'jira_email', 'jira_api_token')"
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (map.jira_instance_url && map.jira_email && map.jira_api_token) {
    return {
      instance_url: map.jira_instance_url,
      email: map.jira_email,
      api_token: map.jira_api_token,
    };
  }
  return null;
}

export function useJiraAuth() {
  const [config, setConfig] = useState<JiraConfig | null>(null);
  const [status, setStatus] = useState<JiraAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await loadJiraConfig();
      setConfig(cfg);
      if (!cfg) {
        setStatus(null);
        return;
      }
      const result = await invoke<JiraAuthStatus>("check_jira_auth", {
        instanceUrl: cfg.instance_url,
        email: cfg.email,
        apiToken: cfg.api_token,
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

export function useJiraIssues() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (config: JiraConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<JiraIssue[]>("jira_fetch_issues", {
        instanceUrl: config.instance_url,
        email: config.email,
        apiToken: config.api_token,
      });
      setIssues(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { issues, loading, error, fetch };
}

export async function saveJiraConfig(config: JiraConfig): Promise<void> {
  const db = await Database.load("sqlite:aura.db");
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('jira_instance_url', ?)",
    [config.instance_url]
  );
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('jira_email', ?)",
    [config.email]
  );
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('jira_api_token', ?)",
    [config.api_token]
  );
}

export async function deleteJiraConfig(): Promise<void> {
  const db = await Database.load("sqlite:aura.db");
  await db.execute(
    "DELETE FROM settings WHERE key IN ('jira_instance_url', 'jira_email', 'jira_api_token')",
    []
  );
}
