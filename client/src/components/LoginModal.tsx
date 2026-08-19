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
  const [googleEmail, setGoogleEmail] = useState("");
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const loginQuick = trpc.auth.loginQuick.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
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
      await utils.leaderboard.current.invalidate();
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
              width: 320,
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
          width: 320,
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

  const handleGoogleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      toast.error("Inserisci la tua email Google.");
      return;
    }
    const cleanEmail = googleEmail.trim().toLowerCase();
    const namePart = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    loginQuick.mutate({ name: formattedName, email: cleanEmail });
  };

  const triggerGoogleAuth = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setShowGooglePrompt(true);
    }
  };

  return (
    <div className="setup-overlay" style={{ zIndex: 1000 }}>
      <section className="setup-card" style={{ maxWidth: 460, padding: 32, position: "relative" }}>
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
            Scegli come accedere per registrare i tuoi risultati e scalare la classifica stagionale
          </p>
        </div>

        {/* Section 1: Google Login Button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div ref={googleBtnRef} style={{ width: "100%", display: "flex", justifyContent: "center" }} />
          
          {/* Custom Google fallback button if GSI button rendered or not */}
          {(!import.meta.env.VITE_GOOGLE_CLIENT_ID || showGooglePrompt) && (
            <div style={{ width: "100%" }}>
              {!showGooglePrompt ? (
                <button
                  type="button"
                  onClick={triggerGoogleAuth}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "11px 16px",
                    borderRadius: 8,
                    border: "1px solid #747775",
                    backgroundColor: "#ffffff",
                    color: "#1f1f1f",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.617z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                  </svg>
                  Accedi con Google
                </button>
              ) : (
                <form onSubmit={handleGoogleCustomSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#4a3928", textAlign: "left" }}>
                    Inserisci la tua email Google:
                  </label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="nome.cognome@gmail.com"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #4285F4",
                      fontSize: 14,
                      background: "#f8faff",
                      color: "#1f1f1f",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    className="primary-action"
                    disabled={loginQuick.isPending || !googleEmail.trim()}
                  >
                    Conferma Accesso Google
                  </button>
                </form>
              )}
            </div>
          )}
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
          <span>oppure entra col tuo nome</span>
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
