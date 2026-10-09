import { useState } from 'react';
import { handleCreateReport } from '@/lib/api/admin.ts';
import { getOrCreateClientAnonId } from '../api/client.ts';
import { ReportReason } from '@/lib/types.ts';

interface ReportModalProps {
  postId: string;
  onClose: () => void;
  onReported?: () => void;
}

const REPORT_REASONS: { key: ReportReason; label: string; desc: string; severe?: boolean }[] = [
  {
    key: 'personal_data',
    label: 'DATA PRIBADI (DOXXING)',
    desc: 'Menyebutkan nomor telepon, alamat, KTP, atau identitas pribadi tanpa izin.',
    severe: true,
  },
  {
    key: 'defamation',
    label: 'PENCEMARAN NAMA BAIK',
    desc: 'Menyebutkan nama asli orang atau perusahaan dengan tuduhan tanpa bukti.',
  },
  {
    key: 'threat_or_selfharm',
    label: 'ANCAMAN / MENYAKITI DIRI',
    desc: 'Ancaman kekerasan terhadap pihak lain atau indikasi tindakan menyakiti diri.',
    severe: true,
  },
  {
    key: 'minor',
    label: 'EKSPLOITASI ANAK',
    desc: 'Konten melibatkan atau merugikan anak di bawah umur.',
    severe: true,
  },
  {
    key: 'spam',
    label: 'SPAM / IKLAN',
    desc: 'Promosi komersial, jualan, atau teks berulang tanpa isi kegagalan asli.',
  },
  {
    key: 'other',
    label: 'LAINNYA',
    desc: 'Pelanggaran lain terhadap aturan komunitas The Void Registry.',
  },
];

export default function ReportModal({ postId, onClose, onReported }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('personal_data');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const anonId = getOrCreateClientAnonId();
    const res = handleCreateReport(postId, { reason: selectedReason }, anonId);

    if (res.statusCode === 200) {
      if (res.data?.quarantined) {
        setSuccess('Laporan dicatat. Ambang batas tercapai: Tulisan ini telah otomatis dikarantina.');
      } else if (res.data?.already) {
        setSuccess('Anda sudah pernah melaporkan tulisan ini sebelumnya.');
      } else {
        setSuccess('Laporan Anda telah dicatat ke dalam sistem audit antrean moderasi.');
      }
      setTimeout(() => {
        onReported?.();
        onClose();
      }, 2000);
    } else if (res.statusCode === 429) {
      setError('Batas pelaporan tercapai (maksimal 10 laporan per jam).');
    } else {
      setError(res.error || 'Gagal mengirimkan laporan.');
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <div className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] max-w-lg w-full p-6 sm:p-8 flex flex-col gap-6 font-mono">
        <div className="border-b-2 border-[#E6E6E6] pb-3 flex justify-between items-center">
          <span className="text-xs uppercase tracking-widest text-[#FF1E1E] font-bold">
            [ ! ] LAPORKAN TULISAN
          </span>
          <span className="text-xs text-[#7A7A7A]">ID: {postId.slice(0, 8)}</span>
        </div>

        {success ? (
          <div className="border-2 border-[#3DDC84] bg-[#0A0A0A] p-6 text-center text-xs">
            <span className="text-[#3DDC84] font-bold block mb-2 text-sm">
              ✓ LAPORAN DITERIMA
            </span>
            <p className="text-[#E6E6E6] leading-relaxed">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-xs text-[#7A7A7A]">
              Pilih alasan pelanggaran. Laporan berat (data pribadi, ancaman) langsung mengkarantina
              tulisan seketika.
            </p>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.key}
                  className={`border p-3 cursor-pointer flex flex-col gap-1 transition-colors ${
                    selectedReason === r.key
                      ? 'border-[#FF1E1E] bg-[#FF1E1E]/10 text-white'
                      : 'border-[#333333] hover:border-[#7A7A7A] text-[#7A7A7A]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.key}
                      checked={selectedReason === r.key}
                      onChange={() => setSelectedReason(r.key)}
                      className="accent-[#FF1E1E]"
                    />
                    <span className="font-bold text-xs uppercase tracking-wider text-[#E6E6E6]">
                      {r.label}
                    </span>
                    {r.severe && (
                      <span className="text-[10px] text-[#FF1E1E] border border-[#FF1E1E]/50 px-1">
                        INSTANT QUARANTINE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] pl-5 text-[#888888] leading-tight">{r.desc}</p>
                </label>
              ))}
            </div>

            {error && (
              <div className="text-xs text-[#FF1E1E] border border-[#FF1E1E] p-2 bg-black">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="border-2 border-[#7A7A7A] text-[#7A7A7A] hover:border-[#E6E6E6] hover:text-[#E6E6E6] py-3 px-6 text-xs uppercase tracking-wider cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 border-2 border-[#FF1E1E] bg-[#FF1E1E] text-black hover:bg-black hover:text-[#FF1E1E] py-3 px-6 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {submitting ? 'MEMPROSES...' : '[ KIRIM LAPORAN PELANGGARAN ]'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
