import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, LogOut, LayoutDashboard, Users, CreditCard, Settings, Bell, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken, getUser, clearAuth } from "@/lib/auth";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLocation("/login");
      return;
    }

    const user = getUser();
    if (user) {
      setUserName(user.name);
    }
  }, [setLocation]);

  const handleLogout = () => {
    clearAuth();
    setLocation("/login");
  };

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "DR";

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      <aside className="w-64 border-r border-border/40 bg-card/30 backdrop-blur-md hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg shadow-sm shadow-primary/20">
              <Stethoscope className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">Medfin</span>
          </div>
        </div>

        <div className="flex-1 py-6 flex flex-col gap-1.5 px-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-3 tracking-wider uppercase">Menu</div>
          <Button variant="secondary" className="justify-start gap-3 px-3 shadow-sm bg-primary/10 text-primary hover:bg-primary/20" data-testid="nav-dashboard">
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral
          </Button>
          <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground hover:text-foreground" data-testid="nav-patients">
            <Users className="w-4 h-4" />
            Pacientes
          </Button>
          <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground hover:text-foreground" data-testid="nav-finance">
            <CreditCard className="w-4 h-4" />
            Financeiro
          </Button>

          <div className="text-xs font-semibold text-muted-foreground mt-6 mb-2 px-3 tracking-wider uppercase">Sistema</div>
          <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
            Configurações
          </Button>
        </div>

        <div className="p-4 border-t border-border/40">
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/40 bg-card/30 backdrop-blur-md flex items-center justify-between px-6 lg:px-8">
          <h1 className="text-xl font-semibold hidden md:block">Visão Geral</h1>

          <div className="flex md:hidden items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg shadow-sm shadow-primary/20">
              <Stethoscope className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-bold text-md tracking-tight">Medfin</span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="relative hidden sm:block w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar pacientes..." className="pl-9 h-9 bg-background/50 border-border/50 text-sm" />
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-card"></span>
            </Button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shadow-sm ring-1 ring-primary/20 cursor-pointer" data-testid="avatar-user">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-8 overflow-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight" data-testid="text-greeting">
                Olá, {userName.split(" ")[0] || "Doutor"}!
              </h2>
              <p className="text-muted-foreground mt-1">Aqui está o resumo da sua clínica hoje.</p>
            </div>
            <Button className="gap-2 shadow-lg shadow-primary/20 font-medium" data-testid="button-new-appointment">
              <Plus className="w-4 h-4" />
              Nova Consulta
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                  Pacientes Ativos
                  <Users className="w-4 h-4 text-primary/70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">124</div>
                <p className="text-xs text-emerald-500 font-medium mt-2 flex items-center gap-1">
                  <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600">+12%</span> desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                  Faturamento Mensal
                  <CreditCard className="w-4 h-4 text-primary/70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">R$ 14.500</div>
                <p className="text-xs text-emerald-500 font-medium mt-2 flex items-center gap-1">
                  <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600">+8%</span> desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                  Consultas Hoje
                  <LayoutDashboard className="w-4 h-4 text-primary/70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">8</div>
                <p className="text-xs text-muted-foreground font-medium mt-2 flex items-center gap-1">
                  <span className="bg-secondary px-1.5 py-0.5 rounded text-foreground">Próxima às 14:00</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm lg:col-span-2">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-lg">Próximos Atendimentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {[
                    { time: "14:00", name: "Carlos Eduardo Oliveira", type: "Primeira Consulta" },
                    { time: "15:30", name: "Mariana Souza", type: "Retorno" },
                    { time: "17:00", name: "Roberto Alves", type: "Procedimento" },
                  ].map((appt, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold text-primary w-12">{appt.time}</div>
                        <div>
                          <p className="font-semibold text-sm">{appt.name}</p>
                          <p className="text-xs text-muted-foreground">{appt.type}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                        Ver Prontuário
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Receitas Confirmadas</span>
                  <span className="text-sm font-bold text-emerald-600">R$ 10.200</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">A Receber</span>
                  <span className="text-sm font-bold text-amber-600">R$ 4.300</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Despesas</span>
                  <span className="text-sm font-bold text-destructive">R$ 3.100</span>
                </div>
                <div className="pt-4 mt-2 border-t border-border/40 flex justify-between items-center">
                  <span className="font-semibold">Líquido</span>
                  <span className="font-bold text-lg">R$ 11.400</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}