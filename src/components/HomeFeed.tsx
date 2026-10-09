import { useEffect, useState, useCallback } from 'react';
import { PublicPost } from '@/lib/types.ts';
import { fetchPosts } from '../api/client.ts';
import PostCard from './PostCard.tsx';

interface HomeFeedProps {
  onOpenDetail: (postId: string) => void;
  onOpenSubmit: () => void;
  onOpenSubmitConfession?: () => void;
  onOpenReport?: (postId: string) => void;
  onOpenImmortalize?: (postId: string) => void;
  onOpenShare?: (post: PublicPost) => void;
}

type FeedTab = 'hot' | 'new' | 'hall';
type KindFilter = 'all' | 'failure' | 'confession';

export default function HomeFeed({
  onOpenDetail,
  onOpenSubmit,
  onOpenSubmitConfession,
  onOpenReport,
  onOpenImmortalize,
  onOpenShare,
}: HomeFeedProps) {
  const [tab, setTab] = useState<FeedTab>('hot');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [serverNow, setServerNow] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (targetTab: FeedTab, targetKind: KindFilter, isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const res = await fetchPosts(targetTab, undefined, targetKind);
        setPosts(res.items);
        setNextCursor(res.next_cursor);
        setServerNow(res.server_now);
      } catch (err) {
        console.error('Error loading feed:', err);
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    []
  );

  // Tab or Kind switch
  useEffect(() => {
    loadFeed(tab, kindFilter, true);
  }, [tab, kindFilter, loadFeed]);

  // Polling every 60 seconds per PRD §5
  useEffect(() => {
    const timer = setInterval(() => {
      loadFeed(tab, kindFilter, false);
    }, 60000);
    return () => clearInterval(timer);
  }, [tab, kindFilter, loadFeed]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPosts(tab, nextCursor, kindFilter);
      setPosts((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor);
      setServerNow(res.server_now);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full font-mono flex flex-col gap-6">
      {/* Top Banner & Submit CTA */}
      <div className="border-2 border-[#E6E6E6] bg-black p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7A7A7A] mb-1">
            THE OBSERVATORY // ARSIP KEGAGALAN & RAHASIA
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#E6E6E6] uppercase tracking-tight">
            24 JAM MENUJU KEHANCURAN
          </h2>
          <p className="text-xs text-[#7A7A7A] mt-1 max-w-md">
            Setiap tulisan otomatis musnah kecuali di-Immortalize oleh apresiasi massa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onOpenSubmit}
            className="border-2 border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84] py-3 px-5 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            [ + AKU GAGAL ]
          </button>
          {onOpenSubmitConfession && (
            <button
              onClick={onOpenSubmitConfession}
              className="border-2 border-[#FF003C] bg-[#FF003C] text-black hover:bg-black hover:text-[#FF003C] py-3 px-5 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              [ + AKU PUNYA RAHASIA ]
            </button>
          )}
        </div>
      </div>

      {/* Filter Row: Type Switcher & Ranking Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-[#E6E6E6] pb-1">
        {/* Tabs Header (§6.8) */}
        <div className="flex text-xs font-bold uppercase tracking-wider overflow-x-auto">
          <button
            onClick={() => setTab('hot')}
            className={`py-3 px-5 cursor-pointer transition-colors border-b-2 -mb-[3px] ${
              tab === 'hot'
                ? 'border-[#3DDC84] text-[#3DDC84] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ HOT ]
          </button>
          <button
            onClick={() => setTab('new')}
            className={`py-3 px-5 cursor-pointer transition-colors border-b-2 -mb-[3px] ${
              tab === 'new'
                ? 'border-[#3DDC84] text-[#3DDC84] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ BARU ]
          </button>
          <button
            onClick={() => setTab('hall')}
            className={`py-3 px-5 cursor-pointer transition-colors border-b-2 -mb-[3px] ${
              tab === 'hall'
                ? 'border-[#3DDC84] text-[#3DDC84] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ HALL OF FAME ★ ]
          </button>
        </div>

        {/* Kind Filters */}
        <div className="flex items-center gap-2 text-xs py-1">
          <span className="text-[#7A7A7A] text-[10px] uppercase">FILTER:</span>
          <button
            onClick={() => setKindFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase cursor-pointer border ${
              kindFilter === 'all'
                ? 'border-[#E6E6E6] bg-[#E6E6E6] text-black'
                : 'border-[#333333] text-[#7A7A7A] hover:border-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            SEMUA
          </button>
          <button
            onClick={() => setKindFilter('failure')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase cursor-pointer border ${
              kindFilter === 'failure'
                ? 'border-[#3DDC84] bg-[#3DDC84] text-black'
                : 'border-[#333333] text-[#7A7A7A] hover:border-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            GAGAL
          </button>
          <button
            onClick={() => setKindFilter('confession')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase cursor-pointer border ${
              kindFilter === 'confession'
                ? 'border-[#FF003C] bg-[#FF003C] text-black'
                : 'border-[#333333] text-[#7A7A7A] hover:border-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            RAHASIA
          </button>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#7A7A7A] uppercase tracking-widest animate-pulse">
          MENGHUBUNGI ARSIP THE VOID...
        </div>
      ) : posts.length === 0 ? (
        <div className="border-2 border-[#333333] bg-[#0A0A0A] p-12 text-center text-xs text-[#7A7A7A] uppercase flex flex-col items-center gap-4">
          <span>
            {tab === 'hall'
              ? 'BELUM ADA TULISAN YANG DI-IMMORTALIZE KE HALL OF FAME.'
              : 'TIDAK ADA ARSIP DENGAN FILTER INI SAAT INI.'}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onOpenSubmit}
              className="border border-[#7A7A7A] hover:border-[#E6E6E6] text-[#E6E6E6] py-2 px-4 text-xs uppercase cursor-pointer"
            >
              [ TULIS KEGAGALAN ]
            </button>
            {onOpenSubmitConfession && (
              <button
                onClick={onOpenSubmitConfession}
                className="border border-[#FF003C] text-[#FF003C] hover:bg-[#FF003C] hover:text-black py-2 px-4 text-xs uppercase cursor-pointer"
              >
                [ TULIS RAHASIA ]
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              serverNow={serverNow}
              onOpenDetail={onOpenDetail}
              onOpenReport={onOpenReport}
              onOpenImmortalize={onOpenImmortalize}
              onOpenShare={onOpenShare}
            />
          ))}
        </div>
      )}

      {/* Pagination / Load more */}
      {nextCursor && !loading && (
        <div className="text-center pt-4 pb-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] hover:bg-[#E6E6E6] hover:text-black py-3 px-8 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {loadingMore ? 'MEMUAT...' : '[ MUAT LEBIH BANYAK ARSIP ]'}
          </button>
        </div>
      )}
    </div>
  );
}
