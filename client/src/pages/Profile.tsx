import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  User, Settings, LogOut, ClipboardList, CheckCheck,
  ChevronRight, Stethoscope, Moon, Sun, Camera, Loader2, Trash2
} from "lucide-react";
import { useTheme } from "next-themes";
import { getToken, getUser, clearAuth, updateUserData } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) {
      setUserName(user.name);
      setUserEmail(user.email);
      setProfilePhotoUrl(user.profilePhotoUrl || null);
    }
  }, [setLocation]);

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "DR";

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }

    setUploadingPhoto(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: `profile-photo-${Date.now()}.${file.name.split(".").pop()}`, size: file.size, contentType: file.type }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error("Failed to get upload URL");

      await fetch(urlData.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const photoUrl = urlData.objectPath;

      const updateRes = await fetch("/api/auth/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePhotoUrl: photoUrl }),
      });
      const updateData = await updateRes.json();
      if (updateRes.ok) {
        setProfilePhotoUrl(photoUrl);
        updateUserData({ profilePhotoUrl: photoUrl });
        toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi salva." });
      } else {
        toast({ title: "Erro", description: updateData.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar a foto.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/auth/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePhotoUrl: null }),
      });
      if (res.ok) {
        setProfilePhotoUrl(null);
        updateUserData({ profilePhotoUrl: null });
        toast({ title: "Foto removida", description: "Sua foto de perfil foi removida." });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao remover a foto.", variant: "destructive" });
    }
  };

  const links = [
    { label: "Configurações", icon: Settings, path: "/settings", color: "text-[#8855f6]" },
    { label: "Relatórios da Clínica", icon: ClipboardList, path: "/clinic-reports", color: "text-blue-600" },
    { label: "Conciliação PDF", icon: CheckCheck, path: "/reconciliation", color: "text-green-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-header">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white tracking-wide">{initials}</span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
        </header>

        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Perfil</h2>
          <p className="text-white/80 mt-1 text-sm">Gerencie sua conta e preferências</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="input-profile-photo" />

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div
                className="size-16 rounded-2xl bg-[#8855f6] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-[#8855f6]/20 overflow-hidden"
                data-testid="avatar-user"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 size-7 bg-[#8855f6] hover:bg-[#7744e0] text-white rounded-full flex items-center justify-center shadow-md transition-colors border-2 border-white dark:border-slate-900"
                data-testid="button-upload-photo"
              >
                {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate" data-testid="text-user-name">{userName || "Doutor"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate" data-testid="text-user-email">{userEmail}</p>
              {profilePhotoUrl && (
                <button
                  onClick={handleRemovePhoto}
                  className="text-xs text-red-400 hover:text-red-500 mt-1 flex items-center gap-1 transition-colors"
                  data-testid="button-remove-photo"
                >
                  <Trash2 className="w-3 h-3" /> Remover foto
                </button>
              )}
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-4 mb-6">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] overflow-hidden mb-6">
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
