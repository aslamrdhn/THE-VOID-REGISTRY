import { useState } from 'react';
import { saveClaimTokenToStorage } from '../api/client.ts';

interface ClaimCodeModalProps {
  postId: string;
  claimCode: string;
  status: 'live' | 'pending_review';
  expiresAt: string | null;
  crisisInfo?: string;
  onClose: () => void;
}

export default function ClaimCodeModal({
  postId,
  claimCode,
  status,
  expiresAt,
  crisisInfo,
  onClose,
}: ClaimCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(claimCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveLocally = () => {
    saveClaimTokenToStorage(postId, claimCode);
    setSavedLocally(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <div className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] max-w-lg w-full p-6 sm:p-8 flex flex-col gap-6 font-mono">
        {/* Header */}
        <div className="border-b-2 border-[#E6E6E6] pb-3 flex justify-between items-center">
          <span className="text-xs uppercase tracking-widest text-[#3DDC84]">
            [ PROTOKOL_PENERBITAN: SUKSES ]
          </span>
          <span className="text-xs text-[#7A7A7A]">ID: {postId.slice(0, 8)}</span>
        </div>

        {/* Crisis Warning Banner if triggered */}
        {crisisInfo && (
          <div className="border-2 border-[#FF1E1E] bg-black p-4 text-xs text-[#FF1E1E]">
            <div className="font-bold mb-1 uppercase tracking-wider">
              [ ! ] INFORMASI BANTUAN KRISIS
            </div>
            <p className="text-[#E6E6E6] leading-relaxed">{crisisInfo}</p>
          </div>
        )}

        {/* Status explanation */}
        <div>
          {status === 'live' ? (
            <div className="text-sm">
              <span className="text-[#3DDC84] font-bold">TULISAN TERBIT.</span> Tulisan akan
              otomatis musnah dalam 24 jam kecuali di-Immortalize.
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-[#FF1E1E] font-bold">MENUNGGU PEMERIKSAAN.</span> Tulisan Anda
              terdeteksi mengandung kata kunci sensitif dan sedang ditinjau sebelum tayang publik.
            </div>
          )}
        </div>

        {/* Claim Code Section */}
        <div className="border border-[#7A7A7A] bg-[#0A0A0A] p-4 flex flex-col items-center gap-3">
          <span className="text-[11px] text-[#7A7A7A] uppercase tracking-wider">
            KODE KLAIM TULISAN ANDA (HANYA DITAMPILKAN SEKALI)
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#3DDC84] tracking-wider select-all break-all text-center">
            {claimCode}
          </div>
          <button
            onClick={handleCopy}
            className="w-full border-2 border-[#3DDC84] bg-black text-[#3DDC84] hover:bg-[#3DDC84] hover:text-black py-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            {copied ? '✓ TERSALIN KE CLIPBOARD' : '[ SALIN KODE KLAIM ]'}
          </button>
        </div>

        {/* Warning text */}
        <div className="border-l-2 border-[#FF1E1E] pl-3 text-xs text-[#7A7A7A]">
          <span className="text-[#FF1E1E] font-bold block uppercase mb-1">
            PERINGATAN KERAS:
          </span>
          Sistem kami anonim dan tidak menyimpan identitas Anda. Hanya kode di atas yang menjadi
          bukti kepemilikan. Jika kode hilang, Anda tidak dapat menghapus atau menyelamatkan tulisan
          ini.
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          {!savedLocally ? (
            <button
              onClick={handleSaveLocally}
              className="border border-[#7A7A7A] bg-black text-xs text-[#E6E6E6] hover:border-[#E6E6E6] py-2 px-3 tracking-wider uppercase cursor-pointer"
            >
              [ SIMPAN TOKEN DI PERANGKAT INI ]
            </button>
          ) : (
            <div className="text-center text-xs text-[#3DDC84] py-2 border border-[#3DDC84]/50">
              ✓ TOKEN TERSIMPAN DI PERANGKAT INI
            </div>
          )}

          <button
            onClick={onClose}
            className="border-2 border-[#E6E6E6] bg-[#E6E6E6] text-black hover:bg-black hover:text-[#E6E6E6] py-3 px-4 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            [ KEMBALI KE OBSERVATORY ]
          </button>
        </div>
      </div>
    </div>
  );
}
