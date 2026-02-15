export interface AuthStatus {
  cli_available: boolean;
  cli_authenticated: boolean;
  username: string | null;
  auth_method: "cli" | "pat" | "none";
  token: string | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
  body: string | null;
  pull_request: unknown | null;
  repository_url: string;
}

/** Extract "owner/repo" from repository_url */
export function repoFromUrl(url: string): string {
  // https://api.github.com/repos/owner/repo -> owner/repo
  const match = url.match(/repos\/(.+)$/);
  return match ? match[1] : url;
}

// -- Azure DevOps --

export interface AzureAuthStatus {
  cli_available: boolean;
  logged_in: boolean;
  organization: string | null;
  project: string | null;
}

export interface AzureWorkItem {
  id: number;
  title: string;
  state: string;
  work_item_type: string;
  assigned_to: string | null;
  changed_date: string;
  tags: string[];
  url: string;
}

export interface AzurePullRequest {
  id: number;
  title: string;
  status: string;
  created_by: string;
  repository: string;
  source_branch: string;
  target_branch: string;
  creation_date: string;
  url: string;
}

// -- Jira Cloud --

export interface JiraAuthStatus {
  valid: boolean;
  display_name: string | null;
  email: string | null;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  status_color: string;
  issue_type: string;
  priority: string | null;
  updated: string;
  url: string;
  labels: string[];
  project: string;
}

export interface JiraConfig {
  instance_url: string;
  email: string;
  api_token: string;
}

// -- FogBugz --

export interface FogBugzAuthStatus {
  valid: boolean;
  person_name: string | null;
}

export interface FogBugzCase {
  id: number;
  title: string;
  status: string;
  category: string;
  priority: string | null;
  project: string;
  area: string;
  updated: string;
  url: string;
  tags: string[];
  is_open: boolean;
}

export interface FogBugzConfig {
  instance_url: string;
  email: string;
  password: string;
}
