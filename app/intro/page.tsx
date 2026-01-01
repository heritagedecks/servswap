"use client";
import { useEffect, useRef, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogoRefContext } from "../components/Header";
import { ClientOnly } from "./ClientOnly";

const TYPED_TEXT = "ServSwap.";
const SLOGAN_TEXT = "Trade Skills, Not Money";

export default function IntroPage() {
  return (
    <ClientOnly>
      <ActualIntroPage />
    </ClientOnly>
  );
}

function ActualIntroPage() {
  const router = useRouter();
  // Persist phase and hold start time in localStorage
  const PHASE_KEY = 'introPhase';
  const HOLD_START_KEY = 'introHoldStartTime';

  // Robust phase/timer persistence
  function getInitialPhase() {
    if (typeof window !== 'undefined') {
      const savedPhase = localStorage.getItem(PHASE_KEY);
      const holdStart = localStorage.getItem(HOLD_START_KEY);
      // Only restore if both are present and valid
      if (
        (savedPhase === 'hold' || savedPhase === 'sloganTyping' || savedPhase === 'exiting') &&
        holdStart && !isNaN(Number(holdStart))
      ) {
        console.log('[Intro] Restoring phase:', savedPhase, 'holdStart:', holdStart);
        return savedPhase as any;
      } else {
        // Clear any old state and start fresh
        localStorage.removeItem(PHASE_KEY);
        localStorage.removeItem(HOLD_START_KEY);
        console.log('[Intro] Resetting to icon phase (no valid persisted state)');
        return 'icon';
      }
    }
    return 'icon';
  }

  const [phase, setPhaseState] = useState<'icon' | 'move' | 'typing' | 'sloganTyping' | 'hold' | 'exiting'>(getInitialPhase);
  // Wrapper to persist phase
  const setPhase = (newPhase: typeof phase) => {
    setPhaseState(newPhase);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PHASE_KEY, newPhase);
    }
  };
  const [typed, setTyped] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [exitStyle, setExitStyle] = useState<React.CSSProperties>({});
  const [bgOpacity, setBgOpacity] = useState(1);
  const [showIcons, setShowIcons] = useState(true);
  const [zooming, setZooming] = useState(false);
  const [flash, setFlash] = useState(false);
  const [spinning, setSpinning] = useState(true);
  const splashRef = useRef<HTMLDivElement>(null);
  const logoRef = useContext(LogoRefContext);

  useEffect(() => {
    console.log('IntroPage mounted');
    if (typeof window !== 'undefined' && localStorage.getItem('introPlayed')) {
      console.log('Intro already played, redirecting to main app');
      router.replace('/');
    }
    return () => console.log('IntroPage unmounted');
  }, [router]);

  useEffect(() => {
    // Hide icons after 3s (orbit duration)
    const iconTimer = setTimeout(() => setShowIcons(false), 3000);
    // Stop spinning after 2 spins (3s)
    const spinTimer = setTimeout(() => setSpinning(false), 3000);
    // Start smooth zoom after icons disappear
    const zoomTimer = setTimeout(() => setZooming(true), 3100);
    // Flash after smooth zoom (0.7s duration)
    const flashTimer = setTimeout(() => setFlash(true), 3800);
    return () => { clearTimeout(iconTimer); clearTimeout(zoomTimer); clearTimeout(flashTimer); clearTimeout(spinTimer); };
  }, [router, logoRef]);

  // Animation sequence with robust phase control
  useEffect(() => {
    console.log('PHASE:', phase);
    if (phase === 'icon') {
      console.log('Timer: icon -> move in 1200ms');
      const t = setTimeout(() => setPhase('move'), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 'move') {
      console.log('Timer: move -> typing in 600ms');
      const t = setTimeout(() => setPhase('typing'), 600);
      return () => clearTimeout(t);
    }
    if (phase === 'typing') {
      console.log('Typing ServSwap.');
      let i = 0;
      setTyped('');
      const interval = setInterval(() => {
        setTyped(TYPED_TEXT.slice(0, i + 1));
        i++;
        if (i === TYPED_TEXT.length) {
          clearInterval(interval);
          console.log('ServSwap. typed, transitioning to sloganTyping in 600ms');
          setTimeout(() => setPhase('sloganTyping'), 600);
        }
      }, 90);
      return () => clearInterval(interval);
    }
    if (phase === 'sloganTyping') {
      console.log('PHASE: sloganTyping');
      // Show slogan with fly-in, then transition to hold phase after 1s
      setTimeout(() => {
        console.log('Transitioning to hold phase');
        setPhase('hold');
      }, 1000);
    }
    if (phase === 'hold') {
      console.log('PHASE: hold');
      const HOLD_DURATION = 10000; // 10 seconds
      let holdStart = null;
      if (typeof window !== 'undefined') {
        holdStart = localStorage.getItem(HOLD_START_KEY);
        if (!holdStart || isNaN(Number(holdStart))) {
          // If holdStart is missing or invalid, reset everything and start from icon
          localStorage.removeItem(PHASE_KEY);
          localStorage.removeItem(HOLD_START_KEY);
          setPhase('icon');
          console.log('[Intro] Invalid/missing holdStart, resetting to icon phase');
          return;
        }
        holdStart = parseInt(holdStart, 10);
        const elapsed = Date.now() - holdStart;
        const remaining = Math.max(HOLD_DURATION - elapsed, 0);
        console.log('Hold elapsed:', elapsed, 'remaining:', remaining);
        if (remaining <= 0) {
          // Time already elapsed, go to exit immediately
          setPhase('exiting');
          return;
        }
        const holdTimer = setTimeout(() => {
          console.log('Hold timer done, transitioning to exiting');
          setPhase('exiting');
        }, remaining);
        return () => clearTimeout(holdTimer);
      }
    }
    if (phase === 'exiting') {
      console.log('PHASE: exiting');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(HOLD_START_KEY);
        localStorage.removeItem(PHASE_KEY);
        console.log('[Intro] Cleared persisted phase and holdStart on exit');
      }
      console.log('Exiting splash, animating out and redirecting in 700ms');
      if (splashRef.current && logoRef?.current) {
        const splashRect = splashRef.current.getBoundingClientRect();
        const logoRect = logoRef.current.getBoundingClientRect();
        // Calculate scale and translation
        const scale = logoRect.width / splashRect.width;
        const translateX = logoRect.left - splashRect.left + logoRect.width / 2 - splashRect.width / 2;
        const translateY = logoRect.top - splashRect.top + logoRect.height / 2 - splashRect.height / 2;
        setExitStyle({
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          opacity: 0,
          transition: 'transform 0.7s cubic-bezier(.4,1.4,.6,1), opacity 0.7s cubic-bezier(.4,1.4,.6,1)'
        });
        setBgOpacity(0);
      }
      setIsExiting(true);
      setTimeout(() => {
        console.log('Redirecting to /');
        router.push("/");
      }, 700);
    }
  }, [phase, logoRef, router]);

  // Centering logic: when typing or done, center icon+text as a unit
  const isTypingOrDone = phase === 'typing' || phase === 'sloganTyping' || phase === 'hold' || phase === 'exiting';

  // Handler for the hidden animation end
  const handleHiddenAnimationEnd = () => {
    if (phase === 'hold') {
      setPhase('exiting');
    }
  };

  return (
    <div
      ref={splashRef}
      className={`fixed inset-0 flex flex-col items-center justify-center z-50 transition-all duration-700`}
      style={{
        ...(isExiting ? exitStyle : { transition: 'none' }),
        background: `rgba(255,255,255,${bgOpacity})`,
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
    >
      <div
        className={`flex items-center justify-center transition-all duration-700`}
        style={{ minHeight: '6rem' }}
      >
        {/* Spinning Icon */}
        <div className="relative w-24 h-24 md:w-32 md:h-32">
          <Image
            src="/iconbg.png"
            alt="Logo Background"
            fill
            style={{ objectFit: "contain" }}
            priority
          />
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Image
              src="/sforicon.png"
              alt="Logo S"
              width={120}
              height={120}
              className={spinning ? "animate-spin-s" : ""}
              priority
            />
          </div>
        </div>
        {/* Typing Text */}
        {isTypingOrDone && (
          <span className="ml-4 text-4xl md:text-5xl font-bold text-gray-900 font-sans typing-cursor">
            {typed}
          </span>
        )}
      </div>
      {/* Slogan appears after typing animation is done, with fly-in animation */}
      <div className="mt-8 text-2xl md:text-3xl font-semibold text-gray-700 tracking-tight min-h-[2.5rem] flex items-center justify-center">
        {(phase === 'sloganTyping' || phase === 'hold' || phase === 'exiting') && (
          <span className="slogan-fly-in">{SLOGAN_TEXT}</span>
        )}
      </div>
      <style jsx global>{`
        @keyframes spin-s {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-s {
          animation: spin-s 1.5s cubic-bezier(.4,1.4,.6,1) infinite;
        }
        .typing-cursor:after {
          content: '';
          display: inline-block;
          width: 0.7ch;
          height: 1.1em;
          background: #6366f1;
          margin-left: 2px;
          border-radius: 2px;
          animation: blink-cursor 1s steps(1) infinite;
          vertical-align: -0.1em;
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fade-in-slogan {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-slogan {
          animation: fade-in-slogan 1.2s cubic-bezier(.4,1.4,.6,1) 0.2s forwards;
        }
        .slogan-fly-in {
          opacity: 0;
          transform: translateY(32px);
          animation: fly-in-slogan 1s cubic-bezier(.4,1.4,.6,1) 0.1s forwards;
        }
        @keyframes fly-in-slogan {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
} 