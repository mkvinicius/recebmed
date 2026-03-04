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
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/confirm-entry" component={ConfirmEntry} />
      <Route path="/clinic-reports" component={ClinicReports} />
      <Route path="/settings" component={Settings} />
      <Route path="/reports" component={Reports} />
      <Route path="/reconciliation" component={Reconciliation} />
      <Route path="/entry/:id" component={EntryDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;