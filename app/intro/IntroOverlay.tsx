"use client";
import { useEffect, useRef, useState, useContext } from "react";
import Image from "next/image";
import { LogoRefContext } from "../components/Header";

const TYPED_TEXT = "ServSwap.";
const SLOGAN_TEXT = "Trade Skills, Not Money";

export default function IntroOverlay({ onFinish }: { onFinish?: () => void }) {
  const [phase, setPhase] = useState<'icon' | 'move' | 'typing' | 'slogan' | 'hold' | 'slideUp'>('icon');
  const [typed, setTyped] = useState('');
  const [spinning, setSpinning] = useState(true);
  const [showIcons, setShowIcons] = useState(true);
  const [zooming, setZooming] = useState(false);
  const [flash, setFlash] = useState(false);
  const [slideUp, setSlideUp] = useState(false);
  const splashRef = useRef<HTMLDivElement>(null);
  const logoRef = useContext(LogoRefContext);

  // Animation sequence
  useEffect(() => {
    if (phase === 'icon') {
      const t = setTimeout(() => setPhase('move'), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 'move') {
      const t = setTimeout(() => setPhase('typing'), 600);
      return () => clearTimeout(t);
    }
    if (phase === 'typing') {
      let i = 0;
      setTyped('');
      const interval = setInterval(() => {
        setTyped(TYPED_TEXT.slice(0, i + 1));
        i++;
        if (i === TYPED_TEXT.length) {
          clearInterval(interval);
          setTimeout(() => setPhase('slogan'), 600);
        }
      }, 90);
      return () => clearInterval(interval);
    }
    if (phase === 'slogan') {
      // Show slogan, then hold for 2s before slide up
      const t = setTimeout(() => setPhase('hold'), 2000);
      return () => clearTimeout(t);
    }
    if (phase === 'hold') {
      // Hold for 0.5s, then trigger smooth slide up
      const t = setTimeout(() => {
        setSlideUp(true);
        setPhase('slideUp');
      }, 500);
      return () => clearTimeout(t);
    }
    if (phase === 'slideUp') {
      // Wait for slide up animation to complete, then unmount
      const t = setTimeout(() => {
        if (onFinish) onFinish();
      }, 1500); // Match the duration of the CSS transition
      return () => clearTimeout(t);
    }
  }, [phase, onFinish]);

  // Stop spinning after 2 spins (3s)
  useEffect(() => {
    const spinTimer = setTimeout(() => setSpinning(false), 3000);
    return () => clearTimeout(spinTimer);
  }, []);

  // Hide icons after 3s (orbit duration)
  useEffect(() => {
    const iconTimer = setTimeout(() => setShowIcons(false), 3000);
    return () => clearTimeout(iconTimer);
  }, []);

  // Start smooth zoom after icons disappear
  useEffect(() => {
    const zoomTimer = setTimeout(() => setZooming(true), 3100);
    return () => clearTimeout(zoomTimer);
  }, []);

  // Flash after smooth zoom (0.7s duration)
  useEffect(() => {
    const flashTimer = setTimeout(() => setFlash(true), 3800);
    return () => clearTimeout(flashTimer);
  }, []);

  // Centering logic: when typing or done, center icon+text as a unit
  const isTypingOrDone = phase === 'typing' || phase === 'slogan' || phase === 'hold' || phase === 'slideUp';

  return (
    <div
      ref={splashRef}
      className={`fixed inset-0 flex flex-col items-center justify-center z-[9999] bg-white transition-transform duration-[1500ms] ease-out ${slideUp ? 'translate-y-[-100%]' : 'translate-y-0'}`}
      style={{ pointerEvents: slideUp ? 'none' : 'auto' }}
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
      {/* Slogan fly-in */}
      {(phase === 'slogan' || phase === 'hold' || phase === 'slideUp') && (
        <div className="mt-8 text-2xl md:text-3xl font-semibold text-gray-700 tracking-tight min-h-[2.5rem] flex items-center justify-center">
          <span className="slogan-fly-in">{SLOGAN_TEXT}</span>
        </div>
      )}
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