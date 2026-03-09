import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom";
}

const TOUR_KEY = "recebmed_tour_completed";

function findTarget(selector: string): Element | null {
  return document.querySelector(selector);
}

export default function AppTour() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      target: '[data-tour="tab-capture"]',
      title: t("tour.step1Title"),
      content: t("tour.step1Content"),
      placement: "top",
    },
    {
      target: '[data-tour="tab-reports"]',
      title: t("tour.step2Title"),
      content: t("tour.step2Content"),
      placement: "top",
    },
    {
      target: '[data-testid="stats-grid"]',
      title: t("tour.step3Title"),
      content: t("tour.step3Content"),
      placement: "bottom",
    },
  ];

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    const el = findTarget(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    }
  }, [currentStep, isActive]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [updateTargetRect]);

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
  }, [currentStep, steps.length, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  if (!isActive || !targetRect) return null;

  const step = steps[currentStep];
  const placement = step.placement || "bottom";
  const padding = 8;

  const spotlightStyle = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    borderRadius: "16px",
  };

  let tooltipTop = 0;
  let tooltipLeft = 0;
  const tooltipWidth = 300;

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
            <button onClick={completeTour} className="text-white/60 hover:text-white transition-colors" data-testid="tour-close">
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
              {t("tour.skip")}
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="size-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  data-testid="tour-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={nextStep}
                className="h-8 px-4 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white text-xs font-bold flex items-center gap-1 shadow-lg shadow-[#8855f6]/30 transition-all"
                data-testid="tour-next"
              >
                {currentStep === steps.length - 1 ? t("tour.finish") : t("tour.next")}
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
