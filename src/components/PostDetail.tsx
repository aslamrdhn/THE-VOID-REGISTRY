import { useEffect, useState } from 'react';
import { PublicPost } from '@/lib/types.ts';
import {
  fetchPostById,
  castRespectToPost,
  isPostRespectedLocally,
  getClaimTokenForPost,
  deletePostWithClaimCode,
} from '../api/client.ts';
import Countdown from './Countdown.tsx';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
  onOpenReport?: (postId: string) => void;
  onOpenShare?: (post: PublicPost) => void;
}

export default function PostDetail({ postId, onBack, onOpenReport, onOpenShare }: PostDetailProps) {
  const [post, setPost] = useState<(PublicPost & { server_now: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [respectCount, setRespectCount] = useState(0);
  const [hasRespected, setHasRespected] = useState(false);
  const [respecting, setRespecting] = useState(false);

  // Self deletion state
  const [deleting, setDeleting] = useState(false);
  const [customClaimCode, setCustomClaimCode] = useState('');
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const savedToken = getClaimTokenForPost(postId);

  useEffect(() => {
    let mounted = true;
    fetchPostById(postId)
      .then((data) => {
        if (!mounted) return;
        if (data) {
          setPost(data);
          setRespectCount(data.respect_count);
          setHasRespected(isPostRespectedLocally(data.id));
        } else {
          setError('TULISAN TIDAK DITEMUKAN ATAU SUDAH MUSNAH.');
        }
      })
      .catch(() => {
        if (mounted) setError('Gagal memuat tulisan.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [postId]);

  const handleRespect = async () => {
    if (!post || hasRespected || respecting) return;
    setRespecting(true);
    try {
      const res = await castRespectToPost(post.id);
      if (res) {
        setRespectCount(res.respect_count);
        setHasRespected(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRespecting(false);
    }
  };

  const handleDelete = async () => {
    const codeToUse = savedToken || customClaimCode.trim();
    if (!codeToUse) {
      setDeleteError('Masukkan kode klaim untuk menghapus tulisan.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      const success = await deletePostWithClaimCode(postId, codeToUse);
      if (success) {
        alert('TULISAN BERHASIL DIHAPUS OLEH PENULIS.');
        onBack();
      } else {
        setDeleteError('KODE KLAIM SALAH ATAU TIDAK BERLAKU.');
      }
    } catch {
      setDeleteError('Gagal menghapus tulisan.');
    } finally {
      setDeleting(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center font-mono text-sm text-[#7A7A7A]">
        MEMUAT ARSIP DARI THE VOID...
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 font-mono">
        <div className="border-2 border-[#FF1E1E] bg-[#0A0A0A] p-6 text-center">
          <div className="text-sm font-bold text-[#FF1E1E] uppercase mb-4">
            [ 404: ARSIP TIDAK ADA ]
          </div>
          <p className="text-xs text-[#7A7A7A] mb-6">
            {error || 'Tulisan telah melewati batas 24 jam dan musnah dari peredaran publik.'}
          </p>
          <button
            onClick={onBack}
            className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] hover:bg-[#E6E6E6] hover:text-black py-2.5 px-6 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            &lt; [ KEMBALI KE OBSERVATORY ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full font-mono py-8 px-4 sm:px-6">
      {/* Top navigation */}
      <div className="flex items-center justify-between border-b-2 border-[#E6E6E6] pb-4 mb-6">
        <button
          onClick={onBack}
          className="text-xs uppercase tracking-wider text-[#7A7A7A] hover:text-[#E6E6E6] transition-colors cursor-pointer"
        >
          &lt; [ KEMBALI KE FEED ]
        </button>
        <span className="text-xs text-[#7A7A7A] uppercase tracking-wider">
          ARSIP #{post.id.slice(0, 8)}
        </span>
      </div>

      {/* Main Post Container */}
      <div className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-6 sm:p-8 flex flex-col gap-6">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222222] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 border border-[#7A7A7A] text-[#E6E6E6]">
              [ {post.kind === 'failure' ? 'KEGAGALAN' : 'RAHASIA'} ]
            </span>
            {savedToken && (
              <span className="text-xs text-[#3DDC84] border border-[#3DDC84] px-2 py-0.5 font-bold">
                KARYA ANDA
              </span>
            )}
          </div>
          <Countdown
            expiresAt={post.expires_at}
            serverNow={post.server_now}
            isImmortal={post.is_immortal}
          />
        </div>

        {/* Financial loss if recorded */}
        {post.financial_loss_idr != null && post.financial_loss_idr > 0 && (
          <div className="text-sm font-bold text-[#FF1E1E] uppercase tracking-wider border-l-2 border-[#FF1E1E] pl-3">
            TOTAL KERUGIAN FINANSIAL: Rp {formatRupiah(post.financial_loss_idr)}
          </div>
        )}

        {/* Complete Body */}
        <div className="text-base sm:text-lg text-[#E6E6E6] leading-relaxed whitespace-pre-wrap break-words">
          {post.body}
        </div>

        {/* Interactions Footer */}
        <div className="border-t border-[#222222] pt-6 flex flex-wrap items-center justify-between gap-4">
          {/* Respect Button */}
          <button
            type="button"
            onClick={handleRespect}
            disabled={hasRespected || respecting}
            className={`border-2 py-2 px-5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
              hasRespected
                ? 'border-[#3DDC84] bg-black text-[#3DDC84] cursor-default'
                : 'border-[#E6E6E6] bg-black text-[#E6E6E6] hover:bg-[#E6E6E6] hover:text-black active:translate-y-0.5'
            }`}
          >
            <span>{hasRespected ? '✓' : '🍷'} RESPECT</span>
            <span className="border-l border-current pl-2">{respectCount}</span>
          </button>

          <div className="flex items-center gap-4 text-xs text-[#7A7A7A]">
            {onOpenShare && (
              <button
                onClick={() => onOpenShare(post)}
                className="hover:text-[#3DDC84] uppercase transition-colors cursor-pointer text-[#E6E6E6]"
              >
                [ BAGIKAN KARTU ]
              </button>
            )}
            {onOpenReport && (
              <button
                onClick={() => onOpenReport(post.id)}
                className="hover:text-[#FF1E1E] uppercase transition-colors cursor-pointer"
              >
                [ LAPORKAN ]
              </button>
            )}
            <button
              onClick={() => setShowDeleteBox(!showDeleteBox)}
              className="hover:text-[#FF1E1E] uppercase transition-colors cursor-pointer"
            >
              [ HAPUS TULISAN ]
            </button>
          </div>
        </div>

        {/* Author Self-Delete Panel (PRD §6.1 & §8) */}
        {showDeleteBox && (
          <div className="border-2 border-[#FF1E1E] bg-black p-4 mt-2 flex flex-col gap-3 text-xs">
            <div className="text-[#FF1E1E] font-bold uppercase">
              HAPUS MANDIRI TULISAN (HANYA DENGAN KODE KLAIM)
            </div>
            <p className="text-[#7A7A7A]">
              Sebagai penulis asli, Anda dapat menghapus tulisan ini kapan saja menggunakan token
              klaim yang diterima saat pertama kali menerbitkan tulisan.
            </p>

            {savedToken ? (
              <div className="text-[#3DDC84]">
                Token klaim Anda tersimpan di perangkat ini: <span className="font-bold">{savedToken}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-[#7A7A7A]">Masukkan Kode Klaim (VOID-XXXX...):</label>
                <input
                  type="text"
                  value={customClaimCode}
                  onChange={(e) => setCustomClaimCode(e.target.value)}
                  placeholder="VOID-XXXX-XXXX-XXXX-XXXX"
                  className="border border-[#7A7A7A] bg-black text-[#E6E6E6] p-2 font-mono uppercase focus:border-[#FF1E1E] focus:outline-none"
                />
              </div>
            )}

            {deleteError && <div className="text-[#FF1E1E] font-bold">{deleteError}</div>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="border-2 border-[#FF1E1E] bg-[#FF1E1E] text-black hover:bg-black hover:text-[#FF1E1E] font-bold py-2 px-4 uppercase transition-colors cursor-pointer"
              >
                {deleting ? 'MENGHAPUS...' : '[ KONFIRMASI HAPUS PERMANEN ]'}
              </button>
              <button
                onClick={() => setShowDeleteBox(false)}
                className="border border-[#7A7A7A] text-[#7A7A7A] hover:text-[#E6E6E6] py-2 px-3 uppercase cursor-pointer"
              >
                BATAL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
