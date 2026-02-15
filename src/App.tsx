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
      {page === "issues" && <IssuesPage />}
      {page === "prs" && <PullRequestsPage />}
      {page === "repos" && <ReposPage />}
      {page === "settings" && <SettingsPage />}
    </AppLayout>
  );
}

export default App;
