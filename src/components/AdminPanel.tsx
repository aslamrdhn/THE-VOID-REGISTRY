import { useState, useEffect, useCallback } from 'react';
import {
  handleGetAdminData,
  handleAdminApprove,
  handleAdminRestore,
  handleAdminRemove,
  handleAdminMarkRefunded,
  isAuthorizedAdmin,
} from '@/lib/api/admin.ts';
import { Post, ModerationLog, Order } from '@/lib/types.ts';

interface AdminPanelProps {
  onClose: () => void;
}

type AdminTab = 'pending' | 'quarantine' | 'refunds' | 'logs';

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [adminEmail, setAdminEmail] = useState('admin@thevoidregistry.com');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  const [loading, setLoading] = useState(false);

  // Data state
  const [pendingQueue, setPendingQueue] = useState<Post[]>([]);
  const [quarantineQueue, setQuarantineQueue] = useState<Post[]>([]);
  const [refundOrders, setRefundOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [stats, setStats] = useState<{
    totalPosts: number;
    livePosts: number;
    quarantinedPosts: number;
    removedPosts: number;
    expiredPosts: number;
  }>({
    totalPosts: 0,
    livePosts: 0,
    quarantinedPosts: 0,
    removedPosts: 0,
    expiredPosts: 0,
  });

  // Action dialog states
  const [actionTargetPost, setActionTargetPost] = useState<Post | null>(null);
  const [actionType, setActionType] = useState<'remove' | 'restore' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshData = useCallback(() => {
    if (!adminEmail) return;
    setLoading(true);
    const res = handleGetAdminData(adminEmail);
    if (res.statusCode === 200 && res.data) {
      setPendingQueue(res.data.pendingQueue);
      setQuarantineQueue(res.data.quarantineQueue);
      setRefundOrders(res.data.refundOrders);
      setLogs(res.data.moderationLogs);
      setStats(res.data.totalStats);
    } else {
      setLoginError(res.error || 'Akses ditolak.');
    }
    setLoading(false);
  }, [adminEmail]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, refreshData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!isAuthorizedAdmin(adminEmail)) {
      setLoginError('Email tidak terdaftar di daftar izin ADMIN_EMAILS (unauthorized_admin).');
      return;
    }
    setIsAuthenticated(true);
  };

  const handleApprove = (postId: string) => {
    const res = handleAdminApprove(postId, adminEmail);
    if (res.statusCode === 200) {
      refreshData();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  };

  const handleExecuteModalAction = () => {
    if (!actionTargetPost || !actionType) return;
    if (!actionReason.trim()) {
      setActionError('Alasan tindakan wajib diisi.');
      return;
    }

    if (actionType === 'remove') {
      const res = handleAdminRemove(actionTargetPost.id, adminEmail, actionReason);
      if (res.statusCode === 200) {
        setActionTargetPost(null);
        setActionType(null);
        setActionReason('');
        refreshData();
      } else {
        setActionError(`Error: ${res.error}`);
      }
    } else if (actionType === 'restore') {
      const res = handleAdminRestore(actionTargetPost.id, adminEmail, actionReason);
      if (res.statusCode === 200) {
        setActionTargetPost(null);
        setActionType(null);
        setActionReason('');
        refreshData();
      } else {
        setActionError(`Error: ${res.error}`);
      }
    }
  };

  const handleMarkRefunded = (orderId: string) => {
    const res = handleAdminMarkRefunded(orderId, adminEmail);
    if (res.statusCode === 200) {
      refreshData();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 font-mono">
        <div className="border-2 border-[#E6E6E6] bg-black text-[#E6E6E6] max-w-md w-full p-6 sm:p-8 flex flex-col gap-6">
          <div className="border-b-2 border-[#E6E6E6] pb-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-[#FF1E1E] font-bold">
              [ SECURE ACCESS: PANEL MODERASI ]
            </span>
            <button
              onClick={onClose}
              className="text-xs text-[#7A7A7A] hover:text-[#E6E6E6] cursor-pointer"
            >
              [ TUTUP ]
            </button>
          </div>

          <p className="text-xs text-[#7A7A7A]">
            Hanya email administrator terotorisasi yang dapat mengakses dashboard moderasi The Void
            Registry.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#7A7A7A] uppercase">Email Admin:</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@thevoidregistry.com"
                className="border-2 border-[#E6E6E6] bg-black p-3 text-xs text-[#E6E6E6] focus:border-[#3DDC84] focus:outline-none"
              />
            </div>

            {loginError && (
              <div className="text-xs text-[#FF1E1E] border border-[#FF1E1E] p-2 bg-black">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="border-2 border-[#E6E6E6] bg-[#E6E6E6] text-black hover:bg-black hover:text-[#E6E6E6] py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              [ MASUK KE PANEL ADMIN ]
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto p-4 sm:p-8 font-mono text-[#E6E6E6]">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header bar */}
        <div className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#FF1E1E] animate-pulse"></span>
              <h1 className="text-lg font-black uppercase tracking-wider">
                PANEL MODERASI & KENDALI SISTEM
              </h1>
            </div>
            <div className="text-xs text-[#7A7A7A] mt-1">
              LOGIN: <span className="text-[#3DDC84]">{adminEmail}</span> · STATUS: AKTIF
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={refreshData}
              className="border border-[#7A7A7A] hover:border-[#E6E6E6] py-2 px-3 text-xs uppercase cursor-pointer"
            >
              [ REFRESH ]
            </button>
            <button
              onClick={onClose}
              className="border-2 border-[#FF1E1E] text-[#FF1E1E] hover:bg-[#FF1E1E] hover:text-black py-2 px-4 text-xs font-bold uppercase cursor-pointer transition-colors"
            >
              [ KELUAR ]
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="border border-[#333333] bg-[#0A0A0A] p-3">
            <span className="text-[10px] text-[#7A7A7A] block">TOTAL POSTS</span>
            <span className="text-base font-black text-[#E6E6E6]">{stats.totalPosts}</span>
          </div>
          <div className="border border-[#333333] bg-[#0A0A0A] p-3">
            <span className="text-[10px] text-[#7A7A7A] block">LIVE AKTIF</span>
            <span className="text-base font-black text-[#3DDC84]">{stats.livePosts}</span>
          </div>
          <div className="border border-[#333333] bg-[#0A0A0A] p-3">
            <span className="text-[10px] text-[#7A7A7A] block">DIKARANTINA</span>
            <span className="text-base font-black text-[#FF1E1E]">{stats.quarantinedPosts}</span>
          </div>
          <div className="border border-[#333333] bg-[#0A0A0A] p-3">
            <span className="text-[10px] text-[#7A7A7A] block">DIHAPUS</span>
            <span className="text-base font-black text-[#7A7A7A]">{stats.removedPosts}</span>
          </div>
          <div className="border border-[#333333] bg-[#0A0A0A] p-3">
            <span className="text-[10px] text-[#7A7A7A] block">KEDALUWARSA</span>
            <span className="text-base font-black text-[#7A7A7A]">{stats.expiredPosts}</span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b-2 border-[#E6E6E6] text-xs font-bold uppercase overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-6 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'pending'
                ? 'border-[#3DDC84] text-[#3DDC84] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ ANTRIAN PENINJAUAN ({pendingQueue.length}) ]
          </button>
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`py-3 px-6 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'quarantine'
                ? 'border-[#FF1E1E] text-[#FF1E1E] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ KARANTINA ({quarantineQueue.length}) ]
          </button>
          <button
            onClick={() => setActiveTab('refunds')}
            className={`py-3 px-6 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'refunds'
                ? 'border-[#3DDC84] text-[#3DDC84] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ REFUND ORDERS ({refundOrders.length}) ]
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-6 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'logs'
                ? 'border-[#E6E6E6] text-[#E6E6E6] bg-[#0A0A0A]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#E6E6E6]'
            }`}
          >
            [ LOG AUDIT ({logs.length}) ]
          </button>
        </div>

        {/* Content Tabs */}
        {loading ? (
          <div className="py-12 text-center text-xs text-[#7A7A7A]">MEMUAT DATA MODERASI...</div>
        ) : (
          <div>
            {/* Tab: Pending Review */}
            {activeTab === 'pending' && (
              <div className="flex flex-col gap-4">
                {pendingQueue.length === 0 ? (
                  <div className="border border-[#333333] p-8 text-center text-xs text-[#7A7A7A]">
                    TIDAK ADA TULISAN DALAM ANTRIAN PENINJAUAN.
                  </div>
                ) : (
                  pendingQueue.map((post) => (
                    <div
                      key={post.id}
                      className="border-2 border-[#E6E6E6] bg-[#0A0A0A] p-5 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center text-xs border-b border-[#222222] pb-2">
                        <span className="text-[#FF1E1E] font-bold">
                          [ STATUS: PENDING_REVIEW ]
                        </span>
                        <span className="text-[#7A7A7A]">ID: {post.id}</span>
                      </div>
                      <p className="text-sm text-[#E6E6E6] whitespace-pre-wrap leading-relaxed">
                        {post.body}
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-[#222222]">
                        <span className="text-xs text-[#7A7A7A]">
                          Dibuat: {new Date(post.created_at).toLocaleString('id-ID')}
                        </span>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(post.id)}
                            className="border-2 border-[#3DDC84] bg-[#3DDC84] text-black font-bold py-1.5 px-4 text-xs uppercase cursor-pointer"
                          >
                            [ SETUJUI & PUBLIKASIKAN ]
                          </button>
                          <button
                            onClick={() => {
                              setActionTargetPost(post);
                              setActionType('remove');
                              setActionReason('');
                              setActionError(null);
                            }}
                            className="border-2 border-[#FF1E1E] text-[#FF1E1E] hover:bg-[#FF1E1E] hover:text-black py-1.5 px-3 text-xs uppercase cursor-pointer"
                          >
                            [ TOLAK / HAPUS ]
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Quarantine Queue */}
            {activeTab === 'quarantine' && (
              <div className="flex flex-col gap-4">
                {quarantineQueue.length === 0 ? (
                  <div className="border border-[#333333] p-8 text-center text-xs text-[#7A7A7A]">
                    TIDAK ADA TULISAN DALAM KARANTINA.
                  </div>
                ) : (
                  quarantineQueue.map((post) => (
                    <div
                      key={post.id}
                      className="border-2 border-[#FF1E1E] bg-[#0A0A0A] p-5 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center text-xs border-b border-[#222222] pb-2">
                        <span className="text-[#FF1E1E] font-bold">
                          [ DIKARANTINA KARENA LAPORAN: {post.report_count} ]
                        </span>
                        <span className="text-[#7A7A7A]">ID: {post.id}</span>
                      </div>
                      <p className="text-sm text-[#E6E6E6] whitespace-pre-wrap leading-relaxed">
                        {post.body}
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-[#222222]">
                        <span className="text-xs text-[#7A7A7A]">
                          Kedaluwarsa:{' '}
                          {post.expires_at
                            ? new Date(post.expires_at).toLocaleString('id-ID')
                            : 'N/A'}
                        </span>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setActionTargetPost(post);
                              setActionType('restore');
                              setActionReason('Laporan tidak terbukti melanggar (false positive)');
                              setActionError(null);
                            }}
                            className="border-2 border-[#3DDC84] text-[#3DDC84] hover:bg-[#3DDC84] hover:text-black py-1.5 px-3 text-xs font-bold uppercase cursor-pointer"
                          >
                            [ PULIHKAN KE FEED ]
                          </button>
                          <button
                            onClick={() => {
                              setActionTargetPost(post);
                              setActionType('remove');
                              setActionReason('');
                              setActionError(null);
                            }}
                            className="border-2 border-[#FF1E1E] bg-[#FF1E1E] text-black font-bold py-1.5 px-3 text-xs uppercase cursor-pointer"
                          >
                            [ HAPUS PERMANEN ]
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Refund Orders */}
            {activeTab === 'refunds' && (
              <div className="flex flex-col gap-4">
                {refundOrders.length === 0 ? (
                  <div className="border border-[#333333] p-8 text-center text-xs text-[#7A7A7A]">
                    TIDAK ADA ORDER DENGAN STATUS REFUND_REQUIRED.
                  </div>
                ) : (
                  refundOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border-2 border-[#FF1E1E] bg-[#0A0A0A] p-5 flex flex-col gap-2 text-xs"
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span>ORDER ID: {order.id}</span>
                        <span className="text-[#FF1E1E]">[ REFUND REQUIRED ]</span>
                      </div>
                      <div>NOMINAL: Rp {new Intl.NumberFormat('id-ID').format(order.amount_idr)}</div>
                      <div>POST ID: {order.post_id || 'POST DIHAPUS'}</div>
                      <div className="text-[#7A7A7A]">
                        Tanggal dibuat: {new Date(order.created_at).toLocaleString('id-ID')}
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => handleMarkRefunded(order.id)}
                          className="border border-[#3DDC84] text-[#3DDC84] hover:bg-[#3DDC84] hover:text-black py-1.5 px-3 uppercase cursor-pointer"
                        >
                          [ TANDAI SUDAH DI-REFUND DI DASHBOARD PROVIDER ]
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Moderation Log */}
            {activeTab === 'logs' && (
              <div className="overflow-x-auto border border-[#333333]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#111111] border-b border-[#333333] text-[#7A7A7A]">
                    <tr>
                      <th className="p-3">WAKTU</th>
                      <th className="p-3">ACTOR</th>
                      <th className="p-3">AKSI</th>
                      <th className="p-3">TRANSISI</th>
                      <th className="p-3">ALASAN</th>
                      <th className="p-3">POST ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#0F0F0F]">
                        <td className="p-3 text-[#7A7A7A]">
                          {new Date(log.created_at).toLocaleTimeString('id-ID')}
                        </td>
                        <td className="p-3 font-bold text-[#E6E6E6]">{log.actor}</td>
                        <td className="p-3 text-[#3DDC84]">{log.action}</td>
                        <td className="p-3 text-[#7A7A7A]">
                          {log.from_status || '—'} &rarr; {log.to_status || '—'}
                        </td>
                        <td className="p-3 text-[#E6E6E6]">{log.reason || '—'}</td>
                        <td className="p-3 text-[#7A7A7A]">
                          {log.post_id ? log.post_id.slice(0, 8) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Reason Confirmation Modal */}
      {actionTargetPost && actionType && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="border-2 border-[#E6E6E6] bg-black p-6 max-w-md w-full flex flex-col gap-4 font-mono text-xs">
            <div className="font-bold uppercase text-[#FF1E1E]">
              KONFIRMASI TINDAKAN: {actionType === 'remove' ? 'HAPUS TULISAN' : 'PULIHKAN TULISAN'}
            </div>
            <p className="text-[#7A7A7A]">
              Tindakan ini akan dicatat ke dalam log audit permanen. Berikan alasan resmi.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-[#7A7A7A]">Alasan Wajib:</label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Tulis alasan moderasi..."
                className="border border-[#7A7A7A] bg-black p-2 text-[#E6E6E6] focus:border-[#E6E6E6] focus:outline-none"
              />
            </div>

            {actionError && <div className="text-[#FF1E1E] font-bold">{actionError}</div>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setActionTargetPost(null);
                  setActionType(null);
                }}
                className="border border-[#7A7A7A] py-2 px-4 text-[#7A7A7A] hover:text-[#E6E6E6] uppercase cursor-pointer"
              >
                BATAL
              </button>
              <button
                onClick={handleExecuteModalAction}
                className="flex-1 border-2 border-[#FF1E1E] bg-[#FF1E1E] text-black font-bold py-2 px-4 uppercase cursor-pointer"
              >
                [ KONFIRMASI EKSEKUSI ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
