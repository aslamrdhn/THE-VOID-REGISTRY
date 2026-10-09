import { useEffect, useState } from 'react';

interface CountdownProps {
  expiresAt: string | null;
  serverNow?: string;
  isImmortal: boolean;
  onExpire?: () => void;
}

export default function Countdown({
  expiresAt,
  serverNow,
  isImmortal,
  onExpire,
}: CountdownProps) {
  // Compute server time drift offset
  const serverOffset = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (isImmortal || !expiresAt) return 0;
    const target = new Date(expiresAt).getTime();
    const effectiveNow = Date.now() + serverOffset;
    return Math.max(0, target - effectiveNow);
  });

  useEffect(() => {
    if (isImmortal || !expiresAt) return;

    const target = new Date(expiresAt).getTime();

    const interval = setInterval(() => {
      const effectiveNow = Date.now() + serverOffset;
      const diff = Math.max(0, target - effectiveNow);
      setRemainingMs(diff);

      if (diff <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isImmortal, serverOffset, onExpire]);

  if (isImmortal) {
    return (
      <div className="border border-[#3DDC84] bg-[#3DDC84]/10 text-[#3DDC84] px-2.5 py-0.5 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-[#3DDC84]"></span>
        [ ABADI ]
      </div>
    );
  }

  if (!expiresAt || remainingMs <= 0) {
    return (
      <div className="text-[#FF1E1E] text-xs font-bold tracking-wider uppercase">
        00:00:00 [ MUSNAH ]
      </div>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  // Less than 1 hour (< 3600 seconds) triggers danger & blink per PRD §5
  const isUrgent = totalSeconds < 3600;

  return (
    <div
      className={`text-xs font-mono font-bold tracking-wider flex items-center gap-1 ${
        isUrgent ? 'text-[#FF1E1E] animate-void-blink' : 'text-[#7A7A7A]'
      }`}
    >
      <span>{timeFormatted}</span>
      <span className="text-[10px] font-normal tracking-normal uppercase">
        MENUJU KEHANCURAN
      </span>
    </div>
  );
}
