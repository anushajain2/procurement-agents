import { FONT_IMPORT } from "./theme.js";
import { AppProvider, useApp, userById } from "./store.jsx";
import Shell from "./Shell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewEvaluation from "./pages/NewEvaluation.jsx";
import Requests from "./pages/Requests.jsx";
import RequestDetail from "./pages/RequestDetail.jsx";
import Approvals from "./pages/Approvals.jsx";
import PendingEvaluations from "./pages/PendingEvaluations.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Specs from "./pages/Specs.jsx";
import NewSpec from "./pages/NewSpec.jsx";
import SpecDetail from "./pages/SpecDetail.jsx";
import Vendors from "./pages/Vendors.jsx";

function Router() {
  const { view, requests, specs, user } = useApp();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  let title, subtitle, page;
  switch (view.name) {
    case "new":
      title = "New Evaluation";
      subtitle = "Upload the PR and vendor bids — Claude builds a traceable comparison sheet.";
      page = <NewEvaluation />;
      break;
    case "pending":
      title = "Pending Evaluations";
      subtitle = "Evaluations in progress or awaiting send-for-approval";
      page = <PendingEvaluations />;
      break;
    case "requests":
      title = "Requests";
      subtitle = "Evaluations sent for approval";
      page = <Requests />;
      break;
    case "request": {
      const r = requests.find((x) => x.id === view.params.id);
      title = "Evaluation";
      subtitle = r ? `${r.ref} · ${r.category}` : "";
      page = <RequestDetail id={view.params.id} />;
      break;
    }
    case "approvals":
      title = "Approvals";
      subtitle = `Acting as ${user.name} — ${user.role}`;
      page = <Approvals />;
      break;
    case "specs":
      title = "Specs & RFQs";
      subtitle = "Standards-based technical specifications & requisitions";
      page = <Specs />;
      break;
    case "newspec":
      title = "New Specification";
      subtitle = "Draft a standards-based RFQ / technical spec from a brief";
      page = <NewSpec />;
      break;
    case "spec": {
      const s = specs.find((x) => x.id === view.params.id);
      title = "Specification";
      subtitle = s ? `${s.ref} · ${s.category}` : "";
      page = <SpecDetail id={view.params.id} />;
      break;
    }
    case "projects":
      title = "Projects";
      subtitle = "Projects, purchase orders & contract tracking";
      page = <Projects />;
      break;
    case "project": {
      title = "Project";
      subtitle = "Procurement packages, approval stages & contract terms";
      page = <ProjectDetail id={view.params.id} />;
      break;
    }
    case "vendors":
      title = "Vendors";
      subtitle = "Supplier performance across all evaluations";
      page = <Vendors />;
      break;
    default:
      title = "Dashboard";
      subtitle = today;
      page = <Dashboard />;
  }

  return <Shell title={title} subtitle={subtitle}>{page}</Shell>;
}

export default function App() {
  return (
    <>
      <style>{FONT_IMPORT}</style>
      <AppProvider>
        <Router />
      </AppProvider>
    </>
  );
}
