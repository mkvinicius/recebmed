import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  User, Settings, LogOut, ClipboardList, CheckCheck,
  ChevronRight, Stethoscope, Moon, Sun, Camera, Loader2, Trash2, Globe
} from "lucide-react";
import { useTheme } from "next-themes";
import { getToken, getUser, clearAuth, updateUserData } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

function FlagBR() {
  return (
    <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm flex-shrink-0">
      <rect width="640" height="480" fill="#009b3a" />
      <polygon points="320,48 608,240 320,432 32,240" fill="#fedf00" />
      <circle cx="320" cy="240" r="100" fill="#002776" />
      <path d="M196,240 Q320,180 444,240 Q320,220 196,240Z" fill="white" />
    </svg>
  );
}
function FlagUS() {
  return (
    <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm flex-shrink-0">
      <rect width="640" height="480" fill="#bd3d44" />
      <rect y="37" width="640" height="37" fill="white" />
      <rect y="111" width="640" height="37" fill="white" />
      <rect y="185" width="640" height="37" fill="white" />
      <rect y="259" width="640" height="37" fill="white" />
      <rect y="333" width="640" height="37" fill="white" />
      <rect y="407" width="640" height="37" fill="white" />
      <rect width="260" height="259" fill="#002868" />
    </svg>
  );
}
function FlagES() {
  return (
    <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm flex-shrink-0">
      <rect width="640" height="480" fill="#c60b1e" />
      <rect y="120" width="640" height="240" fill="#ffc400" />
    </svg>
  );
}
function FlagFR() {
  return (
    <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm flex-shrink-0">
      <rect width="213" height="480" fill="#002395" />
      <rect x="213" width="214" height="480" fill="white" />
      <rect x="427" width="213" height="480" fill="#ed2939" />
    </svg>
  );
}

const FLAG_COMPONENTS: Record<string, () => JSX.Element> = {
  "pt-BR": FlagBR,
  "en": FlagUS,
  "es": FlagES,
  "fr": FlagFR,
};

const LANGUAGE_OPTIONS = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

export default function Profile() {
  const { t, i18n } = useTranslation();
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
      toast({ title: t("profile.invalidFile"), description: t("profile.selectImage"), variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("profile.fileTooLarge"), description: t("profile.maxSize"), variant: "destructive" });
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
        toast({ title: t("profile.photoUpdated"), description: t("profile.photoUpdatedDesc") });
      } else {
        toast({ title: t("common.error"), description: updateData.message, variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("profile.uploadError"), variant: "destructive" });
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
        toast({ title: t("profile.photoRemoved"), description: t("profile.photoRemovedDesc") });
      }
    } catch {
      toast({ title: t("common.error"), description: t("profile.removeError"), variant: "destructive" });
    }
  };

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem("recebmed_language", langCode);
  };

  const currentLang = LANGUAGE_OPTIONS.find(l => i18n.language.startsWith(l.code.split("-")[0]) && l.code === i18n.language) || LANGUAGE_OPTIONS.find(l => i18n.language.startsWith(l.code.split("-")[0])) || LANGUAGE_OPTIONS[1];

  const links = [
    { label: t("profile.settings"), icon: Settings, path: "/settings", color: "text-[#8855f6]" },
    { label: t("profile.clinicReports"), icon: ClipboardList, path: "/clinic-reports", color: "text-blue-600" },
    { label: t("profile.pdfReconciliation"), icon: CheckCheck, path: "/reconciliation", color: "text-green-600" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("profile.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("profile.subtitle")}</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="input-profile-photo" />

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div
                className="size-20 rounded-2xl bg-[#8855f6] flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-[#8855f6]/20 overflow-hidden"
                data-testid="avatar-user"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt={t("common.profile")} className="w-full h-full object-cover" />
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
                  <Trash2 className="w-3 h-3" /> {t("profile.removePhoto")}
                </button>
              )}
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-amber-500 dark:text-amber-400">
                {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">{t("profile.darkMode")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{theme === "dark" ? t("profile.darkModeOn") : t("profile.darkModeOff")}</p>
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 dark:text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">{t("profile.language")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("profile.languageDesc")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  currentLang.code === lang.code
                    ? "bg-[#8855f6] text-white shadow-md shadow-[#8855f6]/20"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
                data-testid={`button-lang-${lang.code}`}
              >
                {(() => { const Flag = FLAG_COMPONENTS[lang.code]; return Flag ? <Flag /> : null; })()}
                <span className="truncate">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] overflow-hidden mb-6">
          {links.map((link, i) => (
            <button
              key={link.path}
              onClick={() => setLocation(link.path)}
              className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${i < links.length - 1 ? "border-b border-slate-50 dark:border-slate-800" : ""}`}
              data-testid={`link-${link.path.slice(1)}`}
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
          {t("profile.logout")}
        </button>
    </div>
  );
}
