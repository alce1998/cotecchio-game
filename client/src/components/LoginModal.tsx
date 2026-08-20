import React, { useEffect, useRef, useState } from "react";
import { Lock, LogIn, Mail, User, UserPlus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const [googleNickname, setGoogleNickname] = useState("");
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const [rememberMe, setRememberMe] = useState(true);

  const handleSessionRemember = () => {
    if (rememberMe) {
      localStorage.setItem("cotecchio_remember_me", "true");
    } else {
      localStorage.removeItem("cotecchio_remember_me");
    }
  };

  const registerEmail = trpc.auth.registerEmail.useMutation({
    onSuccess: async () => {
      handleSessionRemember();
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
      toast.success("Account creato con successo! Benvenuto al tavolo.");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante la registrazione.");
    },
  });

  const loginEmail = trpc.auth.loginEmail.useMutation({
    onSuccess: async () => {
      handleSessionRemember();
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
      toast.success("Bentornato al tavolo!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'accesso.");
    },
  });

  const loginGoogle = trpc.auth.loginGoogle.useMutation({
    onSuccess: async () => {
      handleSessionRemember();
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
        setPendingCredential(response.credential);
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

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Compila tutti i campi richiesti.");
      return;
    }

    if (authMode === "register") {
      if (!nickname.trim()) {
        toast.error("Inserisci il tuo nickname al tavolo.");
        return;
      }
      if (password.length < 6) {
        toast.error("La password deve contenere almeno 6 caratteri.");
        return;
      }
      registerEmail.mutate({ email, nickname: nickname.trim(), password });
    } else {
      loginEmail.mutate({ email, password });
    }
  };

  const handleConfirmGoogleNickname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCredential) return;
    if (!googleNickname.trim()) {
      toast.error("Inserisci il tuo nickname al tavolo.");
      return;
    }
    loginGoogle.mutate({ credential: pendingCredential, nickname: googleNickname.trim() });
  };

  const triggerGoogleAuth = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const isLoading = loginEmail.isPending || registerEmail.isPending || loginGoogle.isPending;

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

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, margin: "0 0 8px", color: "#3b2716" }}>
            Account Cotecchio
          </h2>
          <p style={{ fontSize: 13, color: "#6e583d", margin: 0 }}>
            Accedi con Google o crea il tuo account con Email e Nickname per giocare online e comparire in classifica
          </p>
        </div>

        {/* Modal step if Google GSI credential was captured */}
        {pendingCredential ? (
          <form onSubmit={handleConfirmGoogleNickname} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "#f0f7ff", border: "1px solid #4285F4" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#1a73e8", fontWeight: 600 }}>
                ✓ Account Google Verificato
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#444" }}>
                Scegli il Nickname permanente con cui verrai riconosciuto ai tavoli e in classifica globale:
              </p>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4a3928", display: "flex", alignItems: "center", gap: 6 }}>
                <User size={15} /> Il tuo Nickname al tavolo:
              </span>
              <input
                type="text"
                value={googleNickname}
                onChange={(e) => setGoogleNickname(e.target.value)}
                placeholder="Es. IlPiacentino, Marco98..."
                maxLength={30}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #4285F4",
                  fontSize: 15,
                  background: "#ffffff",
                  color: "#2c1d11",
                  outline: "none",
                }}
              />
            </label>

            <button
              type="submit"
              className="primary-action large"
              disabled={loginGoogle.isPending || !googleNickname.trim()}
            >
              {loginGoogle.isPending ? "Conferma in corso..." : "Entra al Tavolo con Google"} <LogIn size={18} />
            </button>
          </form>
        ) : (
          <>
            {/* Section 1: Google Login Button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div ref={googleBtnRef} style={{ width: "100%", display: "flex", justifyContent: "center" }} />

              {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
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
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
                color: "#8c765c",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <div style={{ flex: 1, height: 1, backgroundColor: "#e2d5c3" }} />
              <span>oppure con email e password</span>
              <div style={{ flex: 1, height: 1, backgroundColor: "#e2d5c3" }} />
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, background: "#e8dac0", padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  background: authMode === "login" ? "#194b3a" : "transparent",
                  color: authMode === "login" ? "#fff5de" : "#66573f",
                }}
              >
                Accedi
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  background: authMode === "register" ? "#194b3a" : "transparent",
                  color: authMode === "register" ? "#fff5de" : "#66573f",
                }}
              >
                Registrati
              </button>
            </div>

            {/* Section 2: Email & Password Form */}
            <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {authMode === "register" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#4a3928", display: "flex", alignItems: "center", gap: 6 }}>
                    <User size={15} /> Scegli il tuo Nickname al tavolo:
                  </span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Es. Marco, IlPiacentino, Giulia..."
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
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#4a3928", display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail size={15} /> Indirizzo Email:
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome.cognome@gmail.com"
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

              <label style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#4a3928", display: "flex", alignItems: "center", gap: 6 }}>
                  <Lock size={15} /> Password:
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4a3928", cursor: "pointer", marginTop: 4, textAlign: "left" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#194b3a", cursor: "pointer" }}
                />
                <span>Ricordami su questo dispositivo</span>
              </label>

              <button
                type="submit"
                className="primary-action large"
                disabled={isLoading || !email.trim() || !password.trim() || (authMode === "register" && !nickname.trim())}
                style={{ marginTop: 8 }}
              >
                {isLoading ? "Elaborazione in corso..." : authMode === "register" ? (
                  <>Crea Account e Gioca <UserPlus size={18} /></>
                ) : (
                  <>Accedi al Tavolo <LogIn size={18} /></>
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
