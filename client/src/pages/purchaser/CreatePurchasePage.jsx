import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { PRODUCT_CATEGORIES } from '../../constants';

export default function CreatePurchasePage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ supplier: '', supplierName: '', invoiceNumber: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });
  const [items, setItems] = useState([{ product: '', productName: '', quantity: 1, unitPrice: '', gstPercentage: 18 }]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data.data || [])).catch(() => {});
    api.get('/products', { params: { limit: 200, status: 'active' } }).then(r => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  const addItem = () => setItems([...items, { product: '', productName: '', quantity: 1, unitPrice: '', gstPercentage: 18 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    if (field === 'product') {
      const prod = products.find(p => p._id === value);
      if (prod) { updated[i].productName = prod.name; updated[i].unitPrice = prod.purchasePrice; updated[i].gstPercentage = prod.gstPercentage; }
    }
    setItems(updated);
  };

  const calcTotals = () => {
    let subtotal = 0, tax = 0;
    items.forEach(item => {
      const base = (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0);
      subtotal += base;
      tax += (base * (item.gstPercentage || 0)) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  };

  const { subtotal, tax, total } = calcTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some(i => !i.product || !i.unitPrice)) { toast.error('All items need a product and price.'); return; }
    setSubmitting(true);
    try {
      await api.post('/purchases', { ...form, items });
      toast.success('Purchase order created! Inventory updated.');
      navigate('/purchaser/purchases');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">Create Purchase Order</h1><p className="page-subtitle">Add new stock to inventory</p></div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Details */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Purchase Details</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="form-group sm:col-span-2">
              <label className="label">Supplier</label>
              <select className="select-field" value={form.supplier} onChange={e => {
                const s = suppliers.find(s => s._id === e.target.value);
                setForm({...form, supplier: e.target.value, supplierName: s?.name || ''});
              }}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Invoice Number</label>
              <input className="input-field" value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} placeholder="Supplier invoice #" />
            </div>
            <div className="form-group">
              <label className="label">Purchase Date</label>
              <input type="date" className="input-field" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Purchase Items</h3>
            <button type="button" onClick={addItem} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-2"><Plus size={14} /> Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="col-span-12 sm:col-span-4">
                  <label className="label text-xs">Product *</label>
                  <select className="select-field text-sm" value={item.product} onChange={e => updateItem(i, 'product', e.target.value)} required>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="label text-xs">Qty *</label>
                  <input type="number" className="input-field text-sm" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="1" required />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="label text-xs">Unit Price (₹) *</label>
                  <input type="number" className="input-field text-sm" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} min="0" step="0.01" required />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="label text-xs">GST %</label>
                  <select className="select-field text-sm" value={item.gstPercentage} onChange={e => updateItem(i, 'gstPercentage', Number(e.target.value))}>
                    {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-1 flex items-end">
                  <p className="text-sm font-semibold text-gray-900 pb-2.5">₹{((parseFloat(item.unitPrice)||0)*(parseInt(item.quantity)||0)*((100+item.gstPercentage)/100)).toFixed(0)}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="card p-6">
          <div className="flex flex-col items-end space-y-2">
            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span className="font-semibold">₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-orange-600"><span>GST Tax:</span><span className="font-semibold">₹{tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold text-primary-700 border-t pt-2"><span>Total:</span><span>₹{total.toFixed(2)}</span></div>
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Notes</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            Create Purchase Order
          </button>
        </div>
      </form>
    </div>
  );
}
