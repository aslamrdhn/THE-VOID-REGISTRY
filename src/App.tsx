/**
 * THE VOID REGISTRY
 * Complete Production Applet with Failure & Confession Protocols Active
 * Theme: Brutalist Black Monospace
 */

import { useState, useEffect } from 'react';
import SubmitFailure from './components/SubmitFailure.tsx';
import SubmitConfession from './components/SubmitConfession.tsx';
import PostDetail from './components/PostDetail.tsx';
import HomeFeed from './components/HomeFeed.tsx';
import AgeGateModal from './components/AgeGateModal.tsx';
import ReportModal from './components/ReportModal.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import LegalPage from './components/LegalPage.tsx';
import ShareCardModal from './components/ShareCardModal.tsx';
import ImmortalizeModal from './components/ImmortalizeModal.tsx';

import {
  getSavedClaimTokens,
  hasAcceptedAgeGate,
  acceptAgeGate,
} from './api/client.ts';
import { db } from '@/lib/db.ts';
import { hashClaimCode } from '@/lib/hash.ts';
import { PublicPost } from '@/lib/types.ts';

type AppScreen = 'home' | 'submit_failure' | 'submit_confession' | 'post_detail';

// Initial local dev seed (PRD §12: jelas berlabel contoh dev)
function initDevSeeds() {
  if (db.posts.size === 0) {
    const now = new Date();

    // Dev Sample 1: Failure - 3 hours ago with 18 respects
    const p1 = db.publishPost({
      kind: 'failure',
      body: '[CONTOH DEV] Sistem kasir POS crash di hari peluncuran 50 cabang kafe. Mengabaikan load testing karena terburu-buru mengejar deadline investor. Kehilangan Rp 50.000.000 dalam 6 jam pertama.',
      financial_loss_idr: 50000000,
      status: 'live',
      claim_hash: hashClaimCode('VOID-DEV1-SEED-0000-0001'),
      now: new Date(now.getTime() - 3 * 3600 * 1000),
    });
    p1.respect_count = 18;
    db.posts.set(p1.id, p1);

    // Dev Sample 2: Confession - Unlocked!
    const p2 = db.publishPost({
      kind: 'confession',
      body: '[CONTOH DEV - RAHASIA] [ KARIR & KANTOR ]\nSelama 3 tahun bekerja di kantor agensi, saya yang sengaja menghapus backup kode proyek sebelum saya mengundurkan diri karena gaji 4 bulan tidak pernah dibayarkan penuh dan bos melakukan verbal abuse setiap hari.',
      financial_loss_idr: null,
      status: 'live',
      claim_hash: hashClaimCode('VOID-DEV2-CONF-0000-0002'),
      now: new Date(now.getTime() - 5 * 3600 * 1000),
    });
    p2.respect_count = 29;
    db.posts.set(p2.id, p2);

    // Dev Sample 3: Failure with 45 minutes remaining (< 1 hour triggers red blink)
    const p3 = db.publishPost({
      kind: 'failure',
      body: '[CONTOH DEV] Klien menolak membayar retainer 6 bulan setelah seluruh branding dan website selesai. Tidak ada kontrak tertulis bermaterai karena pertemanan keluarga.',
      financial_loss_idr: 120000000,
      status: 'live',
      claim_hash: hashClaimCode('VOID-DEV3-SEED-0000-0003'),
      now: new Date(now.getTime() - 23 * 3600 * 1000 - 15 * 60 * 1000),
    });
    p3.respect_count = 12;
    db.posts.set(p3.id, p3);

    // Dev Sample 4: Immortalized Hall of Fame
    const p4 = db.publishPost({
      kind: 'failure',
      body: '[CONTOH DEV] Mengundurkan diri dari BUMN untuk membuat startup logistik tanpa validasi pasar. Tabungan 5 tahun habis dalam 8 bulan. Pelajaran termahal dalam hidup.',
      financial_loss_idr: 300000000,
      status: 'live',
      claim_hash: hashClaimCode('VOID-DEV4-SEED-0000-0004'),
      now: new Date(now.getTime() - 12 * 3600 * 1000),
    });
    p4.is_immortal = true;
    p4.immortalized_at = new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
    p4.respect_count = 42;
    db.posts.set(p4.id, p4);
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Modals state
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [reportTargetPostId, setReportTargetPostId] = useState<string | null>(null);
  const [immortalizeTargetPostId, setImmortalizeTargetPostId] = useState<string | null>(null);
  const [shareTargetPost, setShareTargetPost] = useState<PublicPost | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [legalTab, setLegalTab] = useState<'rules' | 'terms' | 'privacy' | null>(null);

  const [savedTokens, setSavedTokens] = useState(() => getSavedClaimTokens());

  useEffect(() => {
    initDevSeeds();
    if (!hasAcceptedAgeGate()) {
      setShowAgeGate(true);
    }
  }, []);

  const handleOpenDetail = (postId: string) => {
    setSelectedPostId(postId);
    setScreen('post_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAcceptAge = () => {
    acceptAgeGate();
    setShowAgeGate(false);
  };

  return (
    <div className="min-h-screen bg-black text-[#E6E6E6] font-mono selection:bg-[#E6E6E6] selection:text-black flex flex-col justify-between p-4 sm:p-8 md:p-12">
      {/* 18+ Age Gate Modal */}
      {showAgeGate && <AgeGateModal onAccept={handleAcceptAge} />}

      {/* Report Modal */}
      {reportTargetPostId && (
        <ReportModal
          postId={reportTargetPostId}
          onClose={() => setReportTargetPostId(null)}
        />
      )}

      {/* Immortalize Payment Modal */}
      {immortalizeTargetPostId && (
        <ImmortalizeModal
          postId={immortalizeTargetPostId}
          onClose={() => setImmortalizeTargetPostId(null)}
          onSuccess={() => {
            setImmortalizeTargetPostId(null);
            setScreen('home');
          }}
        />
      )}

      {/* Share / Insta-Story Card Modal */}
      {shareTargetPost && (
        <ShareCardModal
          post={shareTargetPost}
          onClose={() => setShareTargetPost(null)}
        />
      )}

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {/* Legal Pages Modal */}
      {legalTab && (
        <LegalPage initialTab={legalTab} onClose={() => setLegalTab(null)} />
      )}

      {/* Header bar (§5) */}
      <header className="border-b-2 border-[#E6E6E6] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div
          onClick={() => {
            setScreen('home');
            setSelectedPostId(null);
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <span className="inline-block w-3 h-3 bg-[#3DDC84] animate-pulse"></span>
          <span className="font-bold tracking-widest text-lg sm:text-xl group-hover:text-[#3DDC84] transition-colors">
            THE VOID REGISTRY
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#7A7A7A] uppercase tracking-wider">
          {savedTokens.length > 0 && (
            <span className="text-[#3DDC84] border border-[#3DDC84]/50 px-2 py-0.5">
              {savedTokens.length} KARYA ANDA
            </span>
          )}
          <span>24 JAM KEHANCURAN · NO LOGIN</span>
          <button
            onClick={() => setShowAdminPanel(true)}
            className="border border-[#7A7A7A] hover:border-[#E6E6E6] px-2 py-0.5 text-[#7A7A7A] hover:text-[#E6E6E6] cursor-pointer"
          >
            [ ADMIN ]
          </button>
        </div>
      </header>

      {/* Screen Router */}
      <main className="my-8 w-full">
        {screen === 'home' && (
          <div className="flex flex-col gap-16">
            {/* Hero Section with Two Giant Doors */}
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto w-full pt-4">
              <div className="text-xs tracking-widest text-[#7A7A7A] mb-3 uppercase">
                // RUANG BAWAH TANAH DIGITAL //
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 text-[#E6E6E6] uppercase">
                TULIS KEGAGALAN.<br />
                LEPASKAN RAHASIA.<br />
                HILANG DALAM 24 JAM.
              </h1>
              <p className="text-xs sm:text-sm text-[#7A7A7A] max-w-xl mb-10 leading-relaxed">
                Situs anonim tanpa akun. Tidak ada profil. Tidak ada komentar. Hanya tulisan jujur
                yang otomatis musnah menuju kehancuran, kecuali diselamatkan oleh apresiasi massa.
              </p>

              {/* Action Doors (§5 PRD) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
                {/* Failure Door */}
                <button
                  type="button"
                  onClick={() => setScreen('submit_failure')}
                  className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] py-6 px-4 font-bold text-lg tracking-wider uppercase transition-colors hover:bg-[#E6E6E6] hover:text-black active:translate-y-0.5 cursor-pointer flex flex-col items-center justify-center gap-1"
                >
                  <span>[ AKU GAGAL ]</span>
                  <span className="text-[10px] text-[#7A7A7A] font-normal tracking-normal uppercase">
                    Tulis kegagalan publik
                  </span>
                </button>

                {/* Confession Door (NOW OPEN & FULLY ACCESSIBLE!) */}
                <button
                  type="button"
                  onClick={() => setScreen('submit_confession')}
                  className="border-2 border-[#FF003C] bg-black text-[#FF003C] py-6 px-4 font-bold text-lg tracking-wider uppercase transition-colors hover:bg-[#FF003C] hover:text-black active:translate-y-0.5 cursor-pointer flex flex-col items-center justify-center gap-1 shadow-lg shadow-[#FF003C]/10"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#FF003C] animate-ping"></span>
                    [ AKU PUNYA RAHASIA ]
                  </span>
                  <span className="text-[10px] text-[#CCCCCC] font-normal tracking-normal uppercase">
                    Pengakuan batin & rahasia
                  </span>
                </button>
              </div>
            </div>

            {/* Observatory Feed Section */}
            <HomeFeed
              onOpenDetail={handleOpenDetail}
              onOpenSubmit={() => setScreen('submit_failure')}
              onOpenSubmitConfession={() => setScreen('submit_confession')}
              onOpenReport={(id) => setReportTargetPostId(id)}
              onOpenImmortalize={(id) => setImmortalizeTargetPostId(id)}
              onOpenShare={(post) => setShareTargetPost(post)}
            />
          </div>
        )}

        {screen === 'submit_failure' && (
          <SubmitFailure
            onBack={() => {
              setScreen('home');
              setSavedTokens(getSavedClaimTokens());
            }}
          />
        )}

        {screen === 'submit_confession' && (
          <SubmitConfession
            onBack={() => {
              setScreen('home');
              setSavedTokens(getSavedClaimTokens());
            }}
          />
        )}

        {screen === 'post_detail' && selectedPostId && (
          <PostDetail
            postId={selectedPostId}
            onBack={() => {
              setScreen('home');
              setSelectedPostId(null);
            }}
            onOpenReport={(id) => setReportTargetPostId(id)}
            onOpenShare={(post) => setShareTargetPost(post)}
          />
        )}
      </main>

      {/* Footer bar (§5) */}
      <footer className="border-t-2 border-[#E6E6E6] pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-[#7A7A7A] gap-4">
        <div>THE VOID REGISTRY · V1.0 · STRICT ANONYMITY</div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setLegalTab('rules')}
            className="hover:text-[#E6E6E6] cursor-pointer uppercase"
          >
            ATURAN
          </button>
          <span>·</span>
          <button
            onClick={() => setLegalTab('terms')}
            className="hover:text-[#E6E6E6] cursor-pointer uppercase"
          >
            SYARAT
          </button>
          <span>·</span>
          <button
            onClick={() => setLegalTab('privacy')}
            className="hover:text-[#E6E6E6] cursor-pointer uppercase"
          >
            PRIVASI
          </button>
          <span>·</span>
          <button
            onClick={() => setShowAdminPanel(true)}
            className="text-[#FF1E1E] hover:underline cursor-pointer uppercase"
          >
            PANEL ADMIN
          </button>
        </div>
      </footer>
    </div>
  );
}
