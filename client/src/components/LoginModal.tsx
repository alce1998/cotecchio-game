import React, { useState } from "react";
import { AlertTriangle, Copy, Lock, LogIn, Mail, User, UserPlus, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const saveToken = (token?: string) => {
    if (!token) return;
    if (rememberMe) {
      localStorage.setItem("cotecchio_token", token);
      localStorage.setItem("cotecchio_remember_me", "true");
    } else {
      sessionStorage.setItem("cotecchio_token", token);
      localStorage.removeItem("cotecchio_remember_me");
    }
  };

  const handleDiagnosticCapture = (actionName: string, err: any) => {
    const errorDetails = [
      `=== DIAGNOSTICA COTECCHIO AUTH ===`,
      `Data/Ora: ${new Date().toISOString()}`,
      `Azione: ${actionName}`,
      `Host Corrente: ${typeof window !== "undefined" ? window.location.href : "Unknown"}`,
      `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "Unknown"}`,
      `Errore: ${err?.message || String(err)}`,
      `Stack: ${err?.stack || "Non disponibile"}`,
      `=================================`,
    ].join("\n");

    setDiagnosticError(errorDetails);
  };

  const copyDiagnosticLogs = () => {
    if (!diagnosticError) return;
    navigator.clipboard.writeText(diagnosticError);
    setCopied(true);
    toast.success("Dettagli errore copiati negli appunti!");
    setTimeout(() => setCopied(false), 3000);
  };

  const loginQuick = trpc.auth.loginQuick.useMutation({
    onSuccess: async (data) => {
      saveToken(data.token);
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
      toast.success("Benvenuto al tavolo!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      handleDiagnosticCapture("loginQuick", err);
      toast.error("Impossibile connettersi al server. Consulta la diagnostica sotto.");
    },
  });

  const registerEmail = trpc.auth.registerEmail.useMutation({
    onSuccess: async (data) => {
      saveToken(data.token);
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
      toast.success("Account creato con successo! Benvenuto al tavolo.");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      handleDiagnosticCapture("registerEmail", err);
      if (err.message?.includes("No procedure found") || err.message?.includes("NOT_FOUND") || err.message?.includes("fetch")) {
        const fallbackName = nickname.trim() || email.split("@")[0] || "Giocatore";
        loginQuick.mutate({ name: fallbackName, email: email.trim() });
        return;
      }
      toast.error(err.message || "Errore durante la registrazione.");
    },
  });

  const loginEmail = trpc.auth.loginEmail.useMutation({
    onSuccess: async (data) => {
      saveToken(data.token);
      await utils.auth.me.invalidate();
      await utils.leaderboard.current.invalidate();
      toast.success("Bentornato al tavolo!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      handleDiagnosticCapture("loginEmail", err);
      if (err.message?.includes("No procedure found") || err.message?.includes("NOT_FOUND") || err.message?.includes("fetch")) {
        const fallbackName = email.split("@")[0] || "Giocatore";
        loginQuick.mutate({ name: fallbackName, email: email.trim() });
        return;
      }
      toast.error(err.message || "Errore durante l'accesso.");
    },
  });

  if (!open) return null;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDiagnosticError(null);
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

  const handleForceLocalSession = () => {
    const fallbackName = nickname.trim() || (email ? email.split("@")[0] : "") || "Giocatore";
    const localOpenId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const localUser = {
      id: Date.now(),
      openId: localOpenId,
      name: fallbackName,
      email: email.trim() || null,
      loginMethod: "local",
      role: "user",
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    };

    localStorage.setItem("cotecchio_token", localOpenId);
    localStorage.setItem("cotecchio_user", JSON.stringify(localUser));
    if (rememberMe) {
      localStorage.setItem("cotecchio_remember_me", "true");
    }
    utils.auth.me.setData(undefined, localUser as any);
    toast.success(`Benvenuto al tavolo, ${fallbackName}!`);
    onSuccess?.();
    onClose();
  };

  const isLoading = loginEmail.isPending || registerEmail.isPending || loginQuick.isPending;

  return (
    <div className="setup-overlay" style={{ zIndex: 1000 }}>
      <section className="setup-card" style={{ maxWidth: 460, padding: 32, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
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
            {authMode === "login" ? "Accedi al Tavolo" : "Crea il tuo Account"}
          </h2>
          <p style={{ fontSize: 13, color: "#6e583d", margin: 0 }}>
            {authMode === "login"
              ? "Inserisci la tua email e la password per continuare le tue partite"
              : "Registrati con Email, Nickname e Password per comparire in classifica"}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#e8dac0", padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setDiagnosticError(null); }}
            style={{
              flex: 1,
              padding: "9px 12px",
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
            onClick={() => { setAuthMode("register"); setDiagnosticError(null); }}
            style={{
              flex: 1,
              padding: "9px 12px",
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

        {/* Email & Password Form */}
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

        {/* Diagnostic Panel if Error Occurs */}
        {diagnosticError && (
          <div style={{ marginTop: 20, padding: 16, background: "#fff0f0", border: "1px solid #ff4d4d", borderRadius: 8, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#d91515", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              <AlertTriangle size={18} /> Diagnostica Errore Connessione
            </div>
            <p style={{ fontSize: 12, color: "#5a1a1a", margin: "0 0 10px" }}>
              Si è verificato un errore di rete durante la comunicazione col server. Copia il report qui sotto per segnalarlo:
            </p>
            <pre style={{ fontSize: 11, background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ffcccc", overflowX: "auto", whiteSpace: "pre-wrap", color: "#333" }}>
              {diagnosticError}
            </pre>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={copyDiagnosticLogs}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#d91515",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copiato negli appunti!" : "Copia Dettagli Errore"}
              </button>
              <button
                type="button"
                onClick={handleForceLocalSession}
                style={{
                  background: "#194b3a",
                  color: "#fff5de",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Entra comunque col Nickname
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
