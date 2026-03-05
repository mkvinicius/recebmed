import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Stethoscope } from "lucide-react";
import { saveAuth } from "@/lib/auth";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro no cadastro", description: data.message || "Verifique os dados informados.", variant: "destructive" });
        return;
      }
      saveAuth(data.token, data.user);
      toast({ title: "Conta criada!", description: `Bem-vindo ao RecebMed, ${data.user.name}!` });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível conectar ao servidor.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 dark:bg-[#0d0a14]">
      <div className="hero-gradient absolute top-0 left-0 w-full h-72 z-0" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <Stethoscope className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">RecebMed</h1>
        </div>

        <div className="glass-card dark:glass-card-dark rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Criar uma conta</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Preencha seus dados para começar a usar o RecebMed</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold text-slate-700 dark:text-slate-300">Nome completo</Label>
              <Input
                id="name"
                placeholder="Dr. João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                data-testid="input-register-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-slate-700 dark:text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                data-testid="input-register-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold text-slate-700 dark:text-slate-300">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Crie uma senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100"
                data-testid="input-register-password"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
              data-testid="button-register"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</> : "Criar conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-bold text-[#8855f6] hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}