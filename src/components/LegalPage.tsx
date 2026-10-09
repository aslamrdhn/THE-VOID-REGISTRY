interface LegalPageProps {
  initialTab?: 'rules' | 'terms' | 'privacy';
  onClose: () => void;
}

import { useState } from 'react';

export default function LegalPage({ initialTab = 'rules', onClose }: LegalPageProps) {
  const [tab, setTab] = useState<'rules' | 'terms' | 'privacy'>(initialTab);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto p-4 sm:p-8 font-mono text-[#E6E6E6]">
      <div className="max-w-3xl mx-auto flex flex-col gap-6 bg-black border-2 border-[#E6E6E6] p-6 sm:p-10">
        {/* Top bar */}
        <div className="border-b-2 border-[#E6E6E6] pb-4 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#3DDC84]">
            [ DOKUMEN HUKUM & KEBIJAKAN RESMI ]
          </span>
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-wider text-[#7A7A7A] hover:text-[#E6E6E6] cursor-pointer"
          >
            [ &times; TUTUP ]
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#333333] text-xs font-bold uppercase gap-2">
          <button
            onClick={() => setTab('rules')}
            className={`py-2 px-4 cursor-pointer border-b-2 -mb-[1px] ${
              tab === 'rules'
                ? 'border-[#3DDC84] text-[#3DDC84]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ ATURAN KOMUNITAS ]
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`py-2 px-4 cursor-pointer border-b-2 -mb-[1px] ${
              tab === 'terms'
                ? 'border-[#3DDC84] text-[#3DDC84]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ SYARAT & KETENTUAN ]
          </button>
          <button
            onClick={() => setTab('privacy')}
            className={`py-2 px-4 cursor-pointer border-b-2 -mb-[1px] ${
              tab === 'privacy'
                ? 'border-[#3DDC84] text-[#3DDC84]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ KEBIJAKAN PRIVASI ]
          </button>
        </div>

        {/* Tab Content: ATURAN */}
        {tab === 'rules' && (
          <div className="flex flex-col gap-4 text-xs leading-relaxed text-[#CCCCCC]">
            <h2 className="text-base font-black text-[#E6E6E6] uppercase">
              ATURAN PENULISAN THE VOID REGISTRY
            </h2>
            <div className="border border-[#FF1E1E] p-3 text-[#FF1E1E] bg-[#FF1E1E]/5">
              [REVIEW HUKUM / KEBIJAKAN OPERASIONAL] · Seluruh kiriman wajib mematuhi ketentuan UU
              ITE dan larangan penyebaran data pribadi.
            </div>

            <ol className="list-decimal list-inside space-y-3">
              <li>
                <strong className="text-white">LARANGAN MUTLAK DATA PRIBADI (DOXXING):</strong> Dilarang
                mencantumkan nama lengkap orang nyata, nomor telepon, alamat rumah/kantor, NIK/KTP,
                nomor rekening, atau tautan media sosial pihak lain.
              </li>
              <li>
                <strong className="text-white">LARANGAN MENUDUH PIHAK NYATA:</strong> Jika menceritakan
                kegagalan kerja sama, bisnis, atau hubungan kerja, samarkan nama perusahaan dan orang
                yang terlibat. Platform ini adalah arsip pembelajaran kegagalan diri sendiri, bukan
                wadah penyerangan massa.
              </li>
              <li>
                <strong className="text-white">LARANGAN KONTEN MINOR:</strong> Dilarang keras memuat
                tulisan yang melibatkan eksploitasi, pelecehan, atau bahaya bagi anak di bawah umur.
              </li>
              <li>
                <strong className="text-white">LARANGAN ANCAMAN & TINDAKAN MENYAKITI DIRI:</strong> Dilarang
                menulis ancaman teror, pembunuhan, atau ajakan mencelakai diri sendiri maupun orang lain.
              </li>
              <li>
                <strong className="text-white">PROSEDUR TAKEDOWN & PENURUNAN KONTEN:</strong> Jika Anda
                menemukan tulisan yang merugikan Anda atau melanggar hukum, gunakan tombol{' '}
                <span className="text-[#FF1E1E]">LAPORKAN</span> atau hubungi email takedown resmi kami
                di: <span className="text-[#3DDC84]">takedown@thevoidregistry.com</span> (target respons
                maksimal 24 jam).
              </li>
            </ol>
          </div>
        )}

        {/* Tab Content: SYARAT */}
        {tab === 'terms' && (
          <div className="flex flex-col gap-4 text-xs leading-relaxed text-[#CCCCCC]">
            <h2 className="text-base font-black text-[#E6E6E6] uppercase">SYARAT & KETENTUAN PENGGUNAAN</h2>
            <div className="border border-[#FF1E1E] p-3 text-[#FF1E1E] bg-[#FF1E1E]/5">
              [REVIEW HUKUM] · Klausul pelepasan tanggung jawab dan kebijakan pembayaran.
            </div>

            <ul className="list-disc list-inside space-y-3">
              <li>
                <strong className="text-white">SIFAT PLATFORM ANONIM:</strong> Layanan ini disediakan tanpa
                pendaftaran akun. Penulis bertanggung jawab penuh atas kebenaran narasi kegagalan
                yang dituliskan.
              </li>
              <li>
                <strong className="text-white">SIKLUS HIDUP 24 JAM:</strong> Setiap tulisan secara bawaan
                akan musnah secara teknis setelah 24 jam sejak diterbitkan publik.
              </li>
              <li>
                <strong className="text-white">KEBIJAKAN FITUR IMMORTALIZE (PENYELAMATAN ARSIP):</strong>
                Biaya Immortalize adalah Rp 20.000 via QRIS. Tulisan yang diselamatkan menjadi abadi
                tetap tunduk sepenuhnya pada Aturan Komunitas. Jika tulisan di kemudian hari terbukti
                melanggar hukum atau aturan dan dihapus oleh administrator,{' '}
                <span className="text-[#FF1E1E] font-bold">
                  TIDAK ADA PENGEMBALIAN DANA (NO REFUND)
                </span>
                .
              </li>
              <li>
                <strong className="text-white">HAK HAPUS MANDIRI:</strong> Penulis dapat menghapus tulisannya
                kapan saja menggunakan Claim Token unik yang diberikan saat awal penerbitan.
              </li>
            </ul>
          </div>
        )}

        {/* Tab Content: PRIVASI */}
        {tab === 'privacy' && (
          <div className="flex flex-col gap-4 text-xs leading-relaxed text-[#CCCCCC]">
            <h2 className="text-base font-black text-[#E6E6E6] uppercase">
              KEBIJAKAN PRIVASI & RETENSI DATA
            </h2>
            <div className="border border-[#FF1E1E] p-3 text-[#FF1E1E] bg-[#FF1E1E]/5">
              [REVIEW HUKUM] · Transparansi anonimitas jujur sesuai UU Pelindungan Data Pribadi (UU PDP).
            </div>

            <p>
              Kami mengusung prinsip <em>Honest Anonymity</em>. Kami tidak pernah meminta nama, email,
              nomor HP, atau kata sandi Anda.
            </p>

            <ul className="list-disc list-inside space-y-3">
              <li>
                <strong className="text-white">YANG KAMI SIMPAN:</strong> Hanya teks kegagalan, nominal
                kerugian opsional, hash kriptografi SHA-256 dari kode klaim Anda, dan hash anon_id
                (HMAC-SHA256) untuk mencegah bot reaksi Respect. Kami TIDAK menyimpan alamat IP mentah
                di database.
              </li>
              <li>
                <strong className="text-white">KEBIJAKAN RETENSI FISIK:</strong>
                <ul className="list-circle list-inside pl-4 mt-1 space-y-1 text-[#888888]">
                  <li>Tulisan kadaluwarsa (expired): Dihapus secara fisik dari server setelah 7 hari.</li>
                  <li>
                    Tulisan dihapus/takedown: Disimpan maksimal 30 hari untuk keperluan bukti kepatuhan
                    hukum, lalu dihapus fisik.
                  </li>
                  <li>
                    Log moderasi audit: Disimpan tanpa isi tulisan selama maksimal 12 bulan.
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-white">DATA PEMBAYARAN:</strong> Transaksi QRIS diproses langsung oleh
                penyedia berizin (Midtrans/Xendit) sesuai regulasi Bank Indonesia.
              </li>
            </ul>
          </div>
        )}

        <div className="pt-4 border-t border-[#333333] flex justify-end">
          <button
            onClick={onClose}
            className="border-2 border-[#E6E6E6] bg-[#E6E6E6] text-black hover:bg-black hover:text-[#E6E6E6] py-2.5 px-6 font-bold text-xs uppercase cursor-pointer"
          >
            [ MENGERTI & TUTUP ]
          </button>
        </div>
      </div>
    </div>
  );
}
