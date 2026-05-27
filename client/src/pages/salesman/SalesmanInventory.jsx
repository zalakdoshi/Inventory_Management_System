import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import api from '../../api/axios';
import SearchInput from '../../components/ui/SearchInput';
import { PRODUCT_CATEGORIES } from '../../constants';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace('/api', '') ||
  'http://localhost:5000';

// Sub-component for Grouped Product Card
function ProductCard({ group }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedProduct = group.subtypes[selectedIdx] || group.subtypes[0];
  
  const isLow = selectedProduct.quantity <= selectedProduct.reorderLevel;
  const isOut = selectedProduct.quantity === 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg hover:border-primary-100 transition-all duration-300 group flex flex-col justify-between">
      {/* Card Image Block */}
      <div>
        <div className="relative aspect-square bg-gray-50 overflow-hidden flex items-center justify-center">
          {selectedProduct.image ? (
            <img
              src={`${API_BASE}${selectedProduct.image}`}
              alt={group.name}
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.src = '/placeholder-product.png';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Package size={60} />
            </div>
          )}
          
          {/* Stock Status Badge */}
          <div
            className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isOut
                ? 'bg-red-500 text-white'
                : isLow
                  ? 'bg-orange-500 text-white'
                  : 'bg-green-500 text-white'
            }`}
          >
            {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
          </div>
        </div>

        {/* Details Block */}
        <div className="p-4 space-y-3">
          {/* Category */}
          <div>
            <span className="text-[9px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {group.category}
            </span>
          </div>

          {/* Product Name */}
          <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
            {group.name}
          </h3>

          {/* HSN Code */}
          <p className="text-[10px] text-gray-400 font-medium">
            {selectedProduct.hsnCode ? `HSN: ${selectedProduct.hsnCode}` : 'No HSN'}
          </p>

          {/* Subtypes dropdown selector */}
          {group.subtypes.length > 1 ? (
            <div className="space-y-1 pt-1">
              <label className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Select Variant</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold bg-gray-50 hover:bg-white focus:border-primary-400 focus:bg-white focus:ring-1 focus:ring-primary-400 transition-all cursor-pointer outline-none"
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
              >
                {group.subtypes.map((sub, idx) => (
                  <option key={sub._id} value={idx}>
                    {sub.subtypeName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100 font-semibold truncate">
              Variant: {selectedProduct.subtypeName}
            </div>
          )}
        </div>
      </div>

      {/* Stock & Price Footer */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
        <div>
          <p className="text-lg font-black text-primary-600">
            ₹{selectedProduct.sellingPrice?.toLocaleString('en-IN')}
          </p>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
            + {selectedProduct.gstPercentage}% GST
          </p>
        </div>

        <div className="text-right">
          <p
            className={`text-sm font-black ${
              isOut
                ? 'text-red-600'
                : isLow
                  ? 'text-orange-600'
                  : 'text-gray-800'
            }`}
          >
            {selectedProduct.quantity} {selectedProduct.unit}
          </p>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
            Stock Qty
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SalesmanInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    setLoading(true);

    api
      .get('/products', {
        params: {
          limit: 1000, // Load all 411 products so searching/filtering works perfectly
          search,
          category: categoryFilter,
          status: 'active',
        },
      })
      .then((r) => setProducts(r.data.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [search, categoryFilter]);

  // Premium Grouping Function to consolidate subtypes (MCBs, bearings, flap discs, hoses, etc.)
  const groupProducts = (list) => {
    const groups = {};

    list.forEach(p => {
      let mainName = p.name;
      let subtypeName = 'Standard';

      const upperName = p.name.toUpperCase();

      // Grouping rules:
      if (p.name.includes(' - ')) {
        // Electrical items and other pre-formatted items (e.g. F.T.I - 0.5mm)
        const parts = p.name.split(' - ');
        mainName = parts[0].trim();
        subtypeName = parts.slice(1).join(' - ').trim();
      } else if (upperName.includes('FLAP DISC')) {
        mainName = 'Flap Disc';
        subtypeName = p.name.replace(/FLAP DISC/gi, '').trim();
      } else if (upperName.includes('MOP WHEEL')) {
        mainName = 'Mop Wheel';
        subtypeName = p.name.replace(/MOP WHEEL/gi, '').trim();
      } else if (upperName.includes('CUT OFF WHEEL') || upperName.includes('CUT OF WHEEL')) {
        mainName = 'Cut Off Wheel';
        subtypeName = p.name.replace(/CUT OFF WHEEL/gi, '').replace(/CUT OF WHEEL/gi, '').trim();
      } else if (upperName.includes('DC WHEEL')) {
        mainName = 'DC Wheel';
        subtypeName = p.name.replace(/DC WHEEL/gi, '').trim();
      } else if (upperName.startsWith('UCP ') && upperName.includes('HOUSING')) {
        mainName = 'UCP Bearing Housing';
        subtypeName = p.name.replace(/UCP/gi, '').replace(/BRG HOUSING/gi, '').trim();
      } else if (upperName.startsWith('UCP ') && upperName.includes('SMTB')) {
        mainName = 'UCP SMTB';
        subtypeName = p.name.replace(/UCP/gi, '').replace(/SMTB/gi, '').trim();
      } else if (upperName.startsWith('UCF ') && upperName.includes('HOUSING')) {
        mainName = 'UCF Bearing Housing';
        subtypeName = p.name.replace(/UCF/gi, '').replace(/BRG HOUSING/gi, '').trim();
      } else if (upperName.startsWith('UCF ') && upperName.includes('SMTB')) {
        mainName = 'UCF SMTB';
        subtypeName = p.name.replace(/UCF/gi, '').replace(/SMTB/gi, '').trim();
      } else if (upperName.startsWith('UCFL ') && upperName.includes('SMTB')) {
        mainName = 'UCFL SMTB';
        subtypeName = p.name.replace(/UCFL/gi, '').replace(/SMTB/gi, '').trim();
      } else if (upperName.startsWith('UCT ') && upperName.includes('SMTB')) {
        mainName = 'UCT SMTB';
        subtypeName = p.name.replace(/UCT/gi, '').replace(/SMTB/gi, '').trim();
      } else if (upperName.startsWith('BEARING ')) {
        const match = p.name.match(/^BEARING\s+(\d+)\s*(.*)/i);
        if (match) {
          mainName = `Bearing ${match[1]}`;
          subtypeName = match[2].trim() || 'Standard';
        }
      }

      const key = `${p.category}_${mainName}`;
      if (!groups[key]) {
        groups[key] = {
          name: mainName,
          category: p.category,
          image: p.image,
          subtypes: []
        };
      }
      
      // Update image if group image is null but product has one
      if (!groups[key].image && p.image) {
        groups[key].image = p.image;
      }

      groups[key].subtypes.push({
        ...p,
        subtypeName: subtypeName || 'Standard'
      });
    });

    return Object.values(groups);
  };

  const groupedProducts = groupProducts(products);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Product Catalog
        </h1>

        <p className="text-gray-500 mt-1">
          View available products and stock levels
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-wrap gap-3">
        <SearchInput
          placeholder="Search products..."
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-48"
        />

        <select
          className="border rounded-xl px-3 py-2 w-48 text-sm font-semibold bg-white cursor-pointer select-field"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          Array(8)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse border"
              >
                <div className="h-52 bg-gray-50" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-100 rounded" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))
        ) : groupedProducts.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-400 bg-white rounded-2xl border">
            <Package size={50} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-sm">No products found in this selection</p>
          </div>
        ) : (
          groupedProducts.map((group) => (
            <ProductCard key={`${group.category}_${group.name}`} group={group} />
          ))
        )}
      </div>
    </div>
  );
}