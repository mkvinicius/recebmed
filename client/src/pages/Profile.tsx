import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  User, Settings, LogOut, ClipboardList, CheckCheck,
  ChevronRight, Stethoscope, Moon, Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { getToken, getUser, clearAuth } from "@/lib/auth";

export default function Profile() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) {
      setUserName(user.name);
      setUserEmail(user.email);
    }
  }, [setLocation]);

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "DR";

  const links = [
    { label: "Configurações", icon: Settings, path: "/settings", color: "text-[#8855f6]" },
    { label: "Relatórios da Clínica", icon: ClipboardList, path: "/clinic-reports", color: "text-blue-600" },
    { label: "Conciliação PDF", icon: CheckCheck, path: "/reconciliation", color: "text-green-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-6">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6" data-testid="text-page-title">Perfil</h2>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-[#8855f6] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-[#8855f6]/20" data-testid="avatar-user">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate" data-testid="text-user-name">{userName || "Doutor"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate" data-testid="text-user-email">{userEmail}</p>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-amber-500 dark:text-amber-400">
                {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">Modo Escuro</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{theme === "dark" ? "Ativado" : "Desativado"}</p>
              </div>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-[#8855f6]" : "bg-slate-300"}`}
              data-testid="toggle-dark-mode"
            >
              <div className={`absolute top-1 size-6 rounded-full bg-white shadow-md transition-transform duration-300 ${theme === "dark" ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
          {links.map((link, i) => (
            <button
              key={link.path}
              onClick={() => setLocation(link.path)}
              className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${i < links.length - 1 ? "border-b border-slate-50 dark:border-slate-800" : ""}`}
              data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className={`size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${link.color}`}>
                <link.icon className="w-5 h-5" />
              </div>
              <span className="flex-1 font-semibold text-slate-700 dark:text-slate-300">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>

        <button
          onClick={() => { clearAuth(); setLocation("/login"); }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/50 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </button>
      </div>
    </div>
  );
}
