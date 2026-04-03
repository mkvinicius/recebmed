import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, Component, lazy, Suspense } from "react";
import type { ReactNode, ErrorInfo } from "react";
import "./lib/i18n";
import AppLayout from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Spinner } from "@/components/ui/spinner";

const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ConfirmEntry = lazy(() => import("@/pages/ConfirmEntry"));
const ClinicReports = lazy(() => import("@/pages/ClinicReports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Reports = lazy(() => import("@/pages/Reports"));
const Reconciliation = lazy(() => import("@/pages/Reconciliation"));
const EntryDetail = lazy(() => import("@/pages/EntryDetail"));
const Entries = lazy(() => import("@/pages/Entries"));
const Capture = lazy(() => import("@/pages/Capture"));
const Profile = lazy(() => import("@/pages/Profile"));
const Import = lazy(() => import("@/pages/Import"));
const ReportHistory = lazy(() => import("@/pages/ReportHistory"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const AuditReports = lazy(() => import("@/pages/AuditReports"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner className="w-8 h-8 text-[#8855f6]" />
    </div>
  );
}

function RouteRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);
  return null;
}

function AppRoutes() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/entries" component={Entries} />
          <Route path="/capture" component={Capture} />
          <Route path="/reports" component={Reports} />
          <Route path="/profile" component={Profile} />
          <Route path="/clinic-reports" component={ClinicReports} />
          <Route path="/settings" component={Settings} />
          <Route path="/reconciliation" component={Reconciliation} />
          <Route path="/entry/:id" component={EntryDetail} />
          <Route path="/import" component={Import} />
          <Route path="/reports/history" component={ReportHistory} />
          <Route path="/audit-reports" component={AuditReports} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/">
          <RouteRedirect to="/login" />
        </Route>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/confirm-entry" component={ConfirmEntry} />
        <Route component={AppRoutes} />
      </Switch>
    </Suspense>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error) { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f6f5f8] dark:bg-[#0d0a14] p-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Algo deu errado</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-[#8855f6] text-white rounded-full font-bold text-sm hover:bg-[#7744e0] transition-all">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
