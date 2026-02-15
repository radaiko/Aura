import { useEffect, useState, useRef } from "react";
import { useGitHubAuth } from "../hooks/useGitHub";
import { useAzureAuth } from "../hooks/useAzure";
import { useJiraAuth, saveJiraConfig, deleteJiraConfig } from "../hooks/useJira";
import { useFogBugzAuth, saveFogBugzConfig, deleteFogBugzConfig } from "../hooks/useFogBugz";
import { invoke } from "@tauri-apps/api/core";
import { PathAutocomplete } from "../components/PathAutocomplete";
import { Spinner } from "../components/Spinner";
import { PageHeader } from "../components/PageHeader";
import Database from "@tauri-apps/plugin-sql";

interface SessionTool {
  id: string;
  name: string;
  available: boolean;
  category: string;
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-0.5">{title}</h3>
      {description && <p className="text-xs text-text-tertiary mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </div>
  );
}

function ConnectionStatus({
  connected,
  loading,
  label,
  sublabel,
  onCheck,
  onDisconnect,
}: {
  connected: boolean;
  loading: boolean;
  label: string;
  sublabel?: string;
  onCheck: () => void;
  onDisconnect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {loading ? (
          <Spinner />
        ) : (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? "bg-status-green animate-pulse-once" : "bg-text-tertiary"
            }`}
          />
        )}
        <div>
          <span className="text-sm text-text-primary">{label}</span>
          {sublabel && <span className="text-xs text-text-secondary ml-2">{sublabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCheck}
          className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          Re-check
        </button>
        {onDisconnect && connected && (
          <button
            onClick={onDisconnect}
            className="text-[11px] text-text-tertiary hover:text-status-red transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ active }: { active: boolean }) {
  const { status: ghStatus, loading: ghLoading, refresh: ghRefresh } = useGitHubAuth();
  const { status: azStatus, loading: azLoading, refresh: azRefresh } = useAzureAuth();
  const {
    config: jiraConfig,
    status: jiraStatus,
    loading: jiraLoading,
    refresh: jiraRefresh,
  } = useJiraAuth();
  const {
    config: fbConfig,
    status: fbStatus,
    loading: fbLoading,
    refresh: fbRefresh,
  } = useFogBugzAuth();
  const [tools, setTools] = useState<SessionTool[]>([]);
  const [roots, setRoots] = useState<{ id: string; path: string }[]>([]);
  const [newRoot, setNewRoot] = useState("");
  const mounted = useRef(false);

  const [jiraForm, setJiraForm] = useState({
    instance_url: "",
    email: "",
    api_token: "",
  });
  const [jiraSaving, setJiraSaving] = useState(false);
  const [jiraFormError, setJiraFormError] = useState<string | null>(null);

  const [fbForm, setFbForm] = useState({
    instance_url: "",
    email: "",
    password: "",
  });
  const [fbSaving, setFbSaving] = useState(false);
  const [fbFormError, setFbFormError] = useState<string | null>(null);

  useEffect(() => {
    invoke<SessionTool[]>("detect_session_tools").then(setTools);
    loadRoots();
  }, []);

  useEffect(() => {
    if (jiraConfig) {
      setJiraForm({
        instance_url: jiraConfig.instance_url,
        email: jiraConfig.email,
        api_token: jiraConfig.api_token,
      });
    }
  }, [jiraConfig]);

  useEffect(() => {
    if (fbConfig) {
      setFbForm({
        instance_url: fbConfig.instance_url,
        email: fbConfig.email,
        password: fbConfig.password,
      });
    }
  }, [fbConfig]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) {
      ghRefresh();
      azRefresh();
      jiraRefresh();
      fbRefresh();
      invoke<SessionTool[]>("detect_session_tools").then(setTools);
      loadRoots();
    }
  }, [active]);

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

  const handleJiraSave = async () => {
    const { instance_url, email, api_token } = jiraForm;
    if (!instance_url.trim() || !email.trim() || !api_token.trim()) {
      setJiraFormError("All fields are required.");
      return;
    }
    setJiraSaving(true);
    setJiraFormError(null);
    try {
      await saveJiraConfig({
        instance_url: instance_url.trim(),
        email: email.trim(),
        api_token: api_token.trim(),
      });
      await jiraRefresh();
    } catch (err) {
      setJiraFormError(String(err));
    } finally {
      setJiraSaving(false);
    }
  };

  const handleJiraDisconnect = async () => {
    await deleteJiraConfig();
    setJiraForm({ instance_url: "", email: "", api_token: "" });
    await jiraRefresh();
  };

  const handleFogBugzSave = async () => {
    const { instance_url, email, password } = fbForm;
    if (!instance_url.trim() || !email.trim() || !password.trim()) {
      setFbFormError("All fields are required.");
      return;
    }
    setFbSaving(true);
    setFbFormError(null);
    try {
      await saveFogBugzConfig({
        instance_url: instance_url.trim(),
        email: email.trim(),
        password: password.trim(),
      });
      await fbRefresh();
    } catch (err) {
      setFbFormError(String(err));
    } finally {
      setFbSaving(false);
    }
  };

  const handleFogBugzDisconnect = async () => {
    await deleteFogBugzConfig();
    setFbForm({ instance_url: "", email: "", password: "" });
    await fbRefresh();
  };

  const inputClass =
    "w-full bg-base border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20";

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHeader title="Settings" />

      <div className="space-y-4">
        {/* GitHub */}
        <SettingsCard title="GitHub" description="Authenticates via GitHub CLI (gh)">
          <ConnectionStatus
            connected={!!ghStatus?.cli_authenticated}
            loading={ghLoading}
            label={
              ghStatus?.cli_authenticated
                ? "Connected"
                : ghStatus?.cli_available
                  ? "CLI installed but not authenticated"
                  : "GitHub CLI not found"
            }
            sublabel={ghStatus?.username ? `@${ghStatus.username}` : undefined}
            onCheck={ghRefresh}
          />
        </SettingsCard>

        {/* Azure DevOps */}
        <SettingsCard title="Azure DevOps" description="Authenticates via Azure CLI (az)">
          <ConnectionStatus
            connected={!!azStatus?.logged_in}
            loading={azLoading}
            label={
              azStatus?.logged_in
                ? "Connected"
                : azStatus?.cli_available
                  ? "CLI installed but not logged in"
                  : "Azure CLI not found"
            }
            sublabel={
              azStatus?.organization && azStatus?.project
                ? `${azStatus.organization} / ${azStatus.project}`
                : undefined
            }
            onCheck={azRefresh}
          />
        </SettingsCard>

        {/* Jira */}
        <SettingsCard title="Jira Cloud" description="API token authentication">
          {jiraStatus?.valid ? (
            <ConnectionStatus
              connected
              loading={jiraLoading && !!jiraStatus}
              label="Connected"
              sublabel={jiraStatus.display_name ?? undefined}
              onCheck={jiraRefresh}
              onDisconnect={handleJiraDisconnect}
            />
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  Instance URL
                </label>
                <input
                  type="text"
                  value={jiraForm.instance_url}
                  onChange={(e) =>
                    setJiraForm((f) => ({ ...f, instance_url: e.target.value }))
                  }
                  placeholder="https://yourteam.atlassian.net"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={jiraForm.email}
                  onChange={(e) =>
                    setJiraForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@company.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  API Token
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-accent/60 hover:text-accent underline"
                  >
                    Create token
                  </a>
                </label>
                <input
                  type="password"
                  value={jiraForm.api_token}
                  onChange={(e) =>
                    setJiraForm((f) => ({ ...f, api_token: e.target.value }))
                  }
                  placeholder="Your Jira API token"
                  className={inputClass}
                />
              </div>
              {jiraFormError && (
                <p className="text-status-red text-xs">{jiraFormError}</p>
              )}
              <button
                onClick={handleJiraSave}
                disabled={jiraSaving}
                className="px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {jiraSaving ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </SettingsCard>

        {/* FogBugz */}
        <SettingsCard
          title="FogBugz"
          description="Username and password authentication"
        >
          {fbStatus?.valid ? (
            <ConnectionStatus
              connected
              loading={fbLoading && !!fbStatus}
              label="Connected"
              sublabel={fbStatus.person_name ?? undefined}
              onCheck={fbRefresh}
              onDisconnect={handleFogBugzDisconnect}
            />
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  Instance URL
                </label>
                <input
                  type="text"
                  value={fbForm.instance_url}
                  onChange={(e) =>
                    setFbForm((f) => ({ ...f, instance_url: e.target.value }))
                  }
                  placeholder="https://yourteam.fogbugz.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={fbForm.email}
                  onChange={(e) =>
                    setFbForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@company.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={fbForm.password}
                  onChange={(e) =>
                    setFbForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Your FogBugz password"
                  className={inputClass}
                />
              </div>
              {fbFormError && (
                <p className="text-status-red text-xs">{fbFormError}</p>
              )}
              <button
                onClick={handleFogBugzSave}
                disabled={fbSaving}
                className="px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {fbSaving ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </SettingsCard>

        {/* Scan Directories */}
        <SettingsCard
          title="Scan Directories"
          description="Root directories to search for Git repositories"
        >
          {roots.length > 0 && (
            <div className="space-y-1 mb-3">
              {roots.map((root) => (
                <div
                  key={root.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-base"
                >
                  <span className="text-xs text-text-secondary font-mono truncate">
                    {root.path}
                  </span>
                  <button
                    onClick={() => removeRoot(root.id)}
                    className="text-[11px] text-text-tertiary hover:text-status-red transition-colors ml-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <PathAutocomplete
              value={newRoot}
              onChange={setNewRoot}
              onSubmit={addRoot}
              placeholder="/Users/you/dev"
            />
            <button
              onClick={addRoot}
              className="px-3 py-1.5 bg-hover text-sm text-text-secondary rounded-md hover:bg-accent-muted hover:text-text-primary transition-colors shrink-0"
            >
              Add
            </button>
          </div>
        </SettingsCard>

        {/* Detected Tools */}
        <SettingsCard
          title="Detected Tools"
          description="Editors, terminals, and AI coding tools found on your system"
        >
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-base"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    tool.available ? "bg-status-green" : "bg-text-tertiary"
                  }`}
                />
                <span
                  className={`text-xs ${
                    tool.available ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  {tool.name}
                </span>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
