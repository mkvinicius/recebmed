import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Stethoscope } from "lucide-react";
import { saveAuth } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro ao fazer login", description: data.message || "Verifique suas credenciais.", variant: "destructive" });
        return;
      }
      saveAuth(data.token, data.user);
      toast({ title: "Login realizado!", description: `Bem-vindo de volta, ${data.user.name}!` });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível conectar ao servidor.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      <div className="hero-gradient absolute top-0 left-0 w-full h-72 z-0" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <Stethoscope className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Medfin</h1>
        </div>

        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800">Entrar na sua conta</h2>
            <p className="text-slate-500 mt-2 text-sm">Digite seu email e senha para acessar o painel</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 placeholder:text-slate-400"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-semibold text-slate-700">Senha</Label>
                <a href="#" className="text-xs font-bold text-[#8855f6] hover:underline">Esqueceu a senha?</a>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800"
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
              data-testid="button-login"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Não tem uma conta?{" "}
            <Link href="/register" className="font-bold text-[#8855f6] hover:underline">Registre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}