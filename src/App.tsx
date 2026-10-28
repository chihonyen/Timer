/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Bell,
  Clock,
  Sliders
} from 'lucide-react';

export default function App() {
  // Timer & Slider state (1 to 60 minutes)
  const [sliderMinutes, setSliderMinutes] = useState<number>(25); // 25 min default
  const [totalSeconds, setTotalSeconds] = useState<number>(1500);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1500);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isTimesUp, setIsTimesUp] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // References
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetEndTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundAlertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiAnimIdRef = useRef<number | null>(null);

  // SVG Circular progress radius math (r = 115, circumference = 2 * π * 115 ≈ 722.566)
  const RADIUS = 115;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Initialize Web Audio API
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Web Audio Alarm Synthesizer (預設警報聲)
  const playAlarm = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 四聲急促清脆的數位電子警報聲 (Beep Beep Beep Beep)
      [0, 0.14, 0.28, 0.42].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + offset); // 880Hz (A5)

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.01);
        gain.gain.linearRampToValueAtTime(0.0001, now + offset + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }, [getAudioContext]);

  // Confetti Particle System
  const triggerConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e'];
    const particles = Array.from({ length: 90 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 80,
      y: canvas.height / 2 + (Math.random() - 0.5) * 80,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.9) * 18,
      gravity: 0.35,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1
    }));

    if (confettiAnimIdRef.current) {
      cancelAnimationFrame(confettiAnimIdRef.current);
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let anyAlive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.vRot;
        p.opacity -= 0.008;

        if (p.opacity > 0 && p.y < canvas.height) {
          anyAlive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }

      if (anyAlive) {
        confettiAnimIdRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
  }, []);

  // Stop repetitive sound alert
  const stopSoundAlertLoop = useCallback(() => {
    if (soundAlertIntervalRef.current) {
      clearInterval(soundAlertIntervalRef.current);
      soundAlertIntervalRef.current = null;
    }
  }, []);

  // When timer hits 00:00
  const handleTimeIsUp = useCallback(() => {
    setIsRunning(false);
    setIsTimesUp(true);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    triggerConfetti();
    playAlarm();

    let count = 0;
    stopSoundAlertLoop();
    soundAlertIntervalRef.current = setInterval(() => {
      count++;
      if (count < 4) {
        playAlarm();
      } else {
        stopSoundAlertLoop();
      }
    }, 2200);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification("⏰ Timer", {
          body: "時間到了！Time's Up!",
        });
      } catch {
        // Notification ignored
      }
    }
  }, [triggerConfetti, playAlarm, stopSoundAlertLoop]);

  // Start timer
  const handleStart = () => {
    if (remainingSeconds <= 0) return;
    getAudioContext();

    setIsRunning(true);
    setIsTimesUp(false);
    stopSoundAlertLoop();

    targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const now = Date.now();
      const diffSec = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));

      if (diffSec <= 0) {
        setRemainingSeconds(0);
        handleTimeIsUp();
      } else {
        setRemainingSeconds(diffSec);
      }
    }, 200);
  };

  // Pause timer
  const handlePause = () => {
    if (!isRunning) return;
    setIsRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Reset timer
  const handleReset = () => {
    setIsRunning(false);
    setIsTimesUp(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    stopSoundAlertLoop();
    setRemainingSeconds(totalSeconds);
  };

  // Dismiss Time's Up alert
  const handleDismissAlert = () => {
    setIsTimesUp(false);
    stopSoundAlertLoop();
  };

  // Slider change handler (1 ~ 60 minutes)
  const handleSliderChange = (mins: number) => {
    const clampedMins = Math.max(1, Math.min(60, mins));
    setSliderMinutes(clampedMins);
    const secs = clampedMins * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);

    setIsRunning(false);
    setIsTimesUp(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    stopSoundAlertLoop();
  };


  // Format time (MM:SS)
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Document Title update
  useEffect(() => {
    if (isTimesUp) {
      document.title = "⏰ TIME'S UP! 時間到了！";
    } else if (isRunning) {
      document.title = `(${formatTime(remainingSeconds)}) 倒數中 · Timer`;
    } else {
      document.title = 'Timer';
    }
  }, [remainingSeconds, isRunning, isTimesUp]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (soundAlertIntervalRef.current) clearInterval(soundAlertIntervalRef.current);
      if (confettiAnimIdRef.current) cancelAnimationFrame(confettiAnimIdRef.current);
    };
  }, []);

  // Keyboard shortcuts (Space, R, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isTimesUp) {
          handleReset();
          handleStart();
        } else if (isRunning) {
          handlePause();
        } else {
          handleStart();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'Escape') {
        if (isTimesUp) {
          handleDismissAlert();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Progress math
  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - fraction);

  // Stroke color logic
  let strokeColor = '#6366f1';
  if (isTimesUp) {
    strokeColor = '#f43f5e';
  } else if (fraction <= 0.15) {
    strokeColor = '#ef4444';
  } else if (fraction <= 0.35) {
    strokeColor = '#f59e0b';
  }

  // Slider track percentage calculation (1 to 60)
  const sliderPercentage = ((sliderMinutes - 1) / 59) * 100;

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative ${isTimesUp ? 'times-up-glow' : ''}`}>
      {/* Confetti Canvas for Time's Up Celebration */}
      <canvas ref={confettiCanvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />

      {/* Clean Top Bar: Brand "Timer" on left, Fullscreen on right */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Wordmark changed to "Timer" */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              Timer
            </span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="全螢幕"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Timer Display */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center my-auto">
        {/* Status Badge */}
        <div className="mb-2">
          <span
            className={`text-xs font-medium tracking-wide uppercase px-3.5 py-1.5 rounded-full border transition-all ${
              isTimesUp
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse'
                : isRunning
                ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                : remainingSeconds < totalSeconds
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {isTimesUp
              ? "⏰ 時間到了！Time's Up!"
              : isRunning
              ? '⏳ 倒數計時中 (Running)'
              : remainingSeconds < totalSeconds
              ? '⏸️ 計時已暫停 (Paused)'
              : '✨ 準備就緒 (Ready)'}
          </span>
        </div>

        {/* Circular Progress & Big Digital Timer */}
        <div className="relative w-68 h-68 sm:w-80 sm:h-80 flex items-center justify-center my-2 select-none">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
            <circle
              cx="130"
              cy="130"
              r={RADIUS}
              fill="none"
              stroke="rgba(30, 41, 59, 0.7)"
              strokeWidth="12"
            />
            <circle
              className="progress-ring-circle"
              cx="130"
              cy="130"
              r={RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div
              className={`font-mono text-6xl sm:text-7xl font-bold tracking-tight tabular-nums transition-colors ${
                isTimesUp ? 'text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'text-white'
              }`}
            >
              {formatTime(remainingSeconds)}
            </div>

            {isTimesUp && (
              <div className="mt-2 text-rose-400 font-black tracking-wider text-xl sm:text-2xl animate-bounce">
                TIME'S UP!
              </div>
            )}

            <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
              <span>總計 {Math.round(totalSeconds / 60)} 分鐘</span>
              <span>·</span>
              <span className="tabular-nums font-mono">
                {Math.round(fraction * 100)}% 剩餘
              </span>
            </div>
          </div>
        </div>

        {/* Intuitive Drag Slider Box */}
        <div className="w-full max-w-md my-4 p-4 sm:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">滑動拉桿設定時間</span>
              <span className="text-[11px] text-slate-500">(1 ~ 60 分鐘)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-bold text-indigo-400 tabular-nums">
                {sliderMinutes}
              </span>
              <span className="text-xs font-semibold text-slate-400">分鐘</span>
            </div>
          </div>

          {/* Slider Bar */}
          <div className="relative py-1">
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={sliderMinutes}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #818cf8 ${sliderPercentage}%, #334155 ${sliderPercentage}%, #1e293b 100%)`
              }}
              className="timer-slider"
              aria-label="倒數計時分鐘數拉桿"
            />
          </div>

          {/* Milestone Clickable Ticks */}
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 mt-2 px-1">
            {[1, 15, 25, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSliderChange(m)}
                className={`hover:text-indigo-400 transition-colors ${
                  sliderMinutes === m ? 'text-indigo-400 font-bold' : ''
                }`}
              >
                {m}分
              </button>
            ))}
          </div>


        </div>

        {/* Primary Action Buttons: Start / Pause / Reset */}
        <div className="flex items-center gap-3 w-full max-w-sm justify-center mt-1">
          <button
            onClick={() => {
              if (isTimesUp) {
                handleReset();
                handleStart();
              } else if (isRunning) {
                handlePause();
              } else {
                handleStart();
              }
            }}
            className={`flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg ${
              isTimesUp
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            {isTimesUp ? (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>重新開始 (Restart)</span>
              </>
            ) : isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>暫停 (Pause)</span>
              </>
            ) : remainingSeconds < totalSeconds ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>繼續 (Resume)</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>開始 (Start)</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="py-3.5 px-5 rounded-xl font-medium text-sm bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 active:scale-[0.98] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重設 (Reset)</span>
          </button>
        </div>


      </main>

      {/* Time's Up Modal Alert */}
      {isTimesUp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl shadow-rose-950/60 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <Bell className="w-8 h-8 animate-bounce" />
            </div>

            <h2 className="text-3xl font-black text-white tracking-wide mb-1">
              Time's Up!
            </h2>
            <p className="text-rose-400 font-semibold mb-6">倒數時間已結束！</p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDismissAlert}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white transition-all shadow-lg shadow-rose-600/30"
              >
                關閉提示 (Dismiss)
              </button>
              <button
                onClick={() => {
                  handleDismissAlert();
                  handleReset();
                  handleStart();
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                重新開始此倒數 (Restart)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
