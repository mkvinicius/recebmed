import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, LogOut, Bell, Settings, Camera, Mic,
  Clock, CreditCard, AlertTriangle, FileText, Building2, AlertCircle
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) setUserName(user.name);
  }, [setLocation]);

  const handleLogout = () => { clearAuth(); setLocation("/login"); };

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "DR";

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900 relative">
      {/* Hero Gradient Header */}
      <div className="hero-gradient h-72 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </button>
            <div
              className="size-10 rounded-full bg-[#8855f6] flex items-center justify-center text-white font-bold text-sm border-2 border-white/50 cursor-pointer"
              data-testid="avatar-user"
              onClick={handleLogout}
              title="Sair da conta"
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Profile Section */}
        <div className="pt-4 pb-8 text-white">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl border-4 border-white/20 bg-[#8855f6] flex items-center justify-center shadow-xl text-white font-extrabold text-2xl">
              {initials}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold" data-testid="text-greeting">
                Olá, {userName.split(" ").slice(0, 2).join(" ") || "Doutor"}
              </h2>
              <div className="flex items-center gap-2 mt-1 opacity-90">
                <span className="size-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-sm font-medium uppercase tracking-wider">Status: Online • Resumo Financeiro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card - Glass */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800">Novo Lançamento</h3>
              <p className="text-slate-500 mt-1">Capture recibos e documentos instantaneamente</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button
                className="flex items-center gap-2 px-6 py-3 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:scale-105 transition-transform hover:bg-[#7744e0]"
                data-testid="button-launch-photo"
              >
                <Camera className="w-5 h-5" />
                Lançar por Foto
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 px-6 py-3 h-auto bg-white border-2 border-[#8855f6]/20 text-[#8855f6] rounded-full font-bold hover:bg-[#8855f6]/5 transition-colors"
                data-testid="button-launch-audio"
              >
                <Mic className="w-5 h-5" />
                Lançar por Áudio
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">+5.2%</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">A Receber</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-receivable">R$ 12.500,00</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">Meta: 80%</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Recebido</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-received">R$ 8.200,00</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">-10%</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Atrasado</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-overdue">R$ 1.150,00</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-12">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800">Lançamentos Recentes</h3>
            <button className="text-[#8855f6] text-sm font-bold hover:underline" data-testid="button-view-all">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-[#8855f6]/10 flex items-center justify-center text-[#8855f6]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Consulta Particular - João Silva</p>
                  <p className="text-xs text-slate-400">Hoje, 14:30 • Pix</p>
                </div>
              </div>
              <p className="font-bold text-green-600">+ R$ 450,00</p>
            </div>

            <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-[#8855f6]/10 flex items-center justify-center text-[#8855f6]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Convênio Unimed - Repasse Mensal</p>
                  <p className="text-xs text-slate-400">Ontem, 09:15 • Transferência</p>
                </div>
              </div>
              <p className="font-bold text-slate-800">R$ 2.300,00</p>
            </div>

            <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Exame de Imagem - Clínica Rad</p>
                  <p className="text-xs text-slate-400">02 Out, 16:45 • Pendente</p>
                </div>
              </div>
              <p className="font-bold text-red-500">R$ 890,00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}