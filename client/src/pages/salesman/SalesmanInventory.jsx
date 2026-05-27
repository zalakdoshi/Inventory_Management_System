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

// ─── Helper: longest common word-level prefix ────────────────────────────────
function commonWordPrefix(a, b) {
  const wa = a.trim().toUpperCase().split(/\s+/);
  const wb = b.trim().toUpperCase().split(/\s+/);
  let i = 0;
  while (i < wa.length && i < wb.length && wa[i] === wb[i]) i++;
  // Return the prefix using original casing from `a`
  return a.trim().split(/\s+/).slice(0, i).join(' ');
}

// ─── Smart 2-Pass Grouping Engine ────────────────────────────────────────────
// Pass 1A: scan all products per category to build a shared-prefix lookup table.
// Pass 1B: parse each product → { mainName, subtypeName } using:
//   1. Explicit named rules (MCB, Bearings, Hoses, etc.)
//   2. Structural separators ( - , _)
//   3. Trailing numeric-unit size suffix
//   4. General shared-prefix engine (catches JOLLY WORM DRIVE, PAKAD, etc.)
// Pass 2:  group by (category + mainName) → array of card groups.
function buildGroupedProducts(list) {
  if (!list || !Array.isArray(list) || list.length === 0) return [];

  // ── Pass 1A: build prefix lookup map ────────────────────────────────────────
  const byCategory = {};
  list.forEach(p => {
    if (!p || !p.name) return;
    const cat = p.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p.name.trim());
  });

  // prefixMap: "CATEGORY|||fullName" → { mainName, subtypeName }
  const prefixMap = {};

  Object.entries(byCategory).forEach(([cat, names]) => {
    // Count how many products share each common prefix
    const prefixCount = {};
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const pfx = commonWordPrefix(names[i], names[j]);
        if (
          pfx.length >= 3 &&
          pfx.toUpperCase() !== names[i].toUpperCase() &&
          pfx.toUpperCase() !== names[j].toUpperCase()
        ) {
          prefixCount[pfx.toUpperCase()] = (prefixCount[pfx.toUpperCase()] || 0) + 1;
        }
      }
    }

    names.forEach(name => {
      const mapKey = `${cat}|||${name}`;
      const nameUpper = name.toUpperCase();
      // Find all prefixes that are a strict prefix of this name
      const candidates = Object.keys(prefixCount).filter(pfxUpper =>
        nameUpper.startsWith(pfxUpper) &&
        nameUpper.length > pfxUpper.length &&
        (nameUpper[pfxUpper.length] === ' ' || nameUpper[pfxUpper.length] === '_') &&
        prefixCount[pfxUpper] >= 1
      );
      if (candidates.length > 0) {
        // Use the longest matching prefix
        const bestPfxUpper = candidates.reduce((a, b) => a.length >= b.length ? a : b);
        // Recover original-case mainName from the name string
        const mainName = name.substring(0, bestPfxUpper.length).trim();
        const suffix = name.substring(bestPfxUpper.length).trim().replace(/^[-_\s]+/, '');
        prefixMap[mapKey] = { mainName, subtypeName: suffix || 'Standard' };
      }
    });
  });

  // ── Pass 1B: classify every product ─────────────────────────────────────────
  const parsed = list.map(p => {
    if (!p || !p.name) return null;
    const name = p.name.trim();
    const U = name.toUpperCase();
    let mainName = name;
    let subtypeName = 'Standard';

    // ── 1. MCB ────────────────────────────────────────────────────────────────
    if (U.includes('MCB')) {
      let v = name;
      if (U.includes('SINGLE')) v = 'Single Pole MCB';
      else if (U.includes('DUBLE') || U.includes('DOUBLE')) v = 'Double Pole MCB';
      else if (U.includes('THREE') || U.includes('TRIPLE')) v = 'Three Pole MCB';
      else if (U.includes('FOUR')) v = 'Four Pole MCB';
      mainName = 'MCB'; subtypeName = v;
    }
    // ── 2. Switches & Indicators ──────────────────────────────────────────────
    else if (U === 'INDICATOR' || U === 'PUSH BUTTON' || U.includes('EMERGENCY STOP') || U.includes('SELECTOR SWITCH')) {
      let v = name;
      if (U === 'INDICATOR') v = 'Indicator';
      else if (U === 'PUSH BUTTON') v = 'Push Button';
      else if (U.includes('EMERGENCY STOP')) v = 'Emergency Stop Button';
      else if (U.includes('SELECTOR SWITCH')) v = 'Selector Switch';
      mainName = 'Switches & Indicators'; subtypeName = v;
    }
    // ── 3. Relay Series ───────────────────────────────────────────────────────
    else if (U.includes('AM 91') || U === 'VAF' || U.includes('P2P') || U.includes('AM 93') || U.includes('MPR 932')) {
      let v = name;
      if (U.includes('AM 91')) v = 'AM 91 / VM 91';
      else if (U === 'VAF') v = 'VAF';
      else if (U.includes('P2P')) v = 'P2P 912 / 712 / 412';
      else if (U.includes('AM 93')) v = 'AM 93 / VM 93';
      else if (U.includes('MPR 932')) v = 'MPR 932';
      mainName = 'Relay Series'; subtypeName = v;
    }
    // ── 4. Protection Devices ─────────────────────────────────────────────────
    else if ((U.includes('ELCB') && U.includes('POL')) || (U.includes('AVM') && U.includes('POL'))) {
      mainName = 'Protection Devices';
      subtypeName = U.includes('ELCB') ? 'ELCB 2 POL' : 'AVM 2 POL';
    }
    // ── 5. Spiral Sleeve ──────────────────────────────────────────────────────
    else if (U.includes('SPYRAL') || U.includes('SPIRAL')) {
      const m = name.match(/(\d+mm)/i);
      mainName = 'Spiral'; subtypeName = m ? m[1] : 'Standard';
    }
    // ── 6. Others (Electrical) ────────────────────────────────────────────────
    else if (U.includes('LIMIT SWITCH') || U.includes('PANEL LOCK') || U.includes('CONNECTOR LOCK')) {
      let v = name;
      if (U.includes('LIMIT SWITCH')) v = 'Limit Switch 8108';
      else if (U.includes('PANEL LOCK')) v = 'Panel Lock';
      else if (U.includes('CONNECTOR LOCK')) v = 'Connector Lock';
      mainName = 'Others'; subtypeName = v;
    }
    // ── 7. Spherical Bearing ──────────────────────────────────────────────────
    else if (U.startsWith('BEARING 22211') || U.startsWith('BEARING 22217')) {
      let v = '22211';
      if (U.includes('22211 K') || U.includes('22211K')) v = '22211 K';
      else if (U.includes('22211')) v = '22211';
      else if (U.includes('22217 K') || U.includes('22217K')) v = '22217 K';
      else if (U.includes('22217')) v = '22217';
      mainName = 'Spherical Bearing'; subtypeName = v;
    }
    // ── 8. Bearing Series 6000 / 6200 / 6300 ─────────────────────────────────
    else if (U.startsWith('BEARING ')) {
      const m = name.match(/^BEARING\s+(\d+)\s*[_\s-]*\s*(.*)/i);
      if (m) {
        const num = m[1];
        const suffix = m[2].trim().replace(/^_/, '').replace(/_/g, ' ');
        const series = num.substring(0, 2) + '00';
        mainName = `Bearing Series ${series}`;
        subtypeName = `${num}${suffix ? ' ' + suffix : ''}`.trim();
      }
    }
    // ── 9. PVC Braided Hose ───────────────────────────────────────────────────
    else if (U.includes('PVC BRADIED') || U.includes('PVC BRAIDED')) {
      const m = name.match(/(\d+MM|\d+\s*MM)/i);
      mainName = 'PVC Braided Hose'; subtypeName = m ? m[1].toUpperCase() : 'Standard';
    }
    // ── 10. Pneumatic Rubber Hose ─────────────────────────────────────────────
    else if (U.includes('PNEUMATIC') && U.includes('RUBBER') && U.includes('HOSE')) {
      const m = name.match(/(\d+\s*MM|\d+MM)/i);
      mainName = 'Pneumatic Rubber Hose'; subtypeName = m ? m[1].toUpperCase() : 'Standard';
    }
    // ── 11. Samson PVC Braided Hose ───────────────────────────────────────────
    else if (U.includes('SAMSON PVC') && U.includes('HOSE')) {
      const size = name.replace(/SAMSON PVC BR[AI]+DIED HOSE/gi, '').trim().replace(/^[-_\s]+/, '').replace(/_/g, ' ');
      mainName = 'Samson PVC Braided Hose'; subtypeName = size || 'Standard';
    }
    // ── 12. Samson Thermo Acty ────────────────────────────────────────────────
    else if (U.includes('SAMSON THERMO ACTY')) {
      let v = name.replace(/SAMSON THERMO ACTY/gi, '').trim().replace(/^[-_\s]+/, '');
      if (U.includes('BLACK')) v = U.includes('6MM') ? 'Black 6MM' : 'Black 8MM';
      else if (U.includes('RED')) v = 'Red 8MM';
      else if (U.includes('BLUE')) v = 'Blue 8MM';
      mainName = 'Samson Thermo Acty'; subtypeName = v;
    }
    // ── 13. Regulators ────────────────────────────────────────────────────────
    else if (U.includes('REGULATOR') && (U.includes('CO2') || U.includes('OXYGEN') || U.includes('NITROGEN') || U.includes('ACETYLENE') || U.includes('ARGON'))) {
      let v = 'Regulator';
      if (U.includes('CO2')) v = 'CO2';
      else if (U.includes('OXYGEN')) v = 'Oxygen';
      else if (U.includes('NITROGEN')) v = 'Nitrogen';
      else if (U.includes('ACETYLENE')) v = 'Acetylene';
      else if (U.includes('ARGON')) v = 'Argon';
      mainName = 'Regulators'; subtypeName = `${v} Regulator`;
    }
    // ── 14. Ganga R6 Rubber Hose ──────────────────────────────────────────────
    else if (U.includes('GANGA R6 RUBBER HOSE')) {
      const m = name.match(/(\d+MM|\d+\s*MM)/i);
      mainName = 'Ganga R6 Rubber Hose'; subtypeName = m ? m[1].toUpperCase() : 'Standard';
    }
    // ── 15. Samson High Pressure Hose ─────────────────────────────────────────
    else if (U.includes('SAMSON HIGH PRESSURE HOSE')) {
      const m = name.match(/(\d+MM|\d+\s*MM)/i);
      mainName = 'Samson High Pressure Hose'; subtypeName = m ? m[1].toUpperCase() : '8MM';
    }
    // ── 16. LPG Rubber Hose ───────────────────────────────────────────────────
    else if (U.includes('LPG RUBBER HOSE')) {
      const m = name.match(/(\d+MM|\d+\s*MM)/i);
      mainName = 'LPG Rubber Hose'; subtypeName = m ? m[1].toUpperCase() : '8MM';
    }
    // ── 17. Jolly Worm Drive Hose Clips ──────────────────────────────────────
    else if (U.includes('WORM DRIVE HOSE CLIPS')) {
      const suffix = name.replace(/JOLLY WORM DRIVE HOSE CLIPS/gi, '').replace(/WORM DRIVE HOSE CLIPS/gi, '').trim().replace(/^[-_\s]+/, '');
      mainName = 'Jolly Worm Drive Hose Clips'; subtypeName = suffix || 'Standard';
    }
    // ── 18. Flap Disc / Mop Wheel / Cut Off Wheel / DC Wheel ─────────────────
    else if (U.includes('FLAP DISC')) {
      mainName = 'Flap Disc'; subtypeName = name.replace(/FLAP DISC/gi, '').trim() || 'Standard';
    }
    else if (U.includes('MOP WHEEL')) {
      mainName = 'Mop Wheel'; subtypeName = name.replace(/MOP WHEEL/gi, '').trim() || 'Standard';
    }
    else if (U.includes('CUT OFF WHEEL') || U.includes('CUT OF WHEEL')) {
      mainName = 'Cut Off Wheel'; subtypeName = name.replace(/CUT O[F]+\s*WHEEL/gi, '').trim() || 'Standard';
    }
    else if (U.includes('DC WHEEL')) {
      mainName = 'DC Wheel'; subtypeName = name.replace(/DC WHEEL/gi, '').trim() || 'Standard';
    }

    // ── Structural separator: " - " ───────────────────────────────────────────
    else if (name.includes(' - ')) {
      const parts = name.split(' - ');
      mainName = parts[0].trim();
      subtypeName = parts.slice(1).join(' - ').trim();
    }
    // ── Structural separator: "_" ─────────────────────────────────────────────
    else if (name.includes('_')) {
      const parts = name.split('_');
      mainName = parts[0].trim();
      subtypeName = parts.slice(1).join('_').replace(/_/g, ' ').trim();
    }
    // ── UCP / UCF / UCFL / UCT Bearing Housing ───────────────────────────────
    else if (/^(UCP|UCF|UCFL|UCT)\s+(\d+(?:\s*(?:MM|INCH))?)\s*(.*)/i.test(name)) {
      const m = name.match(/^(UCP|UCF|UCFL|UCT)\s+(\d+(?:\s*(?:MM|INCH))?)\s*(.*)/i);
      mainName = `${m[1].toUpperCase()} Bearing Housing`;
      subtypeName = m[2].trim();
    }
    // ── General trailing numeric-unit size ────────────────────────────────────
    else {
      const sizeRegex = /\s+((?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+)\s*(?:MM|KG|MTR|METER|INCH|LTR|LITER|Nos|Pcs|Amp|A|HP|V|W|")(?:\s+.*)?)$/i;
      const dimRegex  = /\s+((?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+)"?\s*X\s*(?:\d+(?:\.\d+)?|\d+\/\d+|\d+\.\d+\/\d+).*)$/i;

      let sizeMatched = false;
      let m = name.match(dimRegex);
      if (m) {
        const suffix = m[1];
        const base = name.slice(0, name.lastIndexOf(suffix)).trim();
        if (base.length > 2) { mainName = base; subtypeName = suffix; sizeMatched = true; }
      }
      if (!sizeMatched) {
        m = name.match(sizeRegex);
        if (m) {
          const suffix = m[1];
          const base = name.slice(0, name.lastIndexOf(suffix)).trim();
          if (base.length > 2) { mainName = base; subtypeName = suffix; sizeMatched = true; }
        }
      }
      // ── General shared-prefix engine (last resort) ────────────────────────
      if (!sizeMatched) {
        const prefixKey = `${p.category}|||${name}`;
        if (prefixMap[prefixKey]) {
          mainName = prefixMap[prefixKey].mainName;
          subtypeName = prefixMap[prefixKey].subtypeName;
        }
      }
    }

    return { ...p, _mainName: mainName, _subtypeName: subtypeName || 'Standard' };
  }).filter(Boolean);

  // ── Pass 2: group into card objects ─────────────────────────────────────────
  const groups = {};
  parsed.forEach(p => {
    const key = `${p.category}_${p._mainName}`;
    if (!groups[key]) {
      groups[key] = { name: p._mainName, category: p.category, subtypes: [] };
    }
    groups[key].subtypes.push({ ...p, subtypeName: p._subtypeName });
  });

  return Object.values(groups);
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
          limit: 1000,
          search,
          category: categoryFilter,
          status: 'active',
        },
      })
      .then((r) => setProducts(r.data?.data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, categoryFilter]);

  const groupedProducts = buildGroupedProducts(products);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
        <p className="text-gray-500 mt-1">View available products and stock levels</p>
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
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse border">
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