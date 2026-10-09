import { useState, useMemo } from 'react';
import { submitConfessionPost } from '../api/client.ts';
import ClaimCodeModal from './ClaimCodeModal.tsx';
import { CONFIG } from '@/lib/config.ts';

interface SubmitConfessionProps {
  onBack: () => void;
}

const CONFESSION_TOPICS = [
  { tag: '[ KARIR & KANTOR ]', placeholder: 'Kecurangan atau rahasia tempat kerja yang belum pernah Anda ceritakan...' },
  { tag: '[ ASMARA & HUBUNGAN ]', placeholder: 'Pengakuan cinta, perselingkuhan, atau rahasia hubungan yang Anda pendam...' },
  { tag: '[ MORAL & ETIKA ]', placeholder: 'Keputusan moral kelam masa lalu yang Anda sesali...' },
  { tag: '[ KELUARGA ]', placeholder: 'Kenyataan pahit keluarga yang tidak pernah diketahui orang luar...' },
  { tag: '[ PRIBADI ]', placeholder: 'Sisi gelap atau kepalsuan hidup yang Anda tutupi selama ini...' },
];

export default function SubmitConfession({ onBack }: SubmitConfessionProps) {
  const [selectedTopic, setSelectedTopic] = useState(CONFESSION_TOPICS[0].tag);
  const [body, setBody] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorReasons, setErrorReasons] = useState<string[]>([]);

  // Success modal state
  const [claimData, setClaimData] = useState<{
    postId: string;
    claimCode: string;
    status: 'live' | 'pending_review';
    expiresAt: string | null;
    crisisInfo?: string;
  } | null>(null);

  const charCount = body.length;
  const isBodyValid = charCount >= CONFIG.BODY_MIN && charCount <= CONFIG.BODY_MAX;

  // Real-time heuristic safety indicator
  const liveWarning = useMemo(() => {
    if (!body) return null;
    if (/(?:(?:\+?62)|0)8[0-9]{7,12}/.test(body.replace(/[\s.-]/g, ''))) {
      return 'Terdeteksi pola nomor telepon / kontak seluler!';
    }
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(body)) {
      return 'Terdeteksi alamat email!';
    }
    if (/(?:https?:\/\/|wa\.me\/|t\.me\/|[a-z0-9-]+\.(?:com|org|net|id|co\.id))/i.test(body)) {
      return 'Terdeteksi tautan atau URL web/sosial media!';
    }
    if (/\b(?:plat|nopol)\s*[a-z]{1,2}\s*\d{1,4}/i.test(body)) {
      return 'Terdeteksi nomor plat kendaraan!';
    }
    return null;
  }, [body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorReasons([]);

    if (!isBodyValid) {
      setErrorMsg(`Panjang rahasia harus antara ${CONFIG.BODY_MIN} dan ${CONFIG.BODY_MAX} karakter.`);
      return;
    }

    if (!ageOk) {
      setErrorMsg('Anda harus mencentang komitmen usia 18+ dan perlindungan privasi.');
      return;
    }

    setLoading(true);

    try {
      const formattedBody = `${selectedTopic}\n${body.trim()}`;
      const res = await submitConfessionPost(formattedBody);

      if (res.statusCode === 201 && res.data) {
        setClaimData({
          postId: res.data.id,
          claimCode: res.data.claim_code,
          status: res.data.status,
          expiresAt: res.data.expires_at,
          crisisInfo: res.data.crisis_info,
        });
      } else if (res.statusCode === 422) {
        setErrorMsg('PENGAKUAN DITOLAK OLEH FILTER KEAMANAN:');
        setErrorReasons(
          res.reasons?.map((r: string) => {
            switch (r) {
              case 'contains_phone':
                return 'Terdeteksi nomor telepon.';
              case 'contains_email':
                return 'Terdeteksi alamat email.';
              case 'contains_url':
                return 'Terdeteksi tautan / link web atau media sosial.';
              case 'contains_id_number':
                return 'Terdeteksi 16 digit angka (pola NIK / KTP).';
              case 'contains_handle':
                return 'Terdeteksi username / @handle sosmed.';
              default:
                return r;
            }
          }) || ['Konten melanggar aturan perlindungan privasi pihak ketiga.']
        );
      } else if (res.statusCode === 429) {
        setErrorMsg('Batas kiriman tercapai (1 tulisan per 10 menit). Silakan coba lagi nanti.');
      } else {
        setErrorMsg(res.error || 'Gagal mengirimkan pengakuan.');
        if (res.reasons) setErrorReasons(res.reasons);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full font-mono py-8 px-4 sm:px-6">
      {/* Back button & Title */}
      <div className="flex items-center justify-between border-b-2 border-[#E6E6E6] pb-4 mb-6">
        <button
          onClick={onBack}
          type="button"
          className="text-xs uppercase tracking-wider text-[#7A7A7A] hover:text-[#E6E6E6] transition-colors cursor-pointer"
        >
          &lt; [ BATAL & KEMBALI ]
        </button>
        <span className="text-xs text-[#FF003C] uppercase tracking-wider font-bold animate-pulse">
          // PROTOKOL_PENGAKUAN_RAHASIA //
        </span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-[#E6E6E6] mb-2 uppercase tracking-tight">
        AKU PUNYA RAHASIA
      </h2>
      <p className="text-xs text-[#7A7A7A] mb-6 uppercase">
        Keluarkan beban batin yang selama ini Anda simpan sendiri. Tidak ada akun, otomatis musnah
        dalam 24 jam.
      </p>

      {/* Mandatory Anti-Doxxing Guideline Banner */}
      <div className="border-2 border-[#FF003C] bg-[#0A0A0A] p-4 mb-6 text-xs text-[#E6E6E6] flex flex-col gap-2">
        <div className="text-[#FF003C] font-bold uppercase tracking-wider flex items-center gap-2">
          <span>[ ! ]</span> PERINGATAN MUTLAK ANTI-DOXXING & PRIVASI PIHAK KETIGA:
        </div>
        <p className="leading-relaxed text-[#CCCCCC]">
          Rahasia ini adalah untuk <strong>melepaskan beban diri sendiri</strong>, BUKAN untuk
          menyerang orang lain. Dilarang mencantumkan nama asli, inisial yang mudah ditebak,
          identitas institusi/kantor spesifik, atau detail yang merugikan pihak ketiga.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Topic Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#7A7A7A] uppercase tracking-wider">
            Kategori Rahasia:
          </label>
          <div className="flex flex-wrap gap-2">
            {CONFESSION_TOPICS.map((topic) => (
              <button
                type="button"
                key={topic.tag}
                onClick={() => setSelectedTopic(topic.tag)}
                className={`py-1.5 px-3 text-xs uppercase font-bold tracking-wider border cursor-pointer transition-colors ${
                  selectedTopic === topic.tag
                    ? 'border-[#3DDC84] bg-[#3DDC84] text-black'
                    : 'border-[#333333] bg-[#0A0A0A] text-[#7A7A7A] hover:border-[#7A7A7A] hover:text-[#E6E6E6]'
                }`}
              >
                {topic.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="confession-body" className="text-[#7A7A7A] uppercase tracking-wider">
              Naskah Pengakuan Rahasia *
            </label>
            <span
              className={
                charCount < CONFIG.BODY_MIN || charCount > CONFIG.BODY_MAX
                  ? 'text-[#FF1E1E]'
                  : 'text-[#3DDC84]'
              }
            >
              {charCount} / {CONFIG.BODY_MAX} (min {CONFIG.BODY_MIN})
            </span>
          </div>

          <textarea
            id="confession-body"
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tuliskan rahasia atau pengakuan Anda sejujur-jujurnya di sini. Samarkan nama orang lain dan institusi agar tidak melanggar etika privasi..."
            className="w-full border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] p-4 text-sm font-mono focus:border-[#3DDC84] focus:outline-none placeholder:text-[#444444] resize-y"
          />

          {/* Live Scanner Warning */}
          {liveWarning ? (
            <div className="text-xs text-[#FF1E1E] flex items-center gap-1.5">
              <span>⚠</span>
              <span>{liveWarning} Hapus data tersebut sebelum mengirim.</span>
            </div>
          ) : charCount >= CONFIG.BODY_MIN ? (
            <div className="text-[11px] text-[#3DDC84] flex items-center gap-1">
              <span>✓</span>
              <span>Pemindaian real-time: Tidak terdeteksi data kontak atau PII langsung.</span>
            </div>
          ) : null}
        </div>

        {/* Checkbox Agreement */}
        <div className="flex items-start gap-3 border border-[#333333] p-3 bg-[#0A0A0A]">
          <input
            id="age-checkbox-confession"
            type="checkbox"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#3DDC84] bg-black border border-[#E6E6E6] rounded-none cursor-pointer"
          />
          <label
            htmlFor="age-checkbox-confession"
            className="text-xs text-[#E6E6E6] cursor-pointer leading-relaxed"
          >
            Saya berusia 18 tahun ke atas. Saya menjamin bahwa pengakuan ini tidak bermaksud
            mencemarkan nama baik orang lain secara spesifik dan mematuhi Aturan Komunitas.
          </label>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="border-2 border-[#FF1E1E] bg-black p-4 text-xs font-mono text-[#FF1E1E]">
            <div className="font-bold mb-1 uppercase tracking-wider">[ PERINGATAN SISTEM ]</div>
            <div>{errorMsg}</div>
            {errorReasons.length > 0 && (
              <ul className="list-disc list-inside mt-2 text-[#E6E6E6] space-y-1">
                {errorReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="border-2 border-[#7A7A7A] bg-black text-[#7A7A7A] hover:border-[#E6E6E6] hover:text-[#E6E6E6] py-3.5 px-6 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
          >
            [ BATAL ]
          </button>
          <button
            type="submit"
            disabled={loading || !isBodyValid || !ageOk || Boolean(liveWarning)}
            className={`flex-1 border-2 py-3.5 px-6 font-bold text-xs uppercase tracking-wider transition-colors text-center cursor-pointer ${
              loading || !isBodyValid || !ageOk || Boolean(liveWarning)
                ? 'border-[#444444] bg-[#222222] text-[#666666] cursor-not-allowed'
                : 'border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84]'
            }`}
          >
            {loading ? 'MEMERIKSA PRIVASI & MEMPROSES...' : '[ KELUARKAN RAHASIA KE VOID ]'}
          </button>
        </div>
      </form>

      {/* Claim Code Modal once published */}
      {claimData && (
        <ClaimCodeModal
          postId={claimData.postId}
          claimCode={claimData.claimCode}
          status={claimData.status}
          expiresAt={claimData.expiresAt}
          crisisInfo={claimData.crisisInfo}
          onClose={() => {
            setClaimData(null);
            onBack();
          }}
        />
      )}
    </div>
  );
}
