import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Loader2 } from "lucide-react";
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
        toast({
          title: "Erro no cadastro",
          description: data.message || "Verifique os dados informados.",
          variant: "destructive",
        });
        return;
      }

      saveAuth(data.token, data.user);
      toast({
        title: "Conta criada com sucesso",
        description: `Bem-vindo ao Medfin, ${data.user.name}!`,
      });
      setLocation("/dashboard");
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
          <Stethoscope className="text-primary-foreground w-7 h-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Medfin</h1>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl shadow-black/5 bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold text-center">Criar uma conta</CardTitle>
          <CardDescription className="text-center text-muted-foreground text-sm">
            Preencha seus dados para começar a usar o Medfin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="name" className="font-medium">Nome completo</Label>
              <Input
                id="name"
                placeholder="Dr. João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 bg-background border-border/50 focus-visible:ring-primary/30 transition-all"
                data-testid="input-register-name"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="email" className="font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-background border-border/50 focus-visible:ring-primary/30 transition-all"
                data-testid="input-register-email"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password" className="font-medium">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Crie uma senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 bg-background border-border/50 focus-visible:ring-primary/30 transition-all"
                data-testid="input-register-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-md font-semibold mt-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</> : "Criar conta"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pt-2 pb-6">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Faça login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}