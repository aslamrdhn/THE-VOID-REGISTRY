import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { PublicPost } from '@/lib/types.ts';

interface ShareCardModalProps {
  post: PublicPost;
  onClose: () => void;
}

export default function ShareCardModal({ post, onClose }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#050505',
        pixelRatio: 2, // High resolution
      });
      const link = document.createElement('a');
      link.download = `void-failure-${post.id.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
      alert('Gagal menghasilkan gambar kartu.');
    } finally {
      setDownloading(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 font-mono overflow-y-auto">
      <div className="max-w-md w-full flex flex-col gap-4">
        {/* Top Control Bar */}
        <div className="flex justify-between items-center text-xs border-b border-[#333333] pb-2">
          <span className="text-[#3DDC84] font-bold">[ EXPORT KARTU INSTA-STORY ]</span>
          <button
            onClick={onClose}
            className="text-[#7A7A7A] hover:text-[#E6E6E6] uppercase cursor-pointer"
          >
            [ &times; TUTUP ]
          </button>
        </div>

        {/* The Printable Snapshot Card Element */}
        <div
          ref={cardRef}
          className="border-2 border-[#E6E6E6] bg-[#050505] p-6 text-[#E6E6E6] flex flex-col justify-between aspect-[4/5] relative select-none shadow-2xl"
        >
          {/* Card Top */}
          <div className="flex flex-col gap-4">
            <div className="border-b-2 border-[#E6E6E6] pb-3 flex justify-between items-center">
              <span className="text-[11px] font-black tracking-widest text-[#E6E6E6] uppercase">
                THE VOID REGISTRY
              </span>
              <span className="text-[10px] text-[#3DDC84] border border-[#3DDC84] px-1.5 py-0.5">
                {post.is_immortal ? 'ABADI' : '24H LIFETIME'}
              </span>
            </div>

            {post.financial_loss_idr != null && post.financial_loss_idr > 0 && (
              <div className="text-xs font-black text-[#FF1E1E] uppercase tracking-wider">
                RUGI: Rp {formatRupiah(post.financial_loss_idr)}
              </div>
            )}

            {/* Truncated / formatted body */}
            <p className="text-sm leading-relaxed text-[#E6E6E6] whitespace-pre-wrap line-clamp-8">
              &quot;{post.body}&quot;
            </p>
          </div>

          {/* Card Bottom / Watermark */}
          <div className="border-t-2 border-[#E6E6E6] pt-3 flex justify-between items-center text-[10px] text-[#7A7A7A]">
            <span className="text-[#E6E6E6] font-bold">🍷 {post.respect_count} RESPECTS</span>
            <span className="uppercase tracking-widest text-[#7A7A7A]">
              THE FAILURE ARCHIVE
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#7A7A7A] text-[#7A7A7A] hover:text-white py-3 px-4 text-xs uppercase cursor-pointer"
          >
            BATAL
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 border-2 border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84] font-black py-3 px-4 text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
          >
            {downloading ? 'MEMBUAT GAMBAR PNG...' : '[ UNDUH KARTU GAMBAR (PNG) ]'}
          </button>
        </div>
      </div>
    </div>
  );
}
