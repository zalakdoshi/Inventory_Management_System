import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../../api/axios';
import StatusBadge from '../../components/ui/StatusBadge';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchPurchases = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchases', { params: { page, limit: 15, search } });
      setPurchases(data.data); setPagination(data.pagination);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPurchases(1); }, [search]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this purchase? Inventory will be adjusted.')) return;
    try { await api.delete(`/purchases/${id}`); toast.success('Purchase deleted. Inventory adjusted.'); fetchPurchases(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed.'); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">Purchase History</h1><p className="page-subtitle">All your purchase orders</p></div>

      <div className="card p-4">
        <SearchInput placeholder="Search by PO ID..." value={search} onChange={setSearch} className="max-w-sm" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{['PO ID', 'Employee', 'Purchaser Name', 'Items', 'Subtotal', 'Tax', 'Total', 'Status', 'Date', 'Actions'].map(h => <th key={h} className="table-th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse">{Array(10).fill(0).map((_, j) => <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded" /></td>)}</tr>) :
                purchases.length === 0 ? (
                  <tr><td colSpan={10} className="table-td text-center text-gray-400 py-8">No purchases found</td></tr>
                ) :
                purchases.map(p => (
                  <tr key={p._id} className="table-row">
                    <td className="table-td font-mono text-xs text-primary-700 font-semibold">{p.purchaseId}</td>
                    <td className="table-td">
                      <p className="text-sm font-medium text-gray-900">{p.purchasedBy?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{p.purchasedBy?.role || ''}</p>
                    </td>
                    <td className="table-td text-sm">{p.supplierName || p.supplier?.name || '—'}</td>
                    <td className="table-td text-sm">{p.items?.length}</td>
                    <td className="table-td text-sm">₹{p.subtotal?.toLocaleString('en-IN')}</td>
                    <td className="table-td text-sm text-orange-600">₹{p.taxAmount?.toLocaleString('en-IN')}</td>
                    <td className="table-td font-bold text-primary-700">₹{p.totalAmount?.toLocaleString('en-IN')}</td>
                    <td className="table-td"><StatusBadge status={p.status} /></td>
                    <td className="table-td text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="table-td">
                      <button onClick={() => handleDelete(p._id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-50">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(pg => (
              <button
                key={pg}
                onClick={() => fetchPurchases(pg)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${pg === pagination.page ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                {pg}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
