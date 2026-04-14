import { useState, useRef, useEffect } from "react";
import { HelpCircle, X, Send, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderText(text: string) {
  // Split on double newlines or -- separators
  const blocks = text.split(/\n{2,}|(?:^|\n)--+(?=\n|$)/m).filter(b => b.trim());
  return (
    <>
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        // Parse **bold** inline
        const parts = trimmed.split(/(\*\*[^*\n]+\*\*)/g);
        const inline = parts.flatMap((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return [<strong key={`${bi}-${pi}`}>{part.slice(2, -2)}</strong>];
          }
          // Single newlines become <br>
          const lines = part.split("\n");
          return lines.flatMap((line, li) =>
            li < lines.length - 1
              ? [line, <br key={`${bi}-${pi}-${li}`} />]
              : [line]
          );
        });
        return (
          <p key={bi} className={bi > 0 ? "mt-2" : ""}>
            {inline}
          </p>
        );
      })}
    </>
  );
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Olá! Sou o assistente do RecebMed. Como posso ajudar você hoje? 😊",
};

export default function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const token = getToken();
      const history = newMessages.slice(0, -1).slice(-6);
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      const reply = res.ok ? (data.reply || "Não consegui processar sua mensagem.") : (data.message || "Erro ao conectar com o assistente.");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao conectar com o assistente. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed z-[9000] bottom-24 right-4 md:bottom-6 md:right-6 size-14 rounded-full bg-gradient-to-br from-[#a478ff] via-[#8855f6] to-[#6633cc] text-white shadow-[0_4px_24px_rgba(136,85,246,0.45)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Abrir assistente"
        data-testid="help-chat-button"
      >
        {open ? <X className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[8999] bottom-0 left-0 right-0 md:bottom-24 md:left-auto md:right-6 md:w-[380px] md:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-[0_-4px_40px_rgba(0,0,0,0.15)] md:shadow-[0_8px_40px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden"
          style={{ height: "min(500px, 85dvh)" }}
          data-testid="help-chat-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#8855f6] to-[#6633cc] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-white/20 rounded-full flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Assistente RecebMed</p>
                <p className="text-white/70 text-[11px] mt-0.5">Suporte ao uso da plataforma</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Fechar assistente"
              data-testid="help-chat-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#8855f6] text-white rounded-br-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? renderText(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva sua dúvida..."
                disabled={loading}
                maxLength={1000}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40 focus:border-[#8855f6] disabled:opacity-60 transition"
                data-testid="help-chat-input"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="size-10 rounded-full bg-[#8855f6] hover:bg-[#7744e0] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Enviar mensagem"
                data-testid="help-chat-send"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
