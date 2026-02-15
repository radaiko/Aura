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
