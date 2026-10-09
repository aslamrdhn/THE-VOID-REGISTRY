import { useState } from 'react';
import { PublicPost } from '@/lib/types.ts';
import Countdown from './Countdown.tsx';
import { castRespectToPost, isPostRespectedLocally, getClaimTokenForPost } from '../api/client.ts';
import { CONFIG } from '@/lib/config.ts';

interface PostCardProps {
  post: PublicPost;
  serverNow?: string;
  onOpenDetail: (postId: string) => void;
  onOpenReport?: (postId: string) => void;
  onOpenImmortalize?: (postId: string) => void;
  onOpenShare?: (post: PublicPost) => void;
}

export default function PostCard({
  post,
  serverNow,
  onOpenDetail,
  onOpenReport,
  onOpenImmortalize,
  onOpenShare,
}: PostCardProps) {
  const [respectCount, setRespectCount] = useState(post.respect_count);
  const [hasRespected, setHasRespected] = useState(() => isPostRespectedLocally(post.id));
  const [respecting, setRespecting] = useState(false);

  // Check if current device is the author of this post
  const authorClaimCode = getClaimTokenForPost(post.id);

  // Check Immortalize eligibility (§9)
  const isEligibleForImmortalize = (() => {
    if (post.is_immortal) return false;
    if (!authorClaimCode) return false;
    if (respectCount < CONFIG.IMMORTALIZE_MIN_RESPECT) return false;
    if (!post.expires_at) return false;

    // Remaining hours check (window: <= 6 hours)
    const effectiveNow = serverNow ? new Date(serverNow).getTime() : Date.now();
    const expiryTime = new Date(post.expires_at).getTime();
    const remainingHours = (expiryTime - effectiveNow) / (3600 * 1000);
    return remainingHours > 0 && remainingHours <= CONFIG.IMMORTALIZE_WINDOW_HOURS;
  })();

  const handleRespect = async () => {
    if (hasRespected || respecting) return;
    setRespecting(true);

    try {
      const res = await castRespectToPost(post.id);
      if (res) {
        setRespectCount(res.respect_count);
        setHasRespected(true);
      }
    } catch (err) {
      console.error('Failed to cast respect:', err);
    } finally {
      setRespecting(false);
    }
  };

  const isLong = post.body.length > 400;
  const displayBody = isLong ? post.body.slice(0, 400) + '...' : post.body;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount);
  };

  return (
    <article className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-5 sm:p-6 flex flex-col justify-between font-mono hover:border-white transition-colors">
      <div>
        {/* Top bar: kind label & Countdown/Immortal badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 border border-[#7A7A7A] text-[#E6E6E6]">
              [ {post.kind === 'failure' ? 'GAGAL' : 'RAHASIA'} ]
            </span>
            {authorClaimCode && (
              <span className="text-[10px] text-[#3DDC84] border border-[#3DDC84]/50 px-1.5 py-0.5">
                KARYA ANDA
              </span>
            )}
          </div>
          <Countdown
            expiresAt={post.expires_at}
            serverNow={serverNow}
            isImmortal={post.is_immortal}
          />
        </div>

        {/* Financial Loss Display (if present) */}
        {post.financial_loss_idr != null && post.financial_loss_idr > 0 && (
          <div className="mb-3 text-xs font-bold text-[#FF1E1E] uppercase tracking-wider">
            RUGI: Rp {formatRupiah(post.financial_loss_idr)}
          </div>
        )}

        {/* Post Content */}
        <div className="text-sm text-[#E6E6E6] leading-relaxed whitespace-pre-wrap break-words mb-4">
          {displayBody}
        </div>

        {/* Read More button if truncated */}
        {isLong && (
          <button
            onClick={() => onOpenDetail(post.id)}
            className="text-xs text-[#3DDC84] hover:underline uppercase font-bold tracking-wider mb-4 block cursor-pointer"
          >
            [ BACA SELENGKAPNYA ]
          </button>
        )}
      </div>

      {/* Footer bar: Respect Button, Report, and Immortalize */}
      <div className="border-t border-[#222222] pt-4 mt-2 flex flex-col gap-3">
        {/* Immortalize Button if eligible (§9) */}
        {isEligibleForImmortalize && onOpenImmortalize && (
          <button
            onClick={() => onOpenImmortalize(post.id)}
            className="w-full border-2 border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84] py-2 px-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center animate-pulse"
          >
            ★ [ SELAMATKAN SELAMANYA · Rp 20.000 ] ★
          </button>
        )}

        <div className="flex items-center justify-between">
          {/* Respect Button */}
          <button
            type="button"
            onClick={handleRespect}
            disabled={hasRespected || respecting}
            className={`border-2 py-1.5 px-3.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
              hasRespected
                ? 'border-[#3DDC84] bg-black text-[#3DDC84] cursor-default'
                : 'border-[#E6E6E6] bg-black text-[#E6E6E6] hover:bg-[#E6E6E6] hover:text-black active:translate-y-0.5'
            }`}
          >
            <span>{hasRespected ? '✓' : '🍷'} RESPECT</span>
            <span className="border-l border-current pl-2">{respectCount}</span>
          </button>

          {/* Action links */}
          <div className="flex items-center gap-2.5 text-xs text-[#7A7A7A]">
            {onOpenShare && (
              <>
                <button
                  onClick={() => onOpenShare(post)}
                  className="hover:text-[#E6E6E6] uppercase transition-colors cursor-pointer"
                  title="Unduh Kartu Gambar Insta-Story"
                >
                  BAGIKAN
                </button>
                <span>·</span>
              </>
            )}
            <button
              onClick={() => onOpenDetail(post.id)}
              className="hover:text-[#E6E6E6] uppercase transition-colors cursor-pointer"
            >
              DETAIL
            </button>
            {onOpenReport && (
              <>
                <span>·</span>
                <button
                  onClick={() => onOpenReport(post.id)}
                  className="hover:text-[#FF1E1E] uppercase transition-colors cursor-pointer"
                >
                  LAPORKAN
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
