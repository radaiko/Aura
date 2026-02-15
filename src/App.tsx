import { useState } from "react";
import { AppLayout, type Page } from "./layouts/AppLayout";
import { IssuesPage } from "./pages/IssuesPage";
import { PullRequestsPage } from "./pages/PullRequestsPage";
import { ReposPage } from "./pages/ReposPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [page, setPage] = useState<Page>("issues");

  return (
    <AppLayout activePage={page} onNavigate={setPage}>
      <div style={{ display: page === "issues" ? undefined : "none" }}>
        <IssuesPage active={page === "issues"} />
      </div>
      <div style={{ display: page === "prs" ? undefined : "none" }}>
        <PullRequestsPage active={page === "prs"} />
      </div>
      <div style={{ display: page === "repos" ? undefined : "none" }}>
        <ReposPage active={page === "repos"} />
      </div>
      <div style={{ display: page === "settings" ? undefined : "none" }}>
        <SettingsPage active={page === "settings"} />
      </div>
    </AppLayout>
  );
}

export default App;
