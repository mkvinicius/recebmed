import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Stethoscope } from "lucide-react";

interface TourStep {
  target: string | null;
  title: string;
  content: string;
  placement?: "top" | "bottom";
}

const TOUR_KEY = "recebmed_tour_completed";

export function resetTour() {
  localStorage.removeItem(TOUR_KEY);
}

function findTarget(selector: string): Element | null {
  return document.querySelector(selector);
}

const steps: TourStep[] = [
  {
    target: null,
    title: "Bem-vindo ao RecebMed!",
    content:
      "Esta plataforma foi desenvolvida para médicos controlarem seus recebíveis de forma simples e precisa. Vamos fazer um tour rápido para você conhecer as principais funcionalidades.",
  },
  {
    target: '[data-tour="tab-capture"]',
    title: "Inserir Procedimentos",
    content:
      "Registre os procedimentos que você realizou por foto de etiqueta hospitalar, áudio ditado ou entrada manual. Sem necessidade de digitar valores — isso vem da clínica.",
    placement: "top",
  },
  {
    target: '[data-tour="tab-dashboard"]',
    title: "Painel Inicial",
    content:
      "Veja um resumo completo das suas finanças: total a receber, procedimentos conferidos, pendentes e divergentes — tudo em gráficos e cards de fácil leitura.",
    placement: "top",
  },
  {
    target: '[data-tour="tab-entries"]',
    title: "Seus Lançamentos",
    content:
      "Consulte todos os seus procedimentos registrados com filtros por data e status: Pendente (ainda sem retorno da clínica), Conferido (valor confirmado) e Divergente (há alguma inconsistência).",
    placement: "top",
  },
  {
    target: '[data-tour="tab-reports"]',
    title: "Conferência com a Clínica",
    content:
      "Faça upload do PDF ou CSV enviado pela clínica. O sistema extrai os dados automaticamente e cruza com seus registros, mostrando o que foi pago, o que está pendente e o que divergiu.",
    placement: "top",
  },
  {
    target: '[data-tour="tab-profile"]',
    title: "Perfil e Configurações",
    content:
      "Atualize seus dados, altere a senha, configure o contexto do seu consultório para a IA evitar falsos alertas, e acompanhe os relatórios de auditoria automática.",
    placement: "top",
  },
];

export default function AppTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const step = steps[currentStep];
  const isWelcomeStep = step.target === null;

  const updateTargetRect = useCallback(() => {
    if (!isActive || isWelcomeStep) return;
    const el = findTarget(step.target as string);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isActive, isWelcomeStep, step.target]);

  useEffect(() => {
    if (isWelcomeStep) {
      setTargetRect(null);
      return;
    }
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [updateTargetRect, isWelcomeStep]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_KEY, "true");
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  if (!isActive) return null;

  // ── Welcome step (centered modal, no spotlight) ──
  if (isWelcomeStep) {
    return (
      <div className="fixed inset-0 z-[9999]" data-testid="app-tour-overlay">
        <div className="absolute inset-0 bg-black/60" onClick={completeTour} />
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="relative z-[10001] w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-[0_32px_80px_-8px_rgba(0,0,0,0.4)] border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-[#a478ff] via-[#8855f6] to-[#6633cc] px-6 pt-8 pb-10 flex flex-col items-center text-center">
              <div className="size-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 ring-2 ring-white/30">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">RecebMed</h2>
              <p className="text-white/80 text-sm mt-1 font-medium">Gestão financeira para médicos</p>
            </div>

            {/* Card body */}
            <div className="-mt-4 mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 mb-5">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-2">{step.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{step.content}</p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center justify-between">
              <button
                onClick={completeTour}
                className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
                data-testid="tour-skip"
              >
                Pular tour
              </button>
              <button
                onClick={nextStep}
                className="h-10 px-6 rounded-full bg-gradient-to-r from-[#8855f6] to-[#6633cc] hover:from-[#7744e0] hover:to-[#5522bb] text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#8855f6]/30 transition-all"
                data-testid="tour-next"
              >
                Começar tour
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={completeTour}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              data-testid="tour-close"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Spotlight steps ──
  if (!targetRect) return null;

  const placement = step.placement || "bottom";
  const padding = 8;

  const spotlightStyle = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    borderRadius: "16px",
  };

  const tooltipWidth = 300;
  let tooltipTop = 0;
  let tooltipLeft = 0;

  if (placement === "top") {
    tooltipTop = targetRect.top - padding - 12;
    tooltipLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  } else {
    tooltipTop = targetRect.bottom + padding + 12;
    tooltipLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  }

  tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="app-tour-overlay">
      <div className="absolute inset-0 bg-black/60 transition-opacity duration-300" onClick={completeTour} />

      <div
        className="absolute z-[10000] ring-2 ring-[#8855f6] ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
        style={spotlightStyle}
      >
        <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />
        <div className="absolute inset-0 rounded-2xl animate-pulse ring-2 ring-[#8855f6]/50" />
      </div>

      <div
        ref={tooltipRef}
        className="absolute z-[10001] w-[300px] transition-all duration-300 ease-out"
        style={{
          top: placement === "top" ? "auto" : tooltipTop,
          bottom: placement === "top" ? `${window.innerHeight - tooltipTop}px` : "auto",
          left: tooltipLeft,
        }}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.25)] border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="bg-gradient-to-r from-[#8855f6] to-[#6633cc] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-white text-xs font-bold">{currentStep + 1}/{steps.length}</span>
            </div>
            <button onClick={completeTour} className="text-white/60 hover:text-white transition-colors" data-testid="tour-close" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1.5">{step.title}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{step.content}</p>
          </div>

          <div className="px-5 pb-4 flex items-center justify-between gap-2">
            <button
              onClick={completeTour}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
              data-testid="tour-skip"
            >
              Pular
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="size-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  data-testid="tour-prev"
                  aria-label="Passo anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={nextStep}
                className="h-8 px-4 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white text-xs font-bold flex items-center gap-1 shadow-lg shadow-[#8855f6]/30 transition-all"
                data-testid="tour-next"
              >
                {currentStep === steps.length - 1 ? "Concluir" : "Próximo"}
                {currentStep < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {placement === "top" && (
          <div className="flex justify-center mt-[-1px]">
            <div className="w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200/50 dark:border-slate-700/50 rotate-45 -translate-y-1.5" />
          </div>
        )}
        {placement === "bottom" && (
          <div className="flex justify-center absolute -top-1.5 left-1/2 -translate-x-1/2">
            <div className="w-3 h-3 bg-gradient-to-br from-[#8855f6] to-[#6633cc] rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}
