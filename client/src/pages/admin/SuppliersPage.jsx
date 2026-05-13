import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', gstin: '', address: { street: '', city: '', state: 'Gujarat', pincode: '' }, notes: '' };

export default function SuppliersPage({ readOnly }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try { const { data } = await api.get('/suppliers'); setSuppliers(data.data || []); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openCreate = () => { setEditSupplier(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s) => { setEditSupplier(s); setForm({ name: s.name, contactPerson: s.contactPerson || '', phone: s.phone || '', email: s.email || '', gstin: s.gstin || '', address: s.address || EMPTY.address, notes: s.notes || '' }); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editSupplier) { await api.put(`/suppliers/${editSupplier._id}`, form); toast.success('Supplier updated!'); }
      else { await api.post('/suppliers', form); toast.success('Supplier created!'); }
      setModalOpen(false); fetchSuppliers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete supplier?')) return;
    try { await api.delete(`/suppliers/${id}`); toast.success('Deleted.'); fetchSuppliers(); }
    catch { toast.error('Delete failed.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="page-title">Suppliers</h1><p className="page-subtitle">{suppliers.length} suppliers</p></div>
        {!readOnly && <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Supplier</button>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="card p-5 animate-pulse space-y-3"><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>) :
          suppliers.map(s => (
            <div key={s._id} className="card p-5 hover:shadow-card-hover transition-all">
              <div className="flex justify-between items-start mb-3">
                <div><h3 className="font-semibold text-gray-900">{s.name}</h3>{s.contactPerson && <p className="text-xs text-gray-400">Contact: {s.contactPerson}</p>}</div>
                {!readOnly && <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>}
              </div>
              <div className="space-y-1 text-sm text-gray-500">
                {s.phone && <p>📞 {s.phone}</p>}
                {s.email && <p>✉️ {s.email}</p>}
                {s.gstin && <p className="font-mono text-xs">🏷️ {s.gstin}</p>}
              </div>
            </div>
          ))
        }
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editSupplier ? 'Edit Supplier' : 'Add Supplier'} size="lg"
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
