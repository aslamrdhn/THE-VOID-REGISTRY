interface AgeGateModalProps {
  onAccept: () => void;
}

export default function AgeGateModal({ onAccept }: AgeGateModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <div className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] max-w-md w-full p-6 sm:p-8 flex flex-col gap-6 font-mono">
        <div className="border-b-2 border-[#E6E6E6] pb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-[#FF1E1E] font-bold">
            [ ! ] GERBANG USIA (18+)
          </span>
          <span className="text-xs text-[#7A7A7A]">VERIFIKASI AWAL</span>
        </div>

        <div className="text-sm leading-relaxed text-[#E6E6E6]">
          THE VOID REGISTRY adalah ruang bawah tanah digital yang memuat arsip kegagalan nyata,
          kerugian finansial, dan pengakuan tanpa sensor.
        </div>

        <div className="border-l-2 border-[#FF1E1E] pl-3 text-xs text-[#7A7A7A] leading-relaxed">
          Konten dapat memicu ketidaknyamanan mental. Anda harus berusia minimal 18 tahun dan
          menyetujui aturan komunitas untuk melanjutkan.
        </div>

        <button
          onClick={onAccept}
          className="w-full border-2 border-[#E6E6E6] bg-[#E6E6E6] text-black hover:bg-black hover:text-[#E6E6E6] py-3.5 px-4 font-black text-xs uppercase tracking-widest transition-colors cursor-pointer text-center"
        >
          [ SAYA BERUSIA 18+ — MASUK ARSIP ]
        </button>
      </div>
    </div>
  );
}
