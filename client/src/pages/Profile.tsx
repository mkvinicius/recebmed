import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  User, Settings, LogOut, ClipboardList, CheckCheck,
  ChevronRight, Stethoscope
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";

export default function Profile() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

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
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-6">
        <h2 className="text-2xl font-extrabold text-slate-900 mb-6" data-testid="text-page-title">Perfil</h2>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-[#8855f6] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-[#8855f6]/20" data-testid="avatar-user">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-slate-800 truncate" data-testid="text-user-name">{userName || "Doutor"}</p>
              <p className="text-sm text-slate-500 truncate" data-testid="text-user-email">{userEmail}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          {links.map((link, i) => (
            <button
              key={link.path}
              onClick={() => setLocation(link.path)}
              className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left ${i < links.length - 1 ? "border-b border-slate-50" : ""}`}
              data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className={`size-10 rounded-xl bg-slate-50 flex items-center justify-center ${link.color}`}>
                <link.icon className="w-5 h-5" />
              </div>
              <span className="flex-1 font-semibold text-slate-700">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>

        <button
          onClick={() => { clearAuth(); setLocation("/login"); }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl shadow-sm border border-red-100 text-red-500 font-bold hover:bg-red-50 transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </button>
      </div>
    </div>
  );
}
