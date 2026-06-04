import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import toast from 'react-hot-toast';

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', gstin: '', address: { street: '', city: '', state: 'Gujarat', pincode: '' }, notes: '' };

export default function SuppliersPage({ readOnly }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // Expandable Purchaser purchases & tracking state
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleToggleExpand = async (supplierId) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
      setSupplierPurchases([]);
      return;
    }
    setExpandedSupplier(supplierId);
    setLoadingPurchases(true);
    setSupplierPurchases([]);
    try {
      const { data } = await api.get('/purchases', { params: { supplier: supplierId, limit: 10 } });
      setSupplierPurchases(data.data || []);
    } catch (err) {
      toast.error('Failed to load purchase history.');
    }
    setLoadingPurchases(false);
  };

  const openCreate = () => { setEditSupplier(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s) => { setEditSupplier(s); setForm({ name: s.name, contactPerson: s.contactPerson || '', phone: s.phone || '', email: s.email || '', gstin: s.gstin || '', address: s.address || EMPTY.address, notes: s.notes || '' }); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editSupplier) { await api.put(`/suppliers/${editSupplier._id}`, form); toast.success('Purchaser updated!'); }
      else { await api.post('/suppliers', form); toast.success('Purchaser created!'); }
      setModalOpen(false); fetchSuppliers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete purchaser?')) return;
    try { await api.delete(`/suppliers/${id}`); toast.success('Deleted.'); fetchSuppliers(); }
    catch { toast.error('Delete failed.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="page-title">Purchasers</h1><p className="page-subtitle">{suppliers.length} purchasers</p></div>
        {!readOnly && <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Purchaser</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="card p-5 animate-pulse space-y-3"><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>) :
          suppliers.map(s => {
            const isExpanded = expandedSupplier === s._id;
            return (
              <div key={s._id} className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{s.name}</h3>
                      {s.contactPerson && <p className="text-xs text-gray-400 font-medium">Contact: {s.contactPerson}</p>}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                    {s.phone && <p className="flex items-center gap-1.5">📞 {s.phone}</p>}
                    {s.email && <p className="flex items-center gap-1.5">✉️ {s.email}</p>}
                    {s.gstin && <p className="font-mono text-xs flex items-center gap-1.5">🏷️ {s.gstin}</p>}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mt-auto">
                  <button
                    onClick={() => handleToggleExpand(s._id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Purchases & Tracking' : 'View Purchases & Tracking'}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Purchase Orders</h4>
                      {loadingPurchases ? (
                        <div className="space-y-2 py-2">
                          <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                          <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                        </div>
                      ) : supplierPurchases.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center py-4">No purchases from this purchaser.</p>
                      ) : (
                        supplierPurchases.map(p => (
                          <div key={p._id} className="flex flex-col gap-1.5 p-2.5 bg-gray-50 rounded-xl text-xs border border-gray-100">
                            <div className="flex justify-between items-center">
                              <span className="font-mono font-bold text-primary-700">{p.purchaseId}</span>
                              <StatusBadge status={p.status} size="xs" />
                            </div>
                            <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                              <span>₹{p.totalAmount?.toLocaleString('en-IN')} ({p.items?.length} items)</span>
                              <span>{new Date(p.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                            {/* Simple progress tracking timeline for purchases */}
                            <div className="flex items-center gap-2 mt-1.5 bg-white p-1.5 rounded-lg border border-gray-200 justify-around">
                              {['ordered', 'received'].map((st) => {
                                const isDone = st === 'received' ? p.status === 'received' : ['ordered', 'received'].includes(p.status);
                                return (
                                  <div key={st} className="flex items-center gap-1">
                                    <div className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors ${isDone ? 'bg-green-500' : 'bg-gray-200'}`}>
                                      {isDone && <div className="w-1.5 h-1.5 bg-white rounded-full animate-scale" />}
                                    </div>
                                    <span className={`text-[10px] capitalize font-semibold ${isDone ? 'text-gray-700' : 'text-gray-400'}`}>{st}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editSupplier ? 'Edit Purchaser' : 'Add Purchaser'} size="lg"
        footer={<><button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button form="sup-form" type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : 'Save'}</button></>}>
        <form id="sup-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 form-group"><label className="label">Company Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label className="label">Contact Person</label><input className="input-field" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} /></div>
          <div className="form-group"><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          <div className="form-group"><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          <div className="form-group"><label className="label">GSTIN</label><input className="input-field font-mono" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value.toUpperCase()})} /></div>
          <div className="form-group"><label className="label">City</label><input className="input-field" value={form.address?.city} onChange={e => setForm({...form, address: {...form.address, city: e.target.value}})} /></div>
          <div className="form-group"><label className="label">Pincode</label><input className="input-field" value={form.address?.pincode} onChange={e => setForm({...form, address: {...form.address, pincode: e.target.value}})} /></div>
          <div className="col-span-2 form-group"><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
        </form>
      </Modal>
    </div>
  );
}
