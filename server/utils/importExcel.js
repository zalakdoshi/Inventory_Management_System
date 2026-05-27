/**
 * Vardhman Family ERP — Excel Import Script with Images & Nested Lookahead
 * Run: node utils/importExcel.js
 * Clears existing products and imports new ones from d:\Inventory_Management_System\client\src\Product_Details (1).xlsx
 * Automatically maps unzipped images from PRODUCT_IMAGE.docx
 */
const path = require('path');
const fs = require('fs');

// Manually read .env from server folder
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const Product = require('../models/Product');

const MONGO_URI = process.env.MONGO_URI;

// Helper to parse quantity and unit from Excel QTY string
function parseQtyAndUnit(qtyStr) {
  if (qtyStr === undefined || qtyStr === null) {
    return { quantity: 0, unit: 'Piece' };
  }
  
  let str = qtyStr.toString().trim();
  if (!str) {
    return { quantity: 0, unit: 'Piece' };
  }

  // Handle addition expressions like "2 + 2 + 3" or "2 +2 + 3"
  if (str.includes('+')) {
    try {
      const sum = str.split('+')
        .map(term => parseFloat(term.trim()))
        .filter(val => !isNaN(val))
        .reduce((acc, curr) => acc + curr, 0);
      
      // Attempt to guess unit based on keywords in the rest of the string
      let unit = 'Piece';
      const upperStr = str.toUpperCase();
      if (upperStr.includes('BOX')) unit = 'Box';
      else if (upperStr.includes('MTR') || upperStr.includes('METER')) unit = 'Meter';
      else if (upperStr.includes('SET')) unit = 'Set';
      else if (upperStr.includes('PAIR')) unit = 'Pair';
      else if (upperStr.includes('KG')) unit = 'KG';
      else if (upperStr.includes('LITER') || upperStr.includes('LTR')) unit = 'Liter';

      return { quantity: sum, unit };
    } catch (e) {
      // Fallback
    }
  }

  // Regular expression to extract the leading number (integer or decimal)
  const numMatch = str.match(/^([0-9.]+)/);
  let quantity = 0;
  if (numMatch) {
    quantity = parseFloat(numMatch[1]);
    if (isNaN(quantity)) quantity = 0;
  }

  // Normalize and parse unit
  let unit = 'Piece';
  const cleanStr = str.toLowerCase();
  if (cleanStr.includes('box')) {
    unit = 'Box';
  } else if (cleanStr.includes('mtr') || cleanStr.includes('meter')) {
    unit = 'Meter';
  } else if (cleanStr.includes('set')) {
    unit = 'Set';
  } else if (cleanStr.includes('pair')) {
    unit = 'Pair';
  } else if (cleanStr.includes('kg')) {
    unit = 'KG';
  } else if (cleanStr.includes('liter') || cleanStr.includes('ltr')) {
    unit = 'Liter';
  } else if (cleanStr.includes('roll')) {
    unit = 'Roll';
  } else if (cleanStr.includes('packet') || cleanStr.includes('pkt')) {
    unit = 'Box'; // packet mapped to box
  } else if (cleanStr.includes('nos') || cleanStr.includes('pcs') || cleanStr.includes('pc')) {
    unit = 'Piece';
  }

  return { quantity, unit };
}

// Smart image mapper based on keyword parsing from unzipped Word doc
function getImageForProduct(name, category) {
  const n = name.toUpperCase();
  const cat = category.toUpperCase();

  if (cat === 'CONSUMABLE') {
    if (n.includes('CUT OFF WHEEL')) return '/uploads/products/image3.png';
    if (n.includes('MOP WHEEL')) return '/uploads/products/image4.png';
    if (n.includes('DC WHEEL') && n.includes('GREEN')) return '/uploads/products/image5.png';
    if (n.includes('DC WHEEL') && n.includes('BLACK')) return '/uploads/products/image6.png';
    if (n.includes('FLAP') || n.includes('DISC')) return '/uploads/products/image7.png';
  }

  if (cat === 'BEARING') {
    if (n.includes('UCP') && n.includes('HOUSING')) return '/uploads/products/image8.png';
    if (n.includes('UCP SMTB')) return '/uploads/products/image9.png';
    if (n.includes('UCF') && n.includes('HOUSING')) return '/uploads/products/image10.png';
    if (n.includes('UCF SMTB')) return '/uploads/products/image11.png';
    if (n.includes('ZZ')) return '/uploads/products/image12.png';
    if (n.includes('2RS')) return '/uploads/products/image13.webp';
  }

  if (cat === 'HYDRAULIC') {
    if (n.includes('FIRE EXTINGUISHER') || n.includes('EXTINGUISHERS')) return '/uploads/products/image14.png';
    if (n.includes('FIRE STOP')) return '/uploads/products/image15.png';
    if (n.includes('PVC BRADIED')) return '/uploads/products/image16.png';
    if (n.includes('LPG RUBBER')) return '/uploads/products/image17.png';
    if (n.includes('PU PIPE')) return '/uploads/products/image18.png';
    if (n.includes('LPG ADAPTOR')) return '/uploads/products/image19.png';
    if (n.includes('M S BUSH')) return '/uploads/products/image20.png';
    if (n.includes('TEFLON TAPE')) return '/uploads/products/image21.png';
    if (n.includes('BRASS NUT NIPPLE')) return '/uploads/products/image22.png';
    if (n.includes('LP NUT NIPPLE')) return '/uploads/products/image23.png';
    if (n.includes('M S HEX NIPPLE')) return '/uploads/products/image24.png';
    if (n.includes('SS 304 HEX NIPPLE')) return '/uploads/products/image25.png';
    if (n.includes('M S MALE ELBOW')) return '/uploads/products/image26.png';
    if (n.includes('FE MALE ELBOW')) return '/uploads/products/image27.png';
    if (n.includes('M S MALE TEE')) return '/uploads/products/image28.png';
    if (n.includes('PU TEE')) return '/uploads/products/image29.png';
    if (n.includes('HOSE CLIPS') || n.includes('WORM DRIVE')) return '/uploads/products/image30.png';
    if (n.includes('REGULATOR')) return '/uploads/products/image31.png';
    if (n.includes('COUPLING')) return '/uploads/products/image32.png';
    if (n.includes('HEALTFO FAULET') || n.includes('HEALTFO')) return '/uploads/products/image33.png';
    if (n.includes('M S SOCKET')) return '/uploads/products/image34.png';
    if (n.includes('M S DEAD PLUG')) return '/uploads/products/image35.png';
    if (n.includes('PU JOINT')) return '/uploads/products/image36.png';
    if (n.includes('AIR GUN')) return '/uploads/products/image37.png';
  }

  if (cat === 'ELECTRICAL') {
    if (n.includes('SCHNEIDER') && n.includes('CONTECTOR')) return '/uploads/products/image39.png';
    if (n.includes('SCHNEIDER') && n.includes('CONTACTOR')) return '/uploads/products/image39.png';
    if (n.includes('MCB')) return '/uploads/products/image40.png';
    if (n.includes('INDICATOR')) return '/uploads/products/image44.png';
    if (n.includes('PUSH BUTTON')) return '/uploads/products/image42.png';
    if (n.includes('CONTACTOR')) return '/uploads/products/image42.png';
    if (n.includes('TRY SMALL') || n.includes('TRY BIG')) return '/uploads/products/image45.png';
    if (n.includes('ELCB')) return '/uploads/products/image46.png';
    if (n.includes('AVM') || n.includes('AV MIX')) return '/uploads/products/image47.png';
    if (n.includes('CABLE TIE')) return '/uploads/products/image47.png';
    if (n.includes('LIMIT SWITCH')) return '/uploads/products/image45.png';
    if (n.includes('PANEL LOCK') || n.includes('LOCK')) return '/uploads/products/image47.png';
    if (n.includes('CONNECTOR')) return '/uploads/products/image46.png';
    if (n.includes('SPYRAL') || n.includes('SPIRAL')) return '/uploads/products/image47.png';
    if (n.includes('EMERGENCY')) return '/uploads/products/image47.png';
    if (n.includes('SELECTOR SWITCH')) return '/uploads/products/image49.png';
    if (n.includes('R2NR')) return '/uploads/products/image47.png';
    if (n.includes('AW')) return '/uploads/products/image47.png';
    if (n.includes('A2V')) return '/uploads/products/image47.png';
    if (n.includes('FAN') || n.includes('COOLING')) return '/uploads/products/image48.png';
    if (n.includes('YELLOW A TO Z') || n.includes('SLIVE')) return '/uploads/products/image47.png';
    if (n.includes('METER') && n.includes('VOLTAGE')) return '/uploads/products/image48.png';
    if (n.includes('HTC')) return '/uploads/products/image52.png';
    if (n.includes('MECO') || n.includes('KUSUM')) return '/uploads/products/image52.png';
    if (n.includes('WIRE TAPE')) return '/uploads/products/image51.png';
    if (n.includes('CHANNEL PATTI')) return '/uploads/products/image53.png';
    if (n.includes('PLASTIC WIRE TRAY')) return '/uploads/products/image54.png';
    if (n.includes('3P2N') || n.includes('5P2N')) return '/uploads/products/image47.png';
    if (n.includes('PAKAD')) return '/uploads/products/image54.png';
    if (n.includes('RING') || n.includes('CIRCLE')) return '/uploads/products/image54.png';
    if (n.includes('F.T.I')) return '/uploads/products/image54.png';
  }

  return null;
}

async function importProducts() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully.');

    // 1. Find or create Admin user
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️ No Admin user found. Querying first user...');
      adminUser = await User.findOne({});
      if (!adminUser) {
        console.log('⚠️ Creating a default admin user...');
        adminUser = await User.create({
          name: 'Admin User',
          email: 'admin@vardhman.com',
          password: 'admin123',
          role: 'admin',
          phone: '+91 9998160084',
        });
      }
    }
    console.log(`👤 Mapped creator user: ${adminUser.name} (${adminUser.email})`);

    // 2. Clear existing products
    console.log('🗑️  Deleting all existing products from database...');
    const deleteRes = await Product.deleteMany({});
    console.log(`✅ Deleted ${deleteRes.deletedCount} products.`);

    // 3. Load Excel workbook
    const excelFilePath = path.join(__dirname, '../../client/src/Product_Details (1).xlsx');
    console.log(`📂 Reading Excel file from: ${excelFilePath}`);
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found at path: ${excelFilePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFilePath);

    const sheetMapping = {
      'Electrical': 'Electrical',
      'Hydrolic': 'Hydraulic',
      'Bearing': 'Bearing',
      'Consumable': 'Consumable'
    };

    let allProductsToInsert = [];

    // 4. Iterate over sheets
    for (const sheet of workbook.worksheets) {
      const category = sheetMapping[sheet.name];
      if (!category) {
        console.log(`⏭️ Skipping worksheet: "${sheet.name}"`);
        continue;
      }

      console.log(`📦 Processing sheet: "${sheet.name}" -> Category: "${category}"`);
      
      // Load all rows into memory first
      const rows = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 4) return; // Skip headers
        rows.push({
          rowNumber,
          colA: row.getCell(1).value, // SR.NO
          colB: row.getCell(2).value, // PRODUCT NAME
          colC: row.getCell(3).value, // QTY
        });
      });

      let sheetProductsCount = 0;
      let currentParent = null;

      for (let i = 0; i < rows.length; i++) {
        const current = rows[i];
        if (!current.colB) continue;

        // Clean name (strip leading and trailing dots/ellipses/spaces)
        let name = current.colB.toString().trim()
          .replace(/^[….\s]+/, '')
          .replace(/[….\s]+$/, '');

        // Skip blank dot placeholders
        if (!name || (name === 'MP' && current.colB.toString().includes('…'))) continue;

        const srNo = current.colA ? current.colA.toString().trim() : '';
        const { quantity, unit } = parseQtyAndUnit(current.colC);

        let finalName = name;
        let isStandAlone = false;

        if (sheet.name === 'Electrical') {
          if (srNo) {
            // Lookahead: does the next named row have no serial number?
            let hasChildren = false;
            for (let j = i + 1; j < rows.length; j++) {
              if (rows[j].colB) {
                const nextName = rows[j].colB.toString().trim();
                if (nextName && !nextName.startsWith('…') && !nextName.startsWith('.')) {
                  if (!rows[j].colA) {
                    hasChildren = true;
                  }
                  break;
                }
              }
            }

            if (hasChildren) {
              currentParent = name;
              // Group header: do not insert directly, its children will be prefixed
              continue;
            } else {
              // It is a standalone top-level product (e.g. MECO, A V Mix)
              currentParent = null;
              isStandAlone = true;
            }
          } else {
            // Child row: combine with current active parent
            finalName = currentParent ? `${currentParent} - ${name}` : name;
          }
        } else {
          isStandAlone = true;
        }

        const imagePath = getImageForProduct(finalName, category);

        allProductsToInsert.push({
          name: finalName,
          category,
          sellingPrice: 0,
          purchasePrice: 0,
          quantity,
          unit,
          description: `Imported from Excel - Sheet: ${sheet.name}, SR.NO: ${srNo || 'N/A'}`,
          reorderLevel: 10,
          createdBy: adminUser._id,
          status: 'active',
          image: imagePath || null
        });
        sheetProductsCount++;
      }

      console.log(`   Processed ${sheetProductsCount} items.`);
    }

    // 5. Bulk insert products
    console.log(`💾 Inserting ${allProductsToInsert.length} products into the database...`);
    const inserted = await Product.insertMany(allProductsToInsert);
    console.log(`🎉 Success! Successfully imported ${inserted.length} products.`);

    // 6. Category breakdown report
    const stats = {};
    let imagedCount = 0;
    inserted.forEach(p => {
      stats[p.category] = (stats[p.category] || 0) + 1;
      if (p.image) imagedCount++;
    });

    console.log('\n📊 Import breakdown by Category:');
    Object.keys(stats).forEach(cat => {
      console.log(`  - ${cat}: ${stats[cat]} products`);
    });
    console.log(`\n🖼  Products successfully mapped with images: ${imagedCount} of ${inserted.length}`);

    console.log('\n==================================================');
    console.log('✨ DATABASE RE-SEEDED WITH 100% COMPLETE EXCEL DATA & IMAGES! ✨');
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Excel Import error:', error.message);
    process.exit(1);
  }
}

importProducts();
