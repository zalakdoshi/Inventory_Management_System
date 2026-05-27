/**
 * Vardhman Family ERP — Excel Import Script
 * Run: node utils/importExcel.js
 * Clears existing products and imports new ones from d:\Inventory_Management_System\client\src\Product_Details (1).xlsx
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
  }

  return { quantity, unit };
}

async function importProducts() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully.');

    // 1. Find an Admin user to assign as creator
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️ No Admin user found. Querying first user...');
      adminUser = await User.findOne({});
      if (!adminUser) {
        console.log('⚠️ Creating a default admin user for product references...');
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

    // 2. Clear existing products (User requested "Remove the data and add the one in the sheet")
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
      'Hydrolic': 'Hydraulic', // correctly map 'Hydrolic' to 'Hydraulic'
      'Bearing': 'Bearing',
      'Consumable': 'Consumable'
    };

    let allProductsToInsert = [];

    // 4. Iterate over sheets
    for (const sheet of workbook.worksheets) {
      const category = sheetMapping[sheet.name];
      if (!category) {
        console.log(`⏭️ Skipping worksheet: "${sheet.name}" (not mapped)`);
        continue;
      }

      console.log(`📦 Processing sheet: "${sheet.name}" -> Category: "${category}"`);
      let sheetProductsCount = 0;

      // Rows 1, 2, 3 are headers. Iterate from Row 4 onwards.
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 4) return; // Skip headers

        const srNo = row.getCell(2).value; // Serial No is column B (2)
        const nameVal = row.getCell(3).value; // Product Name / Item is column C (3)
        const qtyVal = row.getCell(4).value; // Quantity is column D (4)

        if (!nameVal) return; // Skip empty row

        const name = nameVal.toString().trim();
        if (!name) return;

        const { quantity, unit } = parseQtyAndUnit(qtyVal);

        allProductsToInsert.push({
          name,
          category,
          sellingPrice: 0,
          purchasePrice: 0,
          quantity,
          unit,
          description: `Imported from Excel - Sheet: ${sheet.name}, SR.NO: ${srNo || 'N/A'}`,
          reorderLevel: 10,
          createdBy: adminUser._id,
          status: 'active'
        });
        sheetProductsCount++;
      });

      console.log(`   Processed ${sheetProductsCount} items.`);
    }

    // 5. Bulk insert products
    console.log(`💾 Inserting ${allProductsToInsert.length} products into the database...`);
    const inserted = await Product.insertMany(allProductsToInsert);
    console.log(`🎉 Success! Successfully imported ${inserted.length} products.`);

    // 6. Category breakdown report
    const stats = {};
    inserted.forEach(p => {
      stats[p.category] = (stats[p.category] || 0) + 1;
    });

    console.log('\n📊 Import breakdown by Category:');
    Object.keys(stats).forEach(cat => {
      console.log(`  - ${cat}: ${stats[cat]} products`);
    });

    console.log('\n==================================================');
    console.log('✨ DATABASE RE-SEEDED WITH EXCEL DATA SUCCESSFULLY! ✨');
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Excel Import error:', error.message);
    process.exit(1);
  }
}

importProducts();
