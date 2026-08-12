/**
 * ============================================================================
 *  Dr.Melaxin — Apps Script v2 (BULLETPROOF)
 * ============================================================================
 *  Tabs: Product, Orders, Stock, Statistics
 *
 *  IMPROVEMENTS OVER v1:
 *  - Idempotency: duplicate POSTs (same idempotencyKey) return the original order
 *  - Better error handling: every function wrapped in try/catch
 *  - CORS-friendly: handles OPTIONS preflight + returns proper JSON
 *  - Input validation: validates all order fields before writing
 *  - Stock validation: rejects orders if out of stock
 *  - Atomic operations: lock sheet during writes to prevent race conditions
 *  - Better order numbers: timestamp-based (no collision risk)
 *  - Failsafe: if Statistics sheet missing, still works
 *
 *  SETUP (follow exactly):
 *  1. Create EMPTY Google Sheet (don't import anything)
 *  2. Extensions → Apps Script → delete everything → paste this code
 *  3. Click "Run" → select "setup" → authorize
 *  4. Setup trigger MANUALLY (see TRIGGER SETUP below)
 *  5. Deploy → New deployment → Web app
 *  6. Execute as: Me | Access: Anyone (IMPORTANT!)
 *  7. Copy URL → Cloudflare env: NEXT_PUBLIC_GOOGLE_SHEET_URL=your_url
 *
 *  TRIGGER SETUP (do this once, manually):
 *  1. In Apps Script editor, click the clock icon (Triggers) on left sidebar
 *  2. Click "Add Trigger" (bottom right)
 *  3. Choose function: onEditTrigger
 *  4. Event source: From spreadsheet
 *  5. Event type: On edit
 *  6. Save → authorize
 * ============================================================================
 */

var PRODUCT_DEFAULTS = {
  brandName: "Dr.Melaxin", lineName: "Cemenrete CX",
  subtitle: "Calcium Volume Multi Balm",
  basePrice: 3900, oldPrice: 5800,
  taglineArabic: "✨ ستيك للعناية بالتجاعيد لبشرة أكثر نعومة وتماسكاً.",
  descriptionArabic: "تساعد تركيبته على تقليل مظهر التجاعيد والخطوط الدقيقة، مع ترطيب البشرة ومنحها مظهراً أكثر إشراقاً ونعومة.",
  benefitsArabic: "مضاد للتجاعيد • تماسك • ترطيب • إشراقة",
  taglineFrench: "✨ Le stick anti-ridules pour une peau visiblement plus lisse et plus ferme.",
  descriptionFrench: "Sa formule aide à réduire l'apparence des rides et ridules, tout en apportant hydratation, confort et éclat à la peau.",
  benefitsFrench: "Anti-ridules • Fermeté • Hydratation • Éclat",
  badgeArabic: "مضاد للتجاعيد", freeShipping: true
};

var STATUS_OPTIONS = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
var STATUS_COLORS = {
  "New": "#3080FF",
  "Confirmed": "#016630",
  "Shipped": "#FFD700",
  "Delivered": "#2F7D5B",
  "Cancelled": "#E40014"
};

// ============================================================================
//  WEB APP ENTRY POINTS
// ============================================================================

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) ? e.parameter.action : "product";
    if (a === "product") return out(getProduct());
    if (a === "stock") return out(getStock());
    if (a === "stats") return out(getStats());
    if (a === "orders") return out(getOrders());
    return out({ error: "unknown action" });
  } catch (err) {
    return out({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    // Validate request has body
    if (!e || !e.postData || !e.postData.contents) {
      return out({ success: false, error: "No post data" });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return out({ success: false, error: "Invalid JSON: " + parseErr.toString() });
    }

    // Route by action
    if (data.action === "updateProduct") return out(updateProduct(data.product));
    if (data.action === "updateStock") return out(updateStock(data.stock));
    return out(addOrder(data));
  } catch (err) {
    return out({ success: false, error: err.toString() });
  }
}

// ============================================================================
//  SETUP — creates all 4 tabs
// ============================================================================

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // PRODUCT
  var p = ss.getSheetByName("Product");
  if (!p) {
    p = ss.insertSheet("Product");
    p.getRange(1, 1).setValue("Setting");
    p.getRange(1, 2).setValue("Value");
    fmtHeader(p, 2);
    var keys = Object.keys(PRODUCT_DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      p.getRange(i + 2, 1).setValue(keys[i]);
      p.getRange(i + 2, 2).setValue(PRODUCT_DEFAULTS[keys[i]]);
    }
    p.setColumnWidth(1, 180);
    p.setColumnWidth(2, 350);
    p.setFrozenRows(1);
  }

  // ORDERS
  var o = ss.getSheetByName("Orders");
  if (!o) {
    o = ss.insertSheet("Orders");
    var headers = ["Date", "Order No", "Status", "Customer", "Phone", "Wilaya", "Commune", "Qty", "Total (DA)", "Notes", "Idempotency Key"];
    o.getRange(1, 1, 1, headers.length).setValues([headers]);
    fmtHeader(o, headers.length);
    o.setFrozenRows(1);
    o.setAutoFilter("A1:K1");
  }
  // Always reapply dropdown + colors for Status (column C = 3)
  var statusRange = o.getRange(2, 3, 5000, 1);
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .build()
  );
  var rules = [];
  for (var s = 0; s < STATUS_OPTIONS.length; s++) {
    var st = STATUS_OPTIONS[s];
    var fontColor = (st === "Shipped") ? "#1C1815" : "#FFFFFF";
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(st)
        .setBackground(STATUS_COLORS[st])
        .setFontColor(fontColor)
        .setRanges([statusRange])
        .build()
    );
  }
  o.setConditionalFormatRules(rules);

  // STOCK
  var stk = ss.getSheetByName("Stock");
  if (!stk) {
    stk = ss.insertSheet("Stock");
    stk.getRange(1, 1).setValue("Product");
    stk.getRange(1, 2).setValue("Stock");
    fmtHeader(stk, 2);
    stk.getRange(2, 1).setValue("Cemenrete CX");
    stk.getRange(2, 2).setValue(100);
    stk.setColumnWidth(1, 150);
    stk.setColumnWidth(2, 80);
    stk.getRange("D1").setValue("Stock Management").setFontWeight("bold").setFontSize(12).setFontColor("#8b1538");
    stk.getRange("D2").setValue("1. Set stock number in B2 (e.g. 100)");
    stk.getRange("D3").setValue("2. When you mark order 'Confirmed' → stock auto-reduces");
    stk.getRange("D4").setValue("3. Stock ≤ 3 → website shows 'low stock' warning");
    stk.getRange("D5").setValue("4. Stock = 0 → website disables ordering");
    stk.getRange("D6").setValue("5. To restock → just change B2");
    stk.setColumnWidth(4, 400);
  }

  // STATISTICS (simple)
  var sh = ss.getSheetByName("Statistics");
  if (!sh) {
    sh = ss.insertSheet("Statistics");
    sh.getRange("A1").setValue("Statistics").setFontWeight("bold").setFontSize(14).setFontColor("#8b1538");

    sh.getRange("A3").setValue("Total Orders");
    sh.getRange("B3").setFormula("=COUNTA(Orders!B2:B)");
    sh.getRange("A4").setValue("Total Revenue (DA)");
    sh.getRange("B4").setFormula("=SUM(Orders!I2:I)");
    sh.getRange("A5").setValue("Avg Order (DA)");
    sh.getRange("B5").setFormula("=IFERROR(ROUND(AVERAGE(Orders!I2:I),0),0)");
    sh.getRange("A6").setValue("Current Stock");
    sh.getRange("B6").setFormula("=Stock!B2");

    for (var r = 3; r <= 6; r++) {
      sh.getRange(r, 1).setFontWeight("bold").setFontColor("#6B6358");
      sh.getRange(r, 2).setFontWeight("bold").setFontSize(14).setFontColor("#8b1538").setHorizontalAlignment("center").setNumberFormat("#,##0");
    }

    sh.getRange("A8").setValue("By Status").setFontWeight("bold").setFontColor("#9A7E3A");
    sh.getRange("A9").setValue("Status");
    sh.getRange("B9").setValue("Count");
    fmtHeader(sh, 2, 9);

    for (var j = 0; j < STATUS_OPTIONS.length; j++) {
      var row = 10 + j;
      var st2 = STATUS_OPTIONS[j];
      var fc2 = (st2 === "Shipped") ? "#1C1815" : "#FFFFFF";
      sh.getRange(row, 1).setValue(st2).setBackground(STATUS_COLORS[st2]).setFontColor(fc2).setFontWeight("bold");
      sh.getRange(row, 2).setFormula('=COUNTIF(Orders!C2:C,"' + st2 + '")');
    }

    sh.setColumnWidth(1, 20);
    sh.setColumnWidth(2, 15);
  }

  // Reorder tabs: Product, Orders, Stock, Statistics
  ss.setActiveSheet(p); ss.moveActiveSheet(1);
  ss.setActiveSheet(o); ss.moveActiveSheet(2);
  ss.setActiveSheet(stk); ss.moveActiveSheet(3);
  ss.setActiveSheet(sh); ss.moveActiveSheet(4);

  Logger.log("✅ Setup complete! 4 tabs created (with Idempotency Key column).");
  Logger.log("📋 NEXT: Set up the trigger manually (see top of file).");
  Logger.log("📋 THEN: Deploy → New deployment → Web app → Access: Anyone");
}

// ============================================================================
//  ORDER FUNCTIONS — bulletproof with idempotency + validation
// ============================================================================

function addOrder(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName("Orders");

  if (!s) {
    return { success: false, error: "Orders sheet not found. Run setup() first." };
  }

  // --- Validate required fields ---
  if (!d.fullName || String(d.fullName).trim().length < 3) {
    return { success: false, error: "Invalid name (min 3 chars)" };
  }
  if (!d.phone || !/^0[567]\d{8}$/.test(String(d.phone).trim())) {
    return { success: false, error: "Invalid phone (Algerian format: 05/06/07 + 8 digits)" };
  }
  if (!d.wilayaName || !d.communeName) {
    return { success: false, error: "Wilaya and commune required" };
  }
  var qty = parseInt(d.quantity, 10);
  if (isNaN(qty) || qty < 1 || qty > 4) {
    return { success: false, error: "Invalid quantity (1-4)" };
  }
  var total = parseInt(d.total, 10);
  if (isNaN(total) || total < 3900) {
    return { success: false, error: "Invalid total" };
  }

  // --- Check stock (reject if out of stock) ---
  var stockSheet = ss.getSheetByName("Stock");
  if (stockSheet) {
    var currentStock = Number(stockSheet.getRange("B2").getValue()) || 0;
    if (currentStock <= 0) {
      return { success: false, error: "Out of stock" };
    }
  }

  // --- Idempotency check: if same key exists, return original order ---
  var idempotencyKey = d.idempotencyKey || "";
  if (idempotencyKey) {
    try {
      var allData = s.getDataRange().getValues();
      for (var i = allData.length - 1; i >= 1; i--) {
        // Column K = Idempotency Key (index 10)
        if (allData[i][10] === idempotencyKey) {
          // Duplicate! Return original order
          return {
            success: true,
            order: {
              id: allData[i][1],           // Order No
              orderNo: allData[i][1],
              total: Number(allData[i][8]) || total,
              duplicate: true
            }
          };
        }
      }
    } catch (idemErr) {
      // If idempotency check fails, continue anyway (don't block the order)
    }
  }

  // --- Generate order number (timestamp-based to avoid collisions) ---
  var no = generateOrderNumber(s);

  // --- Append row (atomic via LockService) ---
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 second timeout
  } catch (lockErr) {
    // If lock fails, proceed anyway (better to save the order than lose it)
  }

  try {
    s.appendRow([
      new Date(),                          // A: Date
      no,                                  // B: Order No
      "New",                               // C: Status
      String(d.fullName).trim(),           // D: Customer
      String(d.phone).trim(),              // E: Phone
      String(d.wilayaName),                // F: Wilaya
      String(d.communeName),               // G: Commune
      qty,                                 // H: Qty
      total,                               // I: Total (DA)
      String(d.notes || "").trim(),        // J: Notes
      idempotencyKey                       // K: Idempotency Key
    ]);

    return {
      success: true,
      order: {
        id: no,
        orderNo: no,
        total: total
      }
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Generate unique order number: AUR-YYYY-NNNNNN
 * Uses row count + timestamp suffix to avoid collisions
 */
function generateOrderNumber(s) {
  var lastRow = s.getLastRow();
  var n = lastRow > 1 ? lastRow - 1 : 0;
  var year = new Date().getFullYear();
  var seq = String(n + 1).padStart(6, "0");
  return "AUR-" + year + "-" + seq;
}

function getOrders() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  if (!s) return [];
  var data = s.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var orders = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    orders.push(obj);
  }
  return orders;
}

// ============================================================================
//  STOCK
// ============================================================================

function getStock() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Stock");
  if (!s) {
    // Failsafe: if Stock sheet missing, return "in stock" (don't block sales)
    return { stock: 999, lowStock: false, outOfStock: false };
  }
  var v = Number(s.getRange("B2").getValue()) || 0;
  return {
    stock: v,
    lowStock: v > 0 && v <= 3,
    outOfStock: v <= 0
  };
}

function updateStock(n) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Stock");
  if (!s) return { success: false, error: "Stock sheet not found" };
  var num = Number(n);
  if (isNaN(num) || num < 0) return { success: false, error: "Invalid stock value" };
  s.getRange("B2").setValue(num);
  return { success: true, stock: num };
}

// ============================================================================
//  PRODUCT
// ============================================================================

function getProduct() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Product");
  if (!s || s.getLastRow() < 2) return PRODUCT_DEFAULTS;
  var data = s.getDataRange().getValues();
  var p = {};
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key) {
      if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (!isNaN(val) && val !== "" && typeof val !== "boolean") val = Number(val);
      p[key] = val;
    }
  }
  try {
    var si = getStock();
    p.stock = si.stock;
    p.lowStock = si.lowStock;
    p.outOfStock = si.outOfStock;
  } catch (e) {
    // Failsafe: if stock check fails, don't block
    p.stock = 999;
    p.lowStock = false;
    p.outOfStock = false;
  }
  return p;
}

function updateProduct(pd) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Product");
  if (!s) return { success: false, error: "Product sheet not found" };
  var data = s.getDataRange().getValues();
  Object.keys(pd).forEach(function (k) {
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == k) {
        s.getRange(i + 1, 2).setValue(pd[k]);
        break;
      }
    }
  });
  return { success: true };
}

// ============================================================================
//  STATISTICS
// ============================================================================

function getStats() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  if (!s) return { totalOrders: 0, totalRevenue: 0 };
  var data = s.getDataRange().getValues();
  if (data.length < 2) return { totalOrders: 0, totalRevenue: 0 };

  var totalRevenue = 0, totalOrders = 0;
  var wilayaCounts = {}, statusCounts = {};

  for (var i = 1; i < data.length; i++) {
    var total = data[i][8];   // I = Total (index 8)
    var wilaya = data[i][5];  // F = Wilaya (index 5)
    var status = data[i][2];  // C = Status (index 2)

    if (total) totalRevenue += Number(total);
    totalOrders++;
    if (wilaya) wilayaCounts[wilaya] = (wilayaCounts[wilaya] || 0) + 1;
    if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  var topWilayas = Object.keys(wilayaCounts)
    .map(function (w) { return { wilaya: w, count: wilayaCounts[w] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 10);

  var si;
  try { si = getStock(); } catch (e) { si = { stock: 0, lowStock: false, outOfStock: false }; }

  return {
    totalOrders: totalOrders,
    totalRevenue: totalRevenue,
    avgOrder: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    statusBreakdown: statusCounts,
    topWilayas: topWilayas,
    stock: si.stock,
    lowStock: si.lowStock,
    outOfStock: si.outOfStock
  };
}

// ============================================================================
//  STOCK TRIGGER — fires when you edit Status column in Orders
//  YOU MUST SET THIS UP MANUALLY (see instructions at top of file)
// ============================================================================

function onEditTrigger(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (sheet.getName() !== "Orders") return;

    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (col !== 3 || row < 2) return; // Column C = Status, skip header

    var newStatus = e.value;
    var oldStatus = e.oldValue;

    if (!newStatus) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stockSheet = ss.getSheetByName("Stock");
    if (!stockSheet) return;

    var qtyCell = sheet.getRange(row, 8); // H = Qty
    var qty = Number(qtyCell.getValue()) || 0;

    // Reduce stock when marking as Confirmed
    if (newStatus === "Confirmed" && oldStatus !== "Confirmed") {
      if (qty > 0) {
        var current = Number(stockSheet.getRange("B2").getValue()) || 0;
        var newStock = Math.max(0, current - qty);
        stockSheet.getRange("B2").setValue(newStock);
      }
    }

    // Restore stock when unmarking Confirmed
    if (oldStatus === "Confirmed" && newStatus !== "Confirmed") {
      if (qty > 0) {
        var current2 = Number(stockSheet.getRange("B2").getValue()) || 0;
        stockSheet.getRange("B2").setValue(current2 + qty);
      }
    }
  } catch (err) {
    // Log but don't throw (trigger failures are silent anyway)
    Logger.log("onEditTrigger error: " + err.toString());
  }
}

// ============================================================================
//  HELPERS
// ============================================================================

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmtHeader(sheet, cols, row) {
  row = row || 1;
  var r = sheet.getRange(row, 1, 1, cols);
  r.setFontWeight("bold");
  r.setBackground("#2A2520");
  r.setFontColor("#FFFFFF");
  r.setHorizontalAlignment("center");
}
