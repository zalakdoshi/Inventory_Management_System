import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import api from '../../api/axios';
import SearchInput from '../../components/ui/SearchInput';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace('/api', '') ||
  'http://localhost:5000';

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
          limit: 100,
          search,
          category: categoryFilter,
          status: 'active',
        },
      })
      .then((r) => setProducts(r.data.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [search, categoryFilter]);

  const categories = [
    ...new Set(products.map((p) => p.category)),
  ];

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
          className="border rounded-xl px-3 py-2 w-48"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value)
          }
        >
          <option value="">
            All Categories
          </option>

          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading
          ? Array(8)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse"
              >
                <div className="h-52 bg-gray-100" />

                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-100 rounded" />

                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))
          : products.map((p) => {
            const isLow =
              p.quantity <= p.reorderLevel;

            const isOut =
              p.quantity === 0;

            return (
              <div
                key={p._id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 group"
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                  {p.image ? (
                    <img
                      src={`${API_BASE}${p.image}`}
                      alt={p.name}
                      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src =
                          '/placeholder-product.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package size={60} />
                    </div>
                  )}

                  {/* Stock Badge */}
                  <div
                    className={`absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full ${isOut
                      ? 'bg-red-500 text-white'
                      : isLow
                        ? 'bg-orange-500 text-white'
                        : 'bg-green-500 text-white'
                      }`}
                  >
                    {isOut
                      ? 'Out'
                      : isLow
                        ? 'Low'
                        : 'In Stock'}
                  </div>
                </div>

                {/* Product Details */}
                <div className="p-4">
                  {/* Category */}
                  <div className="mb-2">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {p.category}
                    </span>
                  </div>

                  {/* Product Name */}
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">
                    {p.name}
                  </h3>

                  {/* HSN */}
                  <p className="text-xs text-gray-400 mb-3">
                    {p.hsnCode
                      ? `HSN: ${p.hsnCode}`
                      : 'No HSN'}
                  </p>

                  {/* Bottom */}
                  <div className="flex items-center justify-between">
                    {/* Price */}
                    <div>
                      <p className="text-lg font-bold text-green-600">
                        ₹
                        {p.sellingPrice?.toLocaleString(
                          'en-IN'
                        )}
                      </p>

                      <p className="text-xs text-gray-400">
                        + {p.gstPercentage}% GST
                      </p>
                    </div>

                    {/* Stock */}
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${isOut
                          ? 'text-red-600'
                          : isLow
                            ? 'text-orange-600'
                            : 'text-gray-700'
                          }`}
                      >
                        {p.quantity} {p.unit}
                      </p>

                      <p className="text-xs text-gray-400">
                        Available
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}