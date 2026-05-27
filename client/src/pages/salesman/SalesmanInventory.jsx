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
                const localPath = `${window.location.origin}${selectedProduct.image}`;
                if (e.target.src !== localPath) {
                  e.target.src = selectedProduct.image;
                } else {
                  e.target.src = '/placeholder-product.png';
                }
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
      const name = p.name.trim();
      const upperName = name.toUpperCase();
      let mainName = name;
      let subtypeName = 'Standard';

      // --- A. EXPLICIT CUSTOM MAPPINGS FROM USER'S REQUEST (RUN FIRST) ---
      
      // 1. MCB (Electrical)
      if (upperName.includes('MCB')) {
        let variant = 'Standard';
        if (upperName.includes('SINGLE')) variant = 'Single Pole MCB';
        else if (upperName.includes('DUBLE') || upperName.includes('DOUBLE')) variant = 'Double Pole MCB';
        else if (upperName.includes('THREE') || upperName.includes('TRIPLE')) variant = 'Three Pole MCB';
        else if (upperName.includes('FOUR')) variant = 'Four Pole MCB';
        else variant = name;

        mainName = 'MCB';
        subtypeName = variant;
      }
      // 2. Switches & Indicators (Electrical)
      else if (upperName === 'INDICATOR' || upperName === 'PUSH BUTTON' || upperName.includes('EMERGENCY STOP') || upperName.includes('SELECTOR SWITCH')) {
        let variant = name;
        if (upperName === 'INDICATOR') variant = 'Indicator';
        else if (upperName === 'PUSH BUTTON') variant = 'Push Button';
        else if (upperName.includes('EMERGENCY STOP')) variant = 'Emergency Stop Button';
        else if (upperName.includes('SELECTOR SWITCH')) variant = 'Selector Switch';

        mainName = 'Switches & Indicators';
        subtypeName = variant;
      }
      // 3. Relay Series (Electrical)
      else if (upperName.includes('AM 91') || upperName === 'VAF' || upperName.includes('P2P') || upperName.includes('AM 93') || upperName.includes('MPR 932')) {
        let variant = name;
        if (upperName.includes('AM 91')) variant = 'AM 91 / VM 91';
        else if (upperName === 'VAF') variant = 'VAF';
        else if (upperName.includes('P2P')) variant = 'P2P 912 / 712 / 412';
        else if (upperName.includes('AM 93')) variant = 'AM 93 / VM 93';
        else if (upperName.includes('MPR 932')) variant = 'MPR 932';

        mainName = 'Relay Series';
        subtypeName = variant;
      }
      // 4. Protection Devices (Electrical)
      else if (upperName.includes('ELCB - 2 POL') || upperName.includes('ELCB 2 POL') || upperName.includes('AVM - 2 POL') || upperName.includes('AVM 2 POL')) {
        let variant = name;
        if (upperName.includes('ELCB')) variant = 'ELCB 2 POL';
        else if (upperName.includes('AVM')) variant = 'AVM 2 POL';

        mainName = 'Protection Devices';
        subtypeName = variant;
      }
      // 5. Spiral Sleeve (Electrical)
      else if (upperName.includes('SPYRAL') || upperName.includes('SPIRAL')) {
        const match = name.match(/(\d+mm)/i);
        const size = match ? match[1] : 'Standard';
        mainName = 'Spiral';
        subtypeName = size;
      }
      // 6. Others (Electrical)
      else if (upperName.includes('LIMIT SWITCH') || upperName.includes('PANEL LOCK') || upperName.includes('CONNECTOR LOCK')) {
        let variant = name;
        if (upperName.includes('LIMIT SWITCH')) variant = 'Limit Switch 8108';
        else if (upperName.includes('PANEL LOCK')) variant = 'Panel Lock';
        else if (upperName.includes('CONNECTOR LOCK')) variant = 'Connector Lock';

        mainName = 'Others';
        subtypeName = variant;
      }
      // 7. Spherical Bearing (Bearing)
      else if (upperName.startsWith('BEARING 22211') || upperName.startsWith('BEARING 22217')) {
        let variant = '22211';
        if (upperName.includes('22211 K') || upperName.includes('22211K')) variant = '22211 K';
        else if (upperName.includes('22211')) variant = '22211';
        else if (upperName.includes('22217 K') || upperName.includes('22217K')) variant = '22217 K';
        else if (upperName.includes('22217')) variant = '22217';

        mainName = 'Spherical Bearing';
        subtypeName = variant;
      }
      // 8. Explicit Bearing Series (6000, 6200, 6300)
      else if (upperName.startsWith('BEARING ')) {
        const match = name.match(/^BEARING\s+(\d+)\s*[_\s-]*\s*(.*)/i);
        if (match) {
          const num = match[1];
          let suffix = match[2].trim();
          const series = num.substring(0, 2) + '00';
          
          if (suffix.startsWith('_')) suffix = suffix.substring(1);
          suffix = suffix.replace(/_/g, ' ');

          mainName = `Bearing Series ${series}`;
          subtypeName = `${num} ${suffix || 'Standard'}`;
        }
      }
      // 9. PVC Braided Hose (Hydraulic)
      else if (upperName.includes('PVC BRADIED') || upperName.includes('PVC BRAIDED')) {
        const match = name.match(/(\d+MM|\d+\s*MM)/i);
        const size = match ? match[1].toUpperCase() : 'Standard';
        mainName = 'PVC Braided Hose';
        subtypeName = size;
      }
      // 10. Pneumatic Rubber Hose (Hydraulic)
      else if (upperName.includes('PNEUMATIC RUBBER HOSE') || (upperName.includes('PNEUMATIC') && upperName.includes('RUBBER') && upperName.includes('HOSE'))) {
        const match = name.match(/(\d+\s*MM|\d+MM)/i);
        const size = match ? match[1].toUpperCase() : 'Standard';
        mainName = 'Pneumatic Rubber Hose';
        subtypeName = size;
      }
      // 11. Samson PVC Braided Hose (Hydraulic)
      else if (upperName.includes('SAMSON PVC BRADIED HOSE') || upperName.includes('SAMSON PVC BRAIDED HOSE')) {
        let size = name.replace(/SAMSON PVC BRADIED HOSE/gi, '').replace(/SAMSON PVC BRAIDED HOSE/gi, '').trim();
        if (size.startsWith('_')) size = size.substring(1);
        size = size.replace(/_/g, ' ');
        mainName = 'Samson PVC Braided Hose';
        subtypeName = size || 'Standard';
      }
      // 12. Samson Thermo Acty (Hydraulic)
      else if (upperName.includes('SAMSON THERMO ACTY')) {
        let variant = name.replace(/SAMSON THERMO ACTY/gi, '').trim();
        if (variant.startsWith('_')) variant = variant.substring(1);
        if (variant.toUpperCase().includes('BLACK')) {
          variant = variant.toUpperCase().includes('6MM') ? 'Black 6MM' : 'Black 8MM';
        } else if (variant.toUpperCase().includes('RED')) {
          variant = 'Red 8MM';
        } else if (variant.toUpperCase().includes('BLUE')) {
          variant = 'Blue 8MM';
        }
        mainName = 'Samson Thermo Acty';
        subtypeName = variant;
      }
      // 13. Regulators (Hydraulic)
      else if (upperName.includes('REGULATOR') && (upperName.includes('CO2') || upperName.includes('OXYGEN') || upperName.includes('NITROGEN') || upperName.includes('ACETYLENE') || upperName.includes('ARGON'))) {
        let variant = 'CO2 Regulator';
        if (upperName.includes('CO2')) variant = 'CO2 Regulator';
        else if (upperName.includes('OXYGEN')) variant = 'Oxygen Regulator';
        else if (upperName.includes('NITROGEN')) variant = 'Nitrogen Regulator';
        else if (upperName.includes('ACETYLENE')) variant = 'Acetylene Regulator';
        else if (upperName.includes('ARGON')) variant = 'Argon Regulator';

        mainName = 'Regulators';
        subtypeName = variant;
      }
      // 14. Ganga R6 Rubber Hose (Hydraulic)
      else if (upperName.includes('GANGA R6 RUBBER HOSE')) {
        const match = name.match(/(\d+MM|\d+\s*MM)/i);
        const size = match ? match[1].toUpperCase() : 'Standard';
        mainName = 'Ganga R6 Rubber Hose';
        subtypeName = size;
      }
      // 15. Samson High Pressure Hose (Hydraulic)
      else if (upperName.includes('SAMSON HIGH PRESSURE HOSE')) {
        const match = name.match(/(\d+MM|\d+\s*MM)/i);
        const size = match ? match[1].toUpperCase() : '8MM';
        mainName = 'Samson High Pressure Hose';
        subtypeName = size;
      }
      // 16. LPG Rubber Hose (Hydraulic)
      else if (upperName.includes('LPG RUBBER HOSE')) {
        const match = name.match(/(\d+MM|\d+\s*MM)/i);
        const size = match ? match[1].toUpperCase() : '8MM';
        mainName = 'LPG Rubber Hose';
        subtypeName = size;
      }

      // --- B. STRUCTURAL AND SMART FALLBACK RULES ---
      else if (name.includes(' - ')) {
        const parts = name.split(' - ');
        mainName = parts[0].trim();
        subtypeName = parts.slice(1).join(' - ').trim();
      }
      else if (name.includes('_')) {
        const parts = name.split('_');
        mainName = parts[0].trim();
        subtypeName = parts.slice(1).join('_').trim();
      }
      else if (/^(UCP|UCF|UCFL|UCT)\s+(\d+(?:\s*(?:MM|INCH))?)\s*(.*)/i.test(name)) {
        const housingMatch = name.match(/^(UCP|UCF|UCFL|UCT)\s+(\d+(?:\s*(?:MM|INCH))?)\s*(.*)/i);
        const type = housingMatch[1].toUpperCase();
        const size = housingMatch[2].trim();
        mainName = `${type} Bearing Housing`;
        subtypeName = size;
      }
      else {
        const sizeRegex = /\s+((?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+)\s*(?:MM|KG|MTR|METER|INCH|LTR|LITER|Nos|Pcs|Amp|A|HP|V|W|")(?:\s+.*)?)$/i;
        const dimRegex = /\s+((?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+)"?\s*X\s*(?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+).*)$/i;

        let sizeMatched = false;

        let match = name.match(dimRegex);
        if (match) {
          const matchedSuffix = match[1];
          const baseName = name.slice(0, name.lastIndexOf(matchedSuffix)).trim();
          if (baseName.length > 2) {
            mainName = baseName;
            subtypeName = matchedSuffix;
            sizeMatched = true;
          }
        }

        if (!sizeMatched) {
          match = name.match(sizeRegex);
          if (match) {
            const matchedSuffix = match[1];
            const baseName = name.slice(0, name.lastIndexOf(matchedSuffix)).trim();
            if (baseName.length > 2) {
              mainName = baseName;
              subtypeName = matchedSuffix;
              sizeMatched = true;
            }
          }
        }

        if (!sizeMatched) {
          if (upperName.includes('FLAP DISC')) {
            const suffix = name.replace(/FLAP DISC/gi, '').trim();
            mainName = 'Flap Disc';
            subtypeName = suffix || 'Standard';
          } else if (upperName.includes('MOP WHEEL')) {
            const suffix = name.replace(/MOP WHEEL/gi, '').trim();
            mainName = 'Mop Wheel';
            subtypeName = suffix || 'Standard';
          } else if (upperName.includes('CUT OFF WHEEL') || upperName.includes('CUT OF WHEEL')) {
            const suffix = name.replace(/CUT OFF WHEEL/gi, '').replace(/CUT OF WHEEL/gi, '').trim();
            mainName = 'Cut Off Wheel';
            subtypeName = suffix || 'Standard';
          } else if (upperName.includes('DC WHEEL')) {
            const suffix = name.replace(/DC WHEEL/gi, '').trim();
            mainName = 'DC Wheel';
            subtypeName = suffix || 'Standard';
          }
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

  };

  const groupedProducts = groupProducts(products);
  console.log('🔎 DEPLOYED CATALOG DEBUG - Grouped Products:', groupedProducts);

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