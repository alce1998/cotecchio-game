import React, { useEffect, useRef, useState } from "react";
import { LogIn, User, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [playerName, setPlayerName] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const loginQuick = trpc.auth.loginQuick.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Accesso effettuato! Benvenuto al tavolo.");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'accesso.");
    },
  });

  const loginGoogle = trpc.auth.loginGoogle.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Accesso effettuato con Google!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'accesso con Google.");
    },
  });

  // Load Google Identity Services script dynamically
  useEffect(() => {
    if (!open) return;

    const handleCredentialResponse = (response: any) => {
      if (response.credential) {
        loginGoogle.mutate({ credential: response.credential });
      }
    };

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (googleClientId && typeof window !== "undefined") {
      if (!document.getElementById("google-gsi-script")) {
        const script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (window.google?.accounts?.id && googleBtnRef.current) {
            window.google.accounts.id.initialize({
              client_id: googleClientId,
              callback: handleCredentialResponse,
            });
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              width: 280,
              text: "signin_with",
              locale: "it",
            });
          }
        };
        document.head.appendChild(script);
      } else if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: 280,
          text: "signin_with",
          locale: "it",
        });
      }
    }
  }, [open]);

  if (!open) return null;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      toast.error("Inserisci il tuo nome per accedere.");
      return;
    }
    loginQuick.mutate({ name: playerName.trim() });
  };

  return (
    <div className="setup-overlay" style={{ zIndex: 1000 }}>
      <section className="setup-card" style={{ maxWidth: 440, padding: 32, position: "relative" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6e583d",
          }}
          aria-label="Chiudi"
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, margin: "0 0 8px", color: "#3b2716" }}>
            Accedi a Cotecchio
          </h2>
          <p style={{ fontSize: 13, color: "#6e583d", margin: 0 }}>
            Scegli come accedere per iniziare la partita online con gli amici
          </p>
        </div>

        {/* Section 1: Google Login */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div ref={googleBtnRef} style={{ minHeight: 44 }} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            color: "#8c765c",
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2d5c3" }} />
          <span>oppure entra subito</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e2d5c3" }} />
        </div>

        {/* Section 2: Quick Player Login */}
        <form onSubmit={handleQuickSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#4a3928", display: "flex", alignItems: "center", gap: 6 }}>
              <User size={15} /> Il tuo Nome al tavolo:
            </span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Es. Marco, Giulia, Giuseppe..."
              maxLength={30}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d4c2a5",
                fontSize: 15,
                background: "#fcf8f2",
                color: "#2c1d11",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            className="primary-action large"
            disabled={loginQuick.isPending || !playerName.trim()}
            style={{ marginTop: 8 }}
          >
            {loginQuick.isPending ? "Accesso in corso..." : "Entra al Tavolo"} <LogIn size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
