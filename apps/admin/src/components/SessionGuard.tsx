import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const INACTIVE_MS = 18 * 60 * 1000;  // show warning after 18 min
const COUNTDOWN_S = 120;               // 2-minute countdown before auto sign-out

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export const SessionGuard = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_S);

  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningActive = useRef(false);

  const clearAll = () => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const doSignOut = useCallback(async () => {
    clearAll();
    warningActive.current = false;
    setShowWarning(false);
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const startWarningCountdown = useCallback(() => {
    warningActive.current = true;
    setShowWarning(true);
    setCountdown(COUNTDOWN_S);

    let secs = COUNTDOWN_S;
    countdownInterval.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) doSignOut();
    }, 1000);
  }, [doSignOut]);

  const resetInactivityTimer = useCallback(() => {
    if (warningActive.current) return;
    clearAll();
    warningTimer.current = setTimeout(startWarningCountdown, INACTIVE_MS);
  }, [startWarningCountdown]);

  const staySignedIn = () => {
    clearAll();
    warningActive.current = false;
    setShowWarning(false);
    setCountdown(COUNTDOWN_S);
    resetInactivityTimer();
  };

  useEffect(() => {
    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, resetInactivityTimer, { passive: true })
    );
    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) =>
        document.removeEventListener(e, resetInactivityTimer)
      );
    };
  }, [resetInactivityTimer]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Countdown ring */}
            <div className="relative w-20 h-20 mx-auto">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#f0fdf4" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="#012d1d" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - countdown / COUNTDOWN_S)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono font-bold text-lg text-foreground">{display}</span>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
                Still there?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your session will end due to inactivity. Click <strong>Stay signed in</strong> to continue.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={doSignOut}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Sign out
              </button>
              <button
                onClick={staySignedIn}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
