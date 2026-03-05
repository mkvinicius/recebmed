import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ConfirmEntry from "@/pages/ConfirmEntry";
import ClinicReports from "@/pages/ClinicReports";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import Reconciliation from "@/pages/Reconciliation";
import EntryDetail from "@/pages/EntryDetail";
import Entries from "@/pages/Entries";
import Capture from "@/pages/Capture";
import Profile from "@/pages/Profile";
import AppLayout from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";

function RouteRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <RouteRedirect to="/login" />
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/confirm-entry" component={ConfirmEntry} />

      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/entries">
        <AppLayout><Entries /></AppLayout>
      </Route>
      <Route path="/capture">
        <AppLayout><Capture /></AppLayout>
      </Route>
      <Route path="/reports">
        <AppLayout><Reports /></AppLayout>
      </Route>
      <Route path="/profile">
        <AppLayout><Profile /></AppLayout>
      </Route>
      <Route path="/clinic-reports">
        <AppLayout><ClinicReports /></AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout><Settings /></AppLayout>
      </Route>
      <Route path="/reconciliation">
        <AppLayout><Reconciliation /></AppLayout>
      </Route>
      <Route path="/entry/:id">
        <AppLayout><EntryDetail /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
