import { useState, useEffect } from 'react';
import { CONFIG } from '@/lib/config.ts';
import { getClaimTokenForPost } from '../api/client.ts';
import {
  handleCreateCheckout,
  handleGetOrderStatus,
  handleProcessWebhook,
  CheckoutResult,
} from '@/lib/api/checkout.ts';
import { defaultPaymentProvider } from '@/lib/payments/provider.ts';

interface ImmortalizeModalProps {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImmortalizeModal({ postId, onClose, onSuccess }: ImmortalizeModalProps) {
  const savedToken = getClaimTokenForPost(postId);
  const [claimCode, setClaimCode] = useState(savedToken || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkoutData, setCheckoutData] = useState<CheckoutResult['data'] | null>(null);
  const [orderStatus, setOrderStatus] = useState<'pending' | 'paid' | 'expired' | 'refund_required'>(
    'pending'
  );
  const [simulating, setSimulating] = useState(false);

  // Polling order status every 3 seconds while pending
  useEffect(() => {
    if (!checkoutData || orderStatus === 'paid') return;

    const interval = setInterval(() => {
      const res = handleGetOrderStatus(checkoutData.order_id);
      if (res.data?.status === 'paid') {
        setOrderStatus('paid');
        clearInterval(interval);
        setTimeout(() => {
          onSuccess();
        }, 3000);
      } else if (res.data?.status === 'refund_required') {
        setOrderStatus('refund_required');
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [checkoutData, orderStatus, onSuccess]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) {
      setError('Kode klaim kepemilikan tulisan wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await handleCreateCheckout(postId, claimCode.trim());
      if (res.statusCode === 201 || res.statusCode === 200) {
        setCheckoutData(res.data);
      } else if (res.statusCode === 403) {
        setError('Kode klaim salah. Hanya penulis asli yang dapat menyelamatkan tulisan ini.');
      } else if (res.statusCode === 409) {
        setError(res.error || 'Syarat Immortalize belum terpenuhi (Respect < 10 atau sisa waktu > 6 jam).');
      } else {
        setError(res.error || 'Gagal membuat pesanan QRIS.');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan sistem pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!checkoutData) return;
    setSimulating(true);
    try {
      // Trigger sandbox payment
      defaultPaymentProvider.simulatePayment(checkoutData.provider_ref);

      // Trigger webhook
      const webhookPayload = JSON.stringify({
        event_id: `sim_${Date.now()}`,
        provider_ref: checkoutData.provider_ref,
      });

      await handleProcessWebhook(webhookPayload, {});
      setOrderStatus('paid');
      setTimeout(() => {
        onSuccess();
      }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 font-mono text-[#E6E6E6]">
      <div className="border-2 border-[#3DDC84] bg-black max-w-lg w-full p-6 sm:p-8 flex flex-col gap-6">
        {/* Top Header */}
        <div className="border-b-2 border-[#3DDC84] pb-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#3DDC84] animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-widest text-[#3DDC84]">
              IMMORTALIZE PROTOCOL // SELAMATKAN ARSIP
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-[#7A7A7A] hover:text-[#E6E6E6] cursor-pointer uppercase"
          >
            [ TUTUP ]
          </button>
        </div>

        {orderStatus === 'paid' ? (
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <span className="text-4xl text-[#3DDC84]">★ 🏛️ ★</span>
            <h2 className="text-xl font-black text-[#3DDC84] uppercase">
              ARSIP BERHASIL DISELAMATKAN!
            </h2>
            <p className="text-xs text-[#E6E6E6] leading-relaxed max-w-sm">
              Tulisan ini kini berstatus <strong className="text-[#3DDC84]">ABADI</strong> dan telah
              diabadikan secara permanen di tab Hall of Fame. Hitung mundur kehancuran telah
              dihentikan selamanya.
            </p>
            <div className="text-[11px] text-[#7A7A7A] mt-2 animate-pulse">
              Mengalihkan kembali ke Observatory...
            </div>
          </div>
        ) : !checkoutData ? (
          <form onSubmit={handleCreateOrder} className="flex flex-col gap-5">
            <div className="text-sm font-bold text-[#E6E6E6]">
              SELAMATKAN TULISAN INI DARI KEHANCURAN 24 JAM
            </div>

            <p className="text-xs text-[#7A7A7A] leading-relaxed">
              Arsip yang terbukti diapresiasi oleh komunitas dapat diabadikan secara permanen ke{' '}
              <span className="text-[#3DDC84] font-bold">Hall of Fame</span> menggunakan pembayaran
              QRIS resmi.
            </p>

            {/* Pricing badge */}
            <div className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[#7A7A7A] block uppercase">BIAYA TETAP</span>
                <span className="text-lg font-black text-[#3DDC84]">
                  Rp {formatRupiah(CONFIG.IMMORTALIZE_PRICE_IDR)}
                </span>
              </div>
              <span className="text-xs text-[#7A7A7A] border border-[#333333] px-2 py-1">
                QRIS NASIONAL
              </span>
            </div>

            {/* Claim Code Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#7A7A7A] uppercase">
                Kode Klaim Penulis (VOID-XXXX...):
              </label>
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value)}
                placeholder="VOID-XXXX-XXXX-XXXX-XXXX"
                className="border-2 border-[#E6E6E6] bg-black p-3 text-xs text-[#E6E6E6] font-mono uppercase focus:border-[#3DDC84] focus:outline-none"
              />
              <span className="text-[10px] text-[#7A7A7A]">
                {savedToken
                  ? '✓ Kode klaim Anda otomatis terisi dari penyimpanan perangkat ini.'
                  : 'Hanya pemilik tulisan dengan token sah yang dapat membeli status abadi.'}
              </span>
            </div>

            {/* Mandatory Policy Clause (§9) */}
            <div className="border-l-2 border-[#FF1E1E] pl-3 text-[11px] text-[#7A7A7A] leading-relaxed">
              <strong className="text-[#FF1E1E]">KETENTUAN HUKUM:</strong> &quot;Tulisan abadi tetap
              tunduk pada Aturan Komunitas. Jika di kemudian hari dihapus karena melanggar aturan,
              tidak ada pengembalian dana.&quot;
            </div>

            {error && (
              <div className="border border-[#FF1E1E] p-2 text-xs text-[#FF1E1E] bg-[#FF1E1E]/5">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="border border-[#7A7A7A] text-[#7A7A7A] hover:text-[#E6E6E6] py-3 px-4 text-xs uppercase cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 border-2 border-[#3DDC84] bg-[#3DDC84] text-black hover:bg-black hover:text-[#3DDC84] font-black py-3 px-4 text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                {loading
                  ? 'MEMBUAT QRIS...'
                  : `[ LANJUTKAN PEMBAYARAN: Rp ${formatRupiah(CONFIG.IMMORTALIZE_PRICE_IDR)} ]`}
              </button>
            </div>
          </form>
        ) : (
          /* Payment Screen with QR Code */
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="text-xs text-[#7A7A7A] uppercase">
              SCAN KODE QRIS DENGAN APLIKASI BANK ATAU E-WALLET ANDA
            </div>

            {/* QR Mock Display */}
            <div className="border-4 border-[#E6E6E6] bg-white p-4 w-52 h-52 flex flex-col items-center justify-center relative">
              {/* SVG QR Code Pattern */}
              <svg viewBox="0 0 100 100" className="w-full h-full text-black fill-current">
                <rect x="5" y="5" width="25" height="25" />
                <rect x="10" y="10" width="15" height="15" fill="white" />
                <rect x="13" y="13" width="9" height="9" />
                <rect x="70" y="5" width="25" height="25" />
                <rect x="75" y="10" width="15" height="15" fill="white" />
                <rect x="78" y="78" width="9" height="9" />
                <rect x="5" y="70" width="25" height="25" />
                <rect x="10" y="75" width="15" height="15" fill="white" />
                <rect x="13" y="78" width="9" height="9" />
                <rect x="40" y="10" width="10" height="20" />
                <rect x="55" y="25" width="10" height="15" />
                <rect x="35" y="45" width="30" height="10" />
                <rect x="45" y="65" width="15" height="20" />
                <rect x="70" y="40" width="20" height="15" />
                <rect x="15" y="40" width="15" height="10" />
                <rect x="70" y="70" width="20" height="20" />
              </svg>
            </div>

            <div className="text-xs text-[#3DDC84] font-black uppercase tracking-wider">
              TOTAL: Rp {formatRupiah(checkoutData.amount_idr)}
            </div>

            <div className="text-[11px] text-[#7A7A7A] flex items-center gap-2">
              <span className="w-2 h-2 bg-[#3DDC84] animate-ping"></span>
              Menunggu pembayaran... (Polling status aktif setiap 3 detik)
            </div>

            {/* Sandbox Simulation Button */}
            <div className="w-full border-t border-[#333333] pt-4 flex flex-col gap-2">
              <span className="text-[10px] text-[#7A7A7A] uppercase">
                [ DEMO MODE: UJI PEMBAYARAN LANGSUNG ]
              </span>
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={simulating}
                className="w-full border-2 border-[#3DDC84] bg-black text-[#3DDC84] hover:bg-[#3DDC84] hover:text-black py-2 px-3 text-xs font-bold uppercase cursor-pointer transition-colors"
              >
                {simulating ? 'MEMPROSES VERIFIKASI...' : '✓ SIMULASIKAN PEMBAYARAN QRIS SUKSES'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
