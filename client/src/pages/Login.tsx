import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope } from "lucide-react";
import axios from "axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // MOCK LOGIN LOGIC
    // Em um cenário real, faríamos algo como:
    // await axios.post("/api/auth/login", { email, password });
    
    setTimeout(() => {
      if (email && password) {
        localStorage.setItem("medfin_token", "mock_jwt_token");
        toast({
          title: "Login realizado com sucesso",
          description: "Bem-vindo de volta ao Medfin.",
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Erro ao fazer login",
          description: "Por favor, preencha todos os campos.",
          variant: "destructive"
        });
      }
      setIsLoading(false);
    }, 1000);
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
          <CardTitle className="text-2xl font-bold text-center">Entrar na sua conta</CardTitle>
          <CardDescription className="text-center text-muted-foreground text-sm">
            Digite seu email e senha para acessar o painel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
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
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-medium">Senha</Label>
                <a href="#" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
              <Input 
                id="password" 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-background border-border/50 focus-visible:ring-primary/30 transition-all"
                data-testid="input-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-md font-semibold mt-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pt-2 pb-6">
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Registre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}