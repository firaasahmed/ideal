
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");


let baseFolder = __dirname;
if (process.versions && process.versions.electron) {
  if (!process.defaultApp && !/[\\/]electron[\\/]/.test(process.execPath) && !/[\\/]electron\.exe$/.test(process.execPath)) {
    baseFolder = path.dirname(process.execPath);
  }
}

const appFolder = path.join(baseFolder, "IdealPOS_Data");
if (!fs.existsSync(appFolder)) fs.mkdirSync(appFolder, { recursive: true });

const backupFolder = path.join(appFolder, "IdealPOS_Backups");
if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });

const dbPath = path.join(appFolder, "ideal-pos.sqlite");
let db;

let isReady = false;
let needsSave = false;

function runAutoBackup(dbBuffer, forceOverride) {
  if (!db) return { success: false };
  
  const d = new Date();
  const todayStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0]; 
  const timeStr = d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();

  const folderName = forceOverride ? "Backup_" + todayStr + "_" + timeStr : "Backup_" + todayStr;
  const todayBackupFolder = path.join(backupFolder, folderName);
  const sqliteBackupPath = path.join(todayBackupFolder, "ideal-pos-" + todayStr + ".sqlite");

  if (!forceOverride && fs.existsSync(sqliteBackupPath)) {
      return { success: true, localPath: todayBackupFolder };
  }

  try {
    if (!fs.existsSync(todayBackupFolder)) fs.mkdirSync(todayBackupFolder, { recursive: true });

    fs.writeFileSync(sqliteBackupPath, Buffer.from(dbBuffer));

    const tablesToExport = ["products", "variants", "sales", "stock_entries", "refunds", "discounts"];
    tablesToExport.forEach(function(tableName) {
      const res = db.exec("SELECT * FROM " + tableName);
      if (res.length > 0) {
        const headers = res[0].columns.join(",");
        const rows = res[0].values.map(function(row) {
          return row.map(function(val) {
            return val !== null ? '"' + String(val).replace(/"/g, '""') + '"' : '""';
          }).join(",");
        }).join("\n");
        const csvContent = headers + "\n" + rows;
        fs.writeFileSync(path.join(todayBackupFolder, tableName + "_" + todayStr + ".csv"), csvContent);
      }
    });

    if (typeof window !== "undefined" && window.localStorage) {
       const prettyTime = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
       window.localStorage.setItem('pos_last_backup', prettyTime);
       if (window.updateBackupStatus) window.updateBackupStatus();
    }

    return { success: true, localPath: todayBackupFolder };

  } catch (error) {
    console.error("[Backup Error]", error);
    return { success: false };
  }
}

function forceBackup() {
  if (!db) return { success: false };
  const dbData = db.export();
  return runAutoBackup(dbData, true);
}

function saveDatabase() {
  const dbData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(dbData));
  runAutoBackup(dbData, false);
}

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: function (file) {
      return path.join(__dirname, "node_modules", "sql.js", "dist", file);
    }
  });
  
  if (fs.existsSync(dbPath)) {
    const fileBuf = fs.readFileSync(dbPath);
    if (fileBuf.length > 0) {
      db = new SQL.Database(fileBuf);
    } else {
      db = new SQL.Database();
      needsSave = true;
    }
  } else {
    db = new SQL.Database();
    needsSave = true;
  }

  createTables();
  
  ensureInitTab();

  if (needsSave) {
    saveDatabase();
    needsSave = false;
  }
  isReady = true;
  return true;
}

function isDbReady() { return isReady; }

function createTables() {
  db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_sku TEXT UNIQUE NOT NULL, category TEXT DEFAULT 'Other', brand TEXT DEFAULT 'N/A', gender TEXT DEFAULT 'N/A', hsn TEXT DEFAULT '0000', gst TEXT DEFAULT '18%')");
  db.run("CREATE TABLE IF NOT EXISTS variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, attributes TEXT, sku TEXT UNIQUE NOT NULL, stock_qty INTEGER NOT NULL DEFAULT 0, mrp REAL DEFAULT 0, selling_price REAL NOT NULL, discount_id INTEGER DEFAULT NULL, moving_average_cost REAL DEFAULT 0, last_supplier TEXT DEFAULT 'Unknown', FOREIGN KEY (product_id) REFERENCES products(id))");
  db.run("CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL, subtotal REAL DEFAULT 0, grand_total REAL NOT NULL, total_discount REAL DEFAULT 0, cart_json TEXT NOT NULL, payment_method TEXT DEFAULT 'CASH', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'PAID')");
  db.run("CREATE TABLE IF NOT EXISTS parked_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, cart_json TEXT NOT NULL, is_active INTEGER DEFAULT 0, parked_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  db.run("CREATE TABLE IF NOT EXISTS discounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, value REAL NOT NULL)");
  db.run("CREATE TABLE IF NOT EXISTS refunds (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, refund_json TEXT NOT NULL, refund_total REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (sale_id) REFERENCES sales(id))");
  db.run("CREATE TABLE IF NOT EXISTS stock_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id INTEGER NOT NULL, supplier_name TEXT DEFAULT 'Unknown', qty_received INTEGER NOT NULL, unit_cost REAL NOT NULL, total_cost REAL NOT NULL, entry_date DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (variant_id) REFERENCES variants(id))");
}

function ensureInitTab() {
  const res = db.exec("SELECT COUNT(*) FROM parked_orders");
  if (res[0].values[0][0] === 0) {
    db.run("INSERT INTO parked_orders (cart_json, is_active) VALUES (?, 1)", [JSON.stringify({ items: [], discount: 0, phone: "" })]);
    needsSave = true;
  }
}

function getInventory() {
  if (!db) return [];
  const res = db.exec("SELECT v.id, p.name, v.sku, v.selling_price, v.stock_qty, v.discount_id, d.type, d.value, v.attributes, p.brand, COALESCE((SELECT unit_cost FROM stock_entries WHERE variant_id = v.id AND qty_received > 0 ORDER BY entry_date DESC, id DESC LIMIT 1), v.moving_average_cost), v.last_supplier FROM variants v JOIN products p ON v.product_id = p.id LEFT JOIN discounts d ON v.discount_id = d.id");
  if (res.length === 0) return [];
  return res[0].values.map(function(row) {
    let actPrice = row[3];
    if (row[5]) {
      if (row[6] === "PERCENT") actPrice = actPrice - actPrice * (row[7] / 100);
      if (row[6] === "FLAT") actPrice = Math.max(0, actPrice - row[7]);
    }
    let attrs = {};
    try { attrs = JSON.parse(row[8] || "{}"); } catch (e) {}
    let strParts = Object.values(attrs);
    let varName = strParts.length > 0 ? strParts.join(" - ") : "Standard";
    return { id: row[0], name: row[1], sku: row[2], price: actPrice, stock: row[4], originalPrice: row[3], attributes: attrs, variant: varName, brand: row[9], dbCost: row[10] || 0, supplier: row[11] || "Unknown" };
  });
}

function getDetailedInventory() {
  if (!db) return [];
  const pRes = db.exec("SELECT id, name, base_sku, category, brand, hsn, gst FROM products");
  if (pRes.length === 0) return [];
  const prodList = pRes[0].values.map(function(row) {
      return { id: row[0], name: row[1], sku: row[2], category: row[3], brand: row[4], hsn: row[5], gst: row[6], variants: [], mrp: 0, sp: 0, active_sp: 0, statusClass: "status-inactive", has_discounts: false };
  });

  const vRes = db.exec("SELECT v.id, v.product_id, v.attributes, v.sku, v.stock_qty, v.mrp, v.selling_price, v.discount_id, d.name, d.type, d.value, COALESCE((SELECT unit_cost FROM stock_entries WHERE variant_id = v.id AND qty_received > 0 ORDER BY entry_date DESC, id DESC LIMIT 1), v.moving_average_cost), v.last_supplier FROM variants v LEFT JOIN discounts d ON v.discount_id = d.id");
  if (vRes.length > 0) {
    vRes[0].values.forEach(function(row) {
      let attrs = {};
      try { attrs = JSON.parse(row[2] || "{}"); } catch (e) {}
      let strParts = Object.values(attrs);
      let varName = strParts.length > 0 ? strParts.join(" - ") : "Standard";

      const varItem = { id: row[0], product_id: row[1], attributes: attrs, variant_name: varName, sku: row[3], qty: row[4], mrp: row[5], sp: row[6], active_sp: row[6], discount_id: row[7], discount_name: row[8], discount_type: row[9], discount_value: row[10], dbCost: row[11] || 0, last_supplier: row[12] || "Unknown" };
      if (varItem.discount_id) {
        if (varItem.discount_type === "PERCENT") varItem.active_sp = varItem.sp - varItem.sp * (varItem.discount_value / 100);
        if (varItem.discount_type === "FLAT") varItem.active_sp = Math.max(0, varItem.sp - varItem.discount_value);
      }
      const parentProd = prodList.find(function(p) { return p.id === varItem.product_id; });
      if (parentProd) { parentProd.variants.push(varItem); if (varItem.discount_id) parentProd.has_discounts = true; }
    });
  }
  prodList.forEach(function(p) {
    if (p.variants.length > 0) {
      p.mrp = p.variants[0].mrp ? parseFloat(p.variants[0].mrp).toFixed(2) : parseFloat(p.variants[0].sp).toFixed(2);
      p.sp = parseFloat(p.variants[0].sp).toFixed(2);
      p.active_sp = parseFloat(p.variants[0].active_sp).toFixed(2);
    }
    p.statusClass = p.variants.reduce(function(sum, v) { return sum + v.qty; }, 0) > 0 ? (p.has_discounts ? "status-sale" : "status-active") : "status-inactive";
  });
  return prodList;
}

function getLiveStock(varId) {
  if (!db) return 0;
  const res = db.exec("SELECT stock_qty FROM variants WHERE id = " + varId);
  return res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0;
}

function getSuppliers() {
  if (!db) return [];
  try {
    const res = db.exec("SELECT DISTINCT supplier_name FROM stock_entries WHERE supplier_name IS NOT NULL AND supplier_name != 'Unknown' AND supplier_name != 'Initial Stock'");
    if (res.length === 0) return [];
    return res[0].values.map(function(row) { return row[0]; });
  } catch (e) { return []; }
}

function getStockLedger() {
  if (!db) return [];
  const vRes = db.exec("SELECT v.id, p.name, v.attributes, v.sku, v.stock_qty, COALESCE((SELECT unit_cost FROM stock_entries WHERE variant_id = v.id AND qty_received > 0 ORDER BY entry_date DESC, id DESC LIMIT 1), v.moving_average_cost), p.brand FROM variants v JOIN products p ON v.product_id = p.id");
  if (vRes.length === 0) return [];

  const variants = vRes[0].values.map(function(row) {
    let attrs = {};
    try { attrs = JSON.parse(row[2] || "{}"); } catch (e) {}
    let strParts = Object.values(attrs);
    let varName = strParts.length > 0 ? strParts.join(" - ") : "Standard";

    return { id: row[0], name: row[1], variant: varName, sku: row[3], current_stock: row[4], mac: row[5] || 0, brand: row[6], entries: [] };
  });

  const eRes = db.exec("SELECT id, variant_id, supplier_name, qty_received, unit_cost, total_cost, datetime(entry_date, 'localtime') as dt, date(entry_date, 'localtime') as pure_date FROM stock_entries ORDER BY entry_date DESC");

  if (eRes.length > 0) {
    eRes[0].values.forEach(function(r) {
      let vid = r[1];
      let vMatch = variants.find(function(v) { return v.id === vid; });
      if (vMatch) { vMatch.entries.push({ id: r[0], variant_id: r[1], supplier: r[2], qty: r[3], cost: r[4], total: r[5], date: r[6], pure_date: r[7] }); }
    });
  }
  return variants.filter(function(v) { return v.entries.length > 0; });
}

function getDeliveryDates() {
  if (!db) return [];
  const res = db.exec("SELECT DISTINCT date(entry_date, 'localtime') FROM stock_entries WHERE qty_received > 0 ORDER BY entry_date DESC");
  return res.length > 0 ? res[0].values.map(function(r) { return r[0]; }) : [];
}

function getEntriesByDate(dateStr) {
  if (!db) return [];
  const res = db.exec("SELECT e.id, e.variant_id, p.name, v.sku, e.supplier_name, e.qty_received, e.unit_cost, v.attributes FROM stock_entries e JOIN variants v ON e.variant_id = v.id JOIN products p ON v.product_id = p.id WHERE date(e.entry_date, 'localtime') = '" + dateStr + "' AND e.qty_received > 0");
  if (res.length === 0) return [];
  return res[0].values.map(function(r) {
    let attrs = {};
    try { attrs = JSON.parse(r[7] || "{}"); } catch (e) {}
    let varName = Object.values(attrs).join(" - ") || "Standard";
    return { entryId: r[0], vid: r[1], name: r[2], sku: r[3], supplier: r[4], qtyReceived: r[5], cost: r[6], variant: varName };
  });
}

function getVariantDeliveries(vid) {
  if (!db) return [];
  const res = db.exec("SELECT id, supplier_name, unit_cost, qty_received, datetime(entry_date, 'localtime') as dt FROM stock_entries WHERE variant_id = " + vid + " AND qty_received > 0 ORDER BY entry_date DESC");
  if (res.length === 0) return [];
  return res[0].values.map(function(r) { return { id: r[0], supplier: r[1], cost: r[2], qty: r[3], date: r[4] }; });
}

function addProduct(prodData, varList) {
  if (!db) throw new Error("Database not initialized");
  db.run("INSERT INTO products (name, base_sku, category, brand, hsn, gst) VALUES (?, ?, ?, ?, ?, ?)", [prodData.name, prodData.base_sku, prodData.category, prodData.brand, prodData.hsn, prodData.gst]);
  const prodId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  varList.forEach(function(v) {
    let attrs = typeof v.attributes === "object" ? JSON.stringify(v.attributes) : v.attributes || "{}";
    let costPrice = v.cost || 0;
    let suppName = v.supplier || "Initial Stock";
    db.run("INSERT INTO variants (product_id, attributes, sku, stock_qty, mrp, selling_price, moving_average_cost, last_supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [prodId, attrs, v.sku, v.qty, v.mrp, v.sp, costPrice, suppName]);
    if (v.qty > 0) {
      const varId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      const totalCost = v.qty * costPrice;
      db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)", [varId, suppName, v.qty, costPrice, totalCost]);
    }
  });
  saveDatabase();
  return prodId;
}

function addVariant(prodId, attrData, fullSku, stockQty, mrpVal, spVal, costVal, supplierName, entryDateStr) {
  costVal = costVal || 0;
  supplierName = supplierName || "Unknown";
  if (!db) return;
  let attrs = typeof attrData === "object" ? JSON.stringify(attrData) : attrData || "{}";
  db.run("INSERT INTO variants (product_id, attributes, sku, stock_qty, mrp, selling_price, moving_average_cost, last_supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [prodId, attrs, fullSku, stockQty, mrpVal, spVal, costVal, supplierName]);
  if (stockQty > 0) {
    const varId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    const totalCost = stockQty * costVal;
    if (entryDateStr) {
      db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost, entry_date) VALUES (?, ?, ?, ?, ?, ?)", [varId, supplierName, stockQty, costVal, totalCost, entryDateStr + " 12:00:00"]);
    } else {
      db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)", [varId, supplierName, stockQty, costVal, totalCost]);
    }
  }
  saveDatabase();
}

function updateVariants(updateList) {
  if (!db || updateList.length === 0) return;
  updateList.forEach(function(u) {
    let setQueries = [];
    let queryParams = [];

    const res = db.exec("SELECT stock_qty, moving_average_cost, last_supplier FROM variants WHERE id = " + u.id);
    let oldQty = 0; let oldCost = 0; let oldSupplier = "Unknown";
    if (res.length > 0 && res[0].values.length > 0) {
      oldQty = parseInt(res[0].values[0][0]) || 0;
      oldCost = parseFloat(res[0].values[0][1]) || 0;
      oldSupplier = res[0].values[0][2] || "Unknown";
    }

    let newQty = u.qty !== undefined ? parseInt(u.qty) : oldQty;
    let diff = newQty - oldQty;

    if (diff > 0) {
      let costVal = u.supplier_cost !== undefined && u.supplier_cost !== 0 && !isNaN(u.supplier_cost) ? parseFloat(u.supplier_cost) : oldCost;
      let suppName = u.supplier_name !== undefined && u.supplier_name.trim() !== "" ? u.supplier_name : oldSupplier;
      let eDate = u.entry_date ? u.entry_date + " 12:00:00" : null;
      let totalCost = diff * costVal;

      if (eDate) {
        db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost, entry_date) VALUES (?, ?, ?, ?, ?, ?)", [u.id, suppName, diff, costVal, totalCost, eDate]);
      } else {
        db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)", [u.id, suppName, diff, costVal, totalCost]);
      }

      setQueries.push("moving_average_cost = ?"); queryParams.push(costVal);
      setQueries.push("last_supplier = ?"); queryParams.push(suppName);
    }

    if (u.qty !== undefined) { setQueries.push("stock_qty = ?"); queryParams.push(u.qty); }
    if (u.mrp !== undefined) { setQueries.push("mrp = ?"); queryParams.push(u.mrp); }
    if (u.sp !== undefined) { setQueries.push("selling_price = ?"); queryParams.push(u.sp); }
    if (u.attributes !== undefined) { setQueries.push("attributes = ?"); queryParams.push(typeof u.attributes === "object" ? JSON.stringify(u.attributes) : u.attributes); }
    if (u.sku !== undefined) { setQueries.push("sku = ?"); queryParams.push(u.sku); }

    if (setQueries.length > 0) {
      queryParams.push(u.id);
      db.run("UPDATE variants SET " + setQueries.join(", ") + " WHERE id = ?", queryParams);
    }
  });
  saveDatabase();
}

function deleteItems(itemIds, targetType) {
  targetType = targetType || "product";
  if (!db || !itemIds || itemIds.length === 0) return;
  const placeholders = itemIds.map(function() { return "?"; }).join(",");

  if (targetType === "variant") {
    db.run("DELETE FROM stock_entries WHERE variant_id IN (" + placeholders + ")", itemIds);
    db.run("DELETE FROM variants WHERE id IN (" + placeholders + ")", itemIds);
  } else {
    const vRes = db.exec("SELECT id FROM variants WHERE product_id IN (" + placeholders + ")", itemIds);
    if (vRes.length > 0 && vRes[0].values.length > 0) {
      const vIds = vRes[0].values.map(function(r) { return r[0]; });
      if (vIds.length > 0) {
        const vPlaceholders = vIds.map(function() { return "?"; }).join(",");
        db.run("DELETE FROM stock_entries WHERE variant_id IN (" + vPlaceholders + ")", vIds);
      }
    }
    db.run("DELETE FROM variants WHERE product_id IN (" + placeholders + ")", itemIds);
    db.run("DELETE FROM products WHERE id IN (" + placeholders + ")", itemIds);
  }
  saveDatabase();
}

function returnToSupplier(variantId, supplierName, returnQty, unitCost) {
  if (!db) return false;
  let qty = -Math.abs(returnQty);
  let totalCost = qty * unitCost;
  db.run("INSERT INTO stock_entries (variant_id, supplier_name, qty_received, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)", [variantId, supplierName, qty, unitCost, totalCost]);

  const res = db.exec("SELECT stock_qty, moving_average_cost FROM variants WHERE id = " + variantId);
  if (res.length > 0 && res[0].values.length > 0) {
    let oldQty = parseInt(res[0].values[0][0]) || 0;
    let oldCost = parseFloat(res[0].values[0][1]) || 0;
    let newQty = oldQty + qty;
    let newMac = oldCost;
    if (newQty > 0) {
      let oldTotalValue = oldQty * oldCost;
      let returnedValue = Math.abs(qty) * unitCost;
      let newTotalValue = Math.max(0, oldTotalValue - returnedValue);
      newMac = newTotalValue / newQty;
    }
    db.run("UPDATE variants SET stock_qty = ?, moving_average_cost = ? WHERE id = ?", [newQty, newMac, variantId]);
  }
  return true;
}

function processBatchReturn(returnList) {
  if (!db) return false;
  returnList.forEach(function(item) { returnToSupplier(item.vid, item.supplier, item.returnQty, item.cost); });
  saveDatabase();
  return true;
}

function saveTabToDb(tabId, itemList, discVal, phoneNum) {
  discVal = discVal || 0;
  phoneNum = phoneNum || "";
  const jsonData = JSON.stringify({ items: itemList, discount: discVal, phone: phoneNum });
  if (tabId) {
    db.run("UPDATE parked_orders SET cart_json = ? WHERE id = ?", [jsonData, tabId]);
  } else {
    db.run("UPDATE parked_orders SET is_active = 0");
    db.run("INSERT INTO parked_orders (cart_json, is_active) VALUES (?, 1)", [jsonData]);
    tabId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  }
  saveDatabase();
  return tabId;
}

function getParkedOrders() {
  if (!db) return [];
  const res = db.exec("SELECT id, cart_json, is_active, time(parked_at, 'localtime') as time FROM parked_orders ORDER BY id ASC");
  return res.length === 0 ? [] : res[0].values.map(function(row) { return { id: row[0], cart_json: row[1], is_active: row[2], time: row[3] }; });
}

function deleteParkedOrder(tabId) {
  db.run("DELETE FROM parked_orders WHERE id = ?", [tabId]);
  const actCount = db.exec("SELECT COUNT(*) FROM parked_orders WHERE is_active = 1");
  if (actCount[0].values[0][0] === 0) {
    const nxtTab = db.exec("SELECT id FROM parked_orders LIMIT 1");
    if (nxtTab.length > 0) db.run("UPDATE parked_orders SET is_active = 1 WHERE id = ?", [nxtTab[0].values[0][0]]);
  }
  ensureInitTab();
  saveDatabase();
}

function setActiveTab(tabId) {
  if (!db) return;
  db.run("UPDATE parked_orders SET is_active = 0");
  db.run("UPDATE parked_orders SET is_active = 1 WHERE id = ?", [tabId]);
  saveDatabase();
}

function processSale(cartObj, payMethod, tenderAmt) {
  if (!db) throw new Error("Database not initialized");
  let nextSeq = 1;
  try {
    const seqData = db.exec("SELECT seq FROM sqlite_sequence WHERE name='sales'");
    if (seqData.length > 0 && seqData[0].values.length > 0 && seqData[0].values[0][0] !== null) {
      nextSeq = seqData[0].values[0][0] + 1;
    } else {
      const maxData = db.exec("SELECT MAX(id) FROM sales");
      nextSeq = (maxData.length > 0 && maxData[0].values.length > 0 && maxData[0].values[0][0] !== null ? maxData[0].values[0][0] : 0) + 1;
    }
  } catch (e) {
    const maxData = db.exec("SELECT MAX(id) FROM sales");
    nextSeq = (maxData.length > 0 && maxData[0].values.length > 0 && maxData[0].values[0][0] !== null ? maxData[0].values[0][0] : 0) + 1;
  }
  const orderStr = "ORD-" + String(nextSeq).padStart(4, "0");
  const cartJson = JSON.stringify(cartObj);
  const subTot = parseFloat(cartObj.total || 0) + parseFloat(cartObj.discount || 0);
  db.run("INSERT INTO sales (order_number, subtotal, grand_total, total_discount, cart_json, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [orderStr, subTot, cartObj.total, cartObj.discount, cartJson, payMethod, "PAID"]);
  const recId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  cartObj.items.forEach(function(i) {
    db.run("UPDATE variants SET stock_qty = stock_qty - ? WHERE id = ?", [i.qty, i.id]);
  });
  saveDatabase();
  return recId;
}

function getRecentSales() {
  if (!db) return [];
  const res = db.exec("SELECT id, order_number, grand_total, payment_method, datetime(created_at, 'localtime') as dt, status, cart_json FROM sales ORDER BY id DESC LIMIT 50");
  if (res.length === 0) return [];
  return res[0].values.map(function(row) {
    const recId = row[0]; let refMap = {};
    try {
      const refData = db.exec("SELECT refund_json FROM refunds WHERE sale_id = " + recId);
      if (refData.length > 0) {
        refData[0].values.forEach(function(r) {
          try { let parsedRef = JSON.parse(r[0]); parsedRef.forEach(function(ri) { refMap[ri.id] = (refMap[ri.id] || 0) + ri.refundQty; }); } catch (e) {}
        });
      }
    } catch (e) {}
    return { id: row[0], order_number: row[1], grand_total: row[2], payment_method: row[3], datetime: row[4], status: row[5] || "PAID", cart_json: row[6], refunded_map: refMap };
  });
}

function getSaleReceipt(recId) {
  if (!db) return null;
  const res = db.exec("SELECT order_number, grand_total, total_discount, cart_json, payment_method, datetime(created_at, 'localtime') as dt, status FROM sales WHERE id = " + recId);
  if (res.length === 0 || res[0].values.length === 0) return null;
  const rowData = res[0].values[0];
  let refMap = {}; let refList = [];
  const refRes = db.exec("SELECT refund_json, refund_total, datetime(created_at, 'localtime') FROM refunds WHERE sale_id = " + recId);
  if (refRes.length > 0) {
    refRes[0].values.forEach(function(r) {
      try {
        let parsedRef = JSON.parse(r[0]); refList.push({ items: parsedRef, total: r[1], date: r[2] });
        parsedRef.forEach(function(ri) { refMap[ri.id] = (refMap[ri.id] || 0) + ri.refundQty; });
      } catch (e) {}
    });
  }
  return { order_number: rowData[0], grand_total: rowData[1], total_discount: rowData[2], cart_json: JSON.parse(rowData[3]), payment_method: rowData[4], datetime: rowData[5], status: rowData[6] || "PAID", refunded_map: refMap, refunds_list: refList };
}

function processRefund(recId, refItems, refAmount, nextStatus, doRestock) {
  if (!db) return false;
  db.run("INSERT INTO refunds (sale_id, refund_json, refund_total) VALUES (?, ?, ?)", [recId, JSON.stringify(refItems), refAmount]);
  db.run("UPDATE sales SET status = ? WHERE id = ?", [nextStatus, recId]);
  if (doRestock) {
    refItems.forEach(function(i) {
      if (i.refundQty > 0) { db.run("UPDATE variants SET stock_qty = stock_qty + ? WHERE id = ?", [i.refundQty, i.id]); }
    });
  }
  saveDatabase();
  return true;
}

function deleteSale(recId) {
  if (!db) return false;
  db.run("DELETE FROM refunds WHERE sale_id = ?", [recId]);
  db.run("DELETE FROM sales WHERE id = ?", [recId]);
  saveDatabase();
  return true;
}

function getDiscounts() {
  const res = db.exec("SELECT id, name, type, value FROM discounts");
  return res.length === 0 ? [] : res[0].values.map(function(row) { return { id: row[0], name: row[1], type: row[2], value: row[3] }; });
}

function addDiscount(name, type, valData) {
  if (!db) return;
  db.run("INSERT INTO discounts (name, type, value) VALUES (?, ?, ?)", [name, type, valData]);
  saveDatabase();
}

function deleteDiscount(discId) {
  if (!db) return;
  db.run("DELETE FROM discounts WHERE id = ?", [discId]);
  db.run("UPDATE variants SET discount_id = NULL WHERE discount_id = ?", [discId]);
  saveDatabase();
}

function setDiscount(discId, itemIds, targetType) {
  targetType = targetType || "product";
  if (!db || !itemIds || itemIds.length === 0) return;
  const placeholders = itemIds.map(function() { return "?"; }).join(",");
  const colName = targetType === "variant" ? "id" : "product_id";
  db.run("UPDATE variants SET discount_id = ? WHERE " + colName + " IN (" + placeholders + ")", [discId].concat(itemIds));
  saveDatabase();
}

module.exports = {
  initDatabase, saveDatabase, isDbReady, getInventory, getDetailedInventory, getLiveStock,
  getSuppliers, getStockLedger, returnToSupplier, getDeliveryDates, getEntriesByDate, processBatchReturn, getVariantDeliveries,
  addProduct, addVariant, updateVariants, deleteItems, getDiscounts, addDiscount, setDiscount, deleteDiscount,
  saveTabToDb, getParkedOrders, deleteParkedOrder, setActiveTab, processSale, getRecentSales, getSaleReceipt, processRefund, deleteSale, forceBackup
};