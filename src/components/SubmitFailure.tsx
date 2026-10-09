import { useState } from 'react';
import { submitFailurePost } from '../api/client.ts';
import ClaimCodeModal from './ClaimCodeModal.tsx';
import { CONFIG } from '@/lib/config.ts';

interface SubmitFailureProps {
  onBack: () => void;
}

export default function SubmitFailure({ onBack }: SubmitFailureProps) {
  const [body, setBody] = useState('');
  const [financialLoss, setFinancialLoss] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorReasons([]);

    if (!isBodyValid) {
      setErrorMsg(`Panjang teks harus antara ${CONFIG.BODY_MIN} dan ${CONFIG.BODY_MAX} karakter.`);
      return;
    }

    if (!ageOk) {
      setErrorMsg('Anda harus mencentang persetujuan usia 18+ dan Aturan.');
      return;
    }

    let lossNumber: number | undefined = undefined;
    if (financialLoss.trim()) {
      const cleanLoss = financialLoss.replace(/[^0-9]/g, '');
      if (cleanLoss) {
        lossNumber = parseInt(cleanLoss, 10);
      }
    }

    setLoading(true);

    try {
      const res = await submitFailurePost({
        body,
        financial_loss_idr: lossNumber ?? null,
        age_ok: true,
      });

      if (res.statusCode === 201 && res.data) {
        setClaimData({
          postId: res.data.id,
          claimCode: res.data.claim_code,
          status: res.data.status,
          expiresAt: res.data.expires_at,
          crisisInfo: res.data.crisis_info,
        });
      } else if (res.statusCode === 422) {
        setErrorMsg('TULISAN DITOLAK OLEH FILTER KEAMANAN:');
        setErrorReasons(
          res.reasons?.map((r: string) => {
            switch (r) {
              case 'contains_phone':
                return 'Terdeteksi pola nomor telepon / kontak seluler.';
              case 'contains_email':
                return 'Terdeteksi alamat email.';
              case 'contains_url':
                return 'Terdeteksi tautan / URL situs web atau media sosial.';
              case 'contains_id_number':
                return 'Terdeteksi 16 digit angka (pola NIK / KTP).';
              case 'contains_handle':
                return 'Terdeteksi username / @handle sosial media.';
              default:
                return r;
            }
          }) || ['Konten tidak lolos aturan sensor anonimitas.']
        );
      } else if (res.statusCode === 429) {
        setErrorMsg('Batas pengiriman tercapai (1 tulisan per 10 menit). Silakan coba lagi nanti.');
      } else {
        setErrorMsg(res.error || 'Gagal mengirimkan tulisan.');
        if (res.reasons) setErrorReasons(res.reasons);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiahInput = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(digits, 10));
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
        <span className="text-xs text-[#3DDC84] uppercase tracking-wider">
          PROTOKOL_PENGAKUAN_KEGAGALAN
        </span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-[#E6E6E6] mb-2 uppercase tracking-tight">
        DEKLARASIKAN KEGAGALAN
      </h2>
      <p className="text-xs text-[#7A7A7A] mb-6 uppercase">
        Tulisan Anda akan tayang tanpa identitas dan musnah dalam 24 jam.
      </p>

      {/* Mandatory Guidance Notice (§5) */}
      <div className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-4 mb-6 text-xs text-[#E6E6E6]">
        <div className="text-[#FF1E1E] font-bold mb-1 uppercase tracking-wider">
          PANDUAN MUTLAK ANONIMITAS:
        </div>
        <p className="leading-relaxed text-[#7A7A7A]">
          &quot;Jangan sebut nama asli orang atau perusahaan. Jangan tulis nomor telepon, email,
          atau tautan.&quot;
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Textarea */}
        <div className="flex flex-col gap-2">
          <label htmlFor="failure-body" className="text-xs text-[#7A7A7A] uppercase tracking-wider flex justify-between">
            <span>Kisah Kegagalan *</span>
            <span
              className={
                charCount < CONFIG.BODY_MIN || charCount > CONFIG.BODY_MAX
                  ? 'text-[#FF1E1E]'
                  : 'text-[#3DDC84]'
              }
            >
              {charCount} / {CONFIG.BODY_MAX} (min {CONFIG.BODY_MIN})
            </span>
          </label>
          <textarea
            id="failure-body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis kegagalan Anda secara jujur di sini. Apa yang terjadi? Berapa kerugiannya? Apa yang Anda pelajari?..."
            className="w-full border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] p-4 text-sm font-mono focus:border-[#3DDC84] focus:outline-none placeholder:text-[#444444] resize-y"
          />
        </div>

        {/* Optional Financial Loss Input */}
        <div className="flex flex-col gap-2">
          <label htmlFor="financial-loss" className="text-xs text-[#7A7A7A] uppercase tracking-wider">
            Kerugian Finansial (Rp) — Opsional
          </label>
          <div className="flex items-center border-2 border-[#E6E6E6] bg-black px-4 py-2 focus-within:border-[#3DDC84]">
            <span className="text-[#7A7A7A] text-sm mr-2">Rp</span>
            <input
              id="financial-loss"
              type="text"
              value={financialLoss}
              onChange={(e) => setFinancialLoss(formatRupiahInput(e.target.value))}
              placeholder="0 (misal: 50.000.000)"
              className="w-full bg-transparent text-[#E6E6E6] text-sm font-mono focus:outline-none"
            />
          </div>
          <span className="text-[10px] text-[#7A7A7A]">
            Masukkan estimasi total kerugian uang bila relevan (hanya angka).
          </span>
        </div>

        {/* Age & Rules Checkbox (§5) */}
        <div className="flex items-start gap-3 border border-[#333333] p-3 bg-[#0A0A0A]">
          <input
            id="age-checkbox"
            type="checkbox"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#3DDC84] bg-black border border-[#E6E6E6] rounded-none cursor-pointer"
          />
          <label htmlFor="age-checkbox" className="text-xs text-[#E6E6E6] cursor-pointer leading-relaxed">
            Saya berusia 18 tahun ke atas dan setuju dengan{' '}
            <span className="underline">Aturan Komunitas</span>, termasuk larangan doxxing,
            pencemaran nama baik, dan data pribadi.
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

        {/* Submit Button */}
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
            disabled={loading || !isBodyValid || !ageOk}
            className={`flex-1 border-2 py-3.5 px-6 font-bold text-xs uppercase tracking-wider transition-colors text-center cursor-pointer ${
              loading || !isBodyValid || !ageOk
                ? 'border-[#444444] bg-[#222222] text-[#666666] cursor-not-allowed'
                : 'border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84]'
            }`}
          >
            {loading ? 'MEMPROSES VERIFIKASI...' : '[ TERBITKAN KEGAGALAN KE VOID ]'}
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
