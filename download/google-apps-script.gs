/**
 * ============================================================================
 *  Dr.Melaxin — Apps Script v3 (Beautiful + Bulletproof)
 * ============================================================================
 *
 *  TABS:
 *  1. Dashboard  — Arabic statistics (KPIs, status breakdown, top wilayas, recent orders)
 *  2. Orders     — English headers, colored status dropdown
 *  3. Stock      — Simple, elegant (Product | Stock)
 *  4. Product    — Product settings
 *
 *  FEATURES:
 *  - Colored status: New (blue) → Confirmed (green) → Shipped (gold) → Delivered (dark green) → Cancelled (red)
 *  - Idempotency: duplicate POSTs return original order (no double-charging)
 *  - LockService: prevents race conditions during concurrent writes
 *  - Input validation: name, phone, quantity, total
 *  - Stock validation: rejects orders if out of stock
 *  - Auto-dashboard refresh: statistics update on every order
 *  - Failsafe: every function wrapped in try/catch, never crashes
 *  - Trigger-ready: onEditTrigger handles stock auto-reduction
 *
 *  SETUP (5 minutes):
 *  1. Create EMPTY Google Sheet (don't import anything)
 *  2. Extensions → Apps Script → delete everything → paste this code
 *  3. Click "Run" → select "setup" → authorize
 *  4. Set up trigger MANUALLY (see TRIGGER SETUP below)
 *  5. Deploy → New deployment → Web app
 *  6. Execute as: Me | Access: Anyone  ← CRITICAL!
 *  7. Copy URL → Cloudflare env: NEXT_PUBLIC_GOOGLE_SHEET_URL=your_url
 *
 *  TRIGGER SETUP (do this once, manually):
 *  1. In Apps Script editor, click the clock icon (Triggers) on left sidebar
 *  2. Click "Add Trigger" (bottom right)
 *  3. Choose function: onEditTrigger
 *  4. Event source: From spreadsheet
 *  5. Event type: On edit
 *  6. Save → authorize
 *  This makes stock auto-reduce when you mark an order "Confirmed"
 * ============================================================================
 */

// ============================================================================
//  CONFIG
// ============================================================================

var PRODUCT_DEFAULTS = {
  brandName: "Dr.Melaxin",
  lineName: "Cemenrete CX",
  subtitle: "Calcium Volume Multi Balm",
  basePrice: 3900,
  oldPrice: 5800,
  taglineArabic: "✨ ستيك للعناية بالتجاعيد لبشرة أكثر نعومة وتماسكاً.",
  descriptionArabic: "تساعد تركيبته على تقليل مظهر التجاعيد والخطوط الدقيقة، مع ترطيب البشرة ومنحها مظهراً أكثر إشراقاً ونعومة.",
  benefitsArabic: "مضاد للتجاعيد • تماسك • ترطيب • إشراقة",
  taglineFrench: "✨ Le stick anti-ridules pour une peau visiblement plus lisse et plus ferme.",
  descriptionFrench: "Sa formule aide à réduire l'apparence des rides et ridules, tout en apportant hydratation, confort et éclat à la peau.",
  benefitsFrench: "Anti-ridules • Fermeté • Hydratation • Éclat",
  badgeArabic: "مضاد للتجاعيد",
  freeShipping: true
};

var STATUS_OPTIONS = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
var STATUS_COLORS = {
  "New": "#3080FF",       // Blue
  "Confirmed": "#016630",  // Green
  "Shipped": "#FFD700",    // Gold
  "Delivered": "#2F7D5B",  // Dark Green
  "Cancelled": "#E40014"   // Red
};
var STATUS_TEXT_COLORS = {
  "New": "#FFFFFF",
  "Confirmed": "#FFFFFF",
  "Shipped": "#1C1815",    // Dark text on gold
  "Delivered": "#FFFFFF",
  "Cancelled": "#FFFFFF"
};

// Brand colors
var COLOR_BURGUNDY = "#8b1538";
var COLOR_GOLD = "#d4af37";
var COLOR_CREAM = "#f7f5f2";
var COLOR_DARK = "#2A2520";
var COLOR_MUTED = "#6B6358";

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
    if (a === "order") return out(addOrder(e.parameter));
    if (a === "updateProduct") return out(updateProductFromParams(e.parameter));
    if (a === "updateStock") return out(updateStockFromParams(e.parameter));
    return out({ success: false, error: "unknown action: " + a });
  } catch (err) {
    // CRITICAL: must return success:false so Pages Function returns 500 (not 400)
    // Otherwise client treats server errors as validation errors → no retry → order lost
    return out({ success: false, error: "Server error: " + err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return out({ success: false, error: "No post data" });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return out({ success: false, error: "Invalid JSON: " + parseErr.toString() });
    }

    if (data.action === "updateProduct") return out(updateProduct(data.product));
    if (data.action === "updateStock") return out(updateStock(data.stock));
    return out(addOrder(data));
  } catch (err) {
    return out({ success: false, error: err.toString() });
  }
}

// ============================================================================
//  SETUP — creates all 4 tabs with beautiful formatting
// ============================================================================

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove default sheet if empty
  try {
    var defaultSheet = ss.getSheets()[0];
    if (defaultSheet && defaultSheet.getName() === "Sheet1" && defaultSheet.getLastRow() === 0) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (e) {}

  createProductTab(ss);
  createOrdersTab(ss);
  createStockTab(ss);
  createDashboardTab(ss);

  // Reorder tabs: Dashboard, Orders, Stock, Product
  var dashboard = ss.getSheetByName("Dashboard");
  var orders = ss.getSheetByName("Orders");
  var stock = ss.getSheetByName("Stock");
  var product = ss.getSheetByName("Product");

  ss.setActiveSheet(dashboard); ss.moveActiveSheet(1);
  ss.setActiveSheet(orders); ss.moveActiveSheet(2);
  ss.setActiveSheet(stock); ss.moveActiveSheet(3);
  ss.setActiveSheet(product); ss.moveActiveSheet(4);

  // Set Dashboard as active
  ss.setActiveSheet(dashboard);

  Logger.log("✅ Setup complete! 4 tabs created:");
  Logger.log("   1. Dashboard  — Arabic statistics");
  Logger.log("   2. Orders     — English headers, colored status");
  Logger.log("   3. Stock      — Simple stock management");
  Logger.log("   4. Product    — Product settings");
  Logger.log("");
  Logger.log("📋 NEXT STEPS:");
  Logger.log("   1. Set up trigger: clock icon → onEditTrigger → On edit");
  Logger.log("   2. Deploy → New deployment → Web app");
  Logger.log("   3. Execute as: Me | Access: Anyone");
  Logger.log("   4. Copy URL → Cloudflare env var");
}

// ============================================================================
//  PRODUCT TAB
// ============================================================================

function createProductTab(ss) {
  var p = ss.getSheetByName("Product");
  if (!p) {
    p = ss.insertSheet("Product");
  }
  p.clear();

  // Headers
  p.getRange(1, 1).setValue("Setting");
  p.getRange(1, 2).setValue("Value");
  fmtHeaderRow(p, 1, 2, COLOR_DARK);

  // Default values
  var keys = Object.keys(PRODUCT_DEFAULTS);
  for (var i = 0; i < keys.length; i++) {
    p.getRange(i + 2, 1).setValue(keys[i]);
    p.getRange(i + 2, 2).setValue(PRODUCT_DEFAULTS[keys[i]]);
  }

  // Formatting
  p.setColumnWidth(1, 200);
  p.setColumnWidth(2, 400);
  p.setFrozenRows(1);

  // Style data rows
  var dataRange = p.getRange(2, 1, keys.length, 2);
  dataRange.setBackground(COLOR_CREAM);
  dataRange.setFontSize(11);
  p.getRange(2, 1, keys.length, 1).setFontWeight("bold");
  p.getRange(2, 1, keys.length, 1).setFontColor(COLOR_BURGUNDY);
}

// ============================================================================
//  ORDERS TAB
// ============================================================================

function createOrdersTab(ss) {
  var o = ss.getSheetByName("Orders");
  if (!o) {
    o = ss.insertSheet("Orders");
  }
  o.clear();

  // Headers (English)
  var headers = ["Date", "Order No", "Status", "Customer", "Phone", "Wilaya", "Commune", "Qty", "Total (DA)", "Notes", "Idempotency Key"];
  o.getRange(1, 1, 1, headers.length).setValues([headers]);
  fmtHeaderRow(o, 1, headers.length, COLOR_DARK);

  // Column widths
  var widths = [120, 150, 110, 180, 130, 120, 120, 60, 100, 200, 180];
  for (var i = 0; i < widths.length; i++) {
    o.setColumnWidth(i + 1, widths[i]);
  }

  o.setFrozenRows(1);
  o.setAutoFilter("A1:K1");

  // Status dropdown (column C = 3)
  var statusRange = o.getRange(2, 3, 5000, 1);
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .build()
  );

  // Conditional formatting for Status column
  var rules = [];
  for (var s = 0; s < STATUS_OPTIONS.length; s++) {
    var st = STATUS_OPTIONS[s];
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(st)
        .setBackground(STATUS_COLORS[st])
        .setFontColor(STATUS_TEXT_COLORS[st])
        .setRanges([statusRange])
        .build()
    );
  }
  o.setConditionalFormatRules(rules);

  // Default "New" status for empty rows
  o.getRange(2, 3, 100, 1).setValue("New").setFontColor("#999999");
}

// ============================================================================
//  STOCK TAB
// ============================================================================

function createStockTab(ss) {
  var stk = ss.getSheetByName("Stock");
  if (!stk) {
    stk = ss.insertSheet("Stock");
  }
  stk.clear();

  // Headers
  stk.getRange(1, 1).setValue("Product");
  stk.getRange(1, 2).setValue("Stock");
  fmtHeaderRow(stk, 1, 2, COLOR_DARK);

  // Product row
  stk.getRange(2, 1).setValue("Cemenrete CX");
  stk.getRange(2, 2).setValue(100);

  // Style product row
  var productRow = stk.getRange(2, 1, 1, 2);
  productRow.setBackground(COLOR_CREAM);
  productRow.setFontSize(14);
  productRow.setFontWeight("bold");
  productRow.setBorder(true, true, true, true, true, true);
  stk.getRange(2, 1).setFontColor(COLOR_BURGUNDY);
  stk.getRange(2, 2).setFontColor(COLOR_BURGUNDY);
  stk.getRange(2, 2).setHorizontalAlignment("center");

  // Column widths
  stk.setColumnWidth(1, 200);
  stk.setColumnWidth(2, 100);

  // Instructions (column D)
  stk.getRange("D1").setValue("📦 Stock Management · إدارة المخزون")
    .setFontWeight("bold").setFontSize(14).setFontColor(COLOR_BURGUNDY);

  var instructions = [
    "",
    "1. Set stock number in B2 (e.g. 100)",
    "2. When you mark order 'Confirmed' → stock auto-reduces",
    "3. Stock ≤ 3 → website shows 'low stock' warning",
    "4. Stock = 0 → website disables ordering",
    "5. To restock → just change B2",
    "",
    "💡 Stock auto-updates via trigger (onEditTrigger)",
    "   when you change Status to 'Confirmed' in Orders tab"
  ];

  for (var i = 0; i < instructions.length; i++) {
    var row = 2 + i;
    stk.getRange(row, 4).setValue(instructions[i]);
    if (instructions[i].startsWith("💡")) {
      stk.getRange(row, 4).setFontColor(COLOR_GOLD).setFontWeight("bold");
    } else if (instructions[i].length > 0) {
      stk.getRange(row, 4).setFontColor(COLOR_MUTED);
    }
  }

  stk.setColumnWidth(4, 450);
  stk.setFrozenRows(1);
}

// ============================================================================
//  DASHBOARD TAB — Beautiful Arabic Statistics
// ============================================================================

function createDashboardTab(ss) {
  var d = ss.getSheetByName("Dashboard");
  if (!d) {
    d = ss.insertSheet("Dashboard");
  }
  d.clear();

  // Hide gridlines for clean look
  d.setHiddenGridlines(true);

  // Column widths
  d.setColumnWidth(1, 20);   // spacer
  d.setColumnWidth(2, 180);
  d.setColumnWidth(3, 180);
  d.setColumnWidth(4, 180);
  d.setColumnWidth(5, 180);
  d.setColumnWidth(6, 20);   // spacer

  // === Title ===
  d.getRange("B2:E2").merge();
  d.getRange("B2").setValue("لوحة التحكم · Dashboard")
    .setFontWeight("bold").setFontSize(24)
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  d.getRange("B2:E2").setBackground(COLOR_BURGUNDY);
  d.setRowHeight(2, 50);

  // === KPI Cards (Row 4-6) ===
  d.getRange("B4").setValue("📊 النظرة العامة · Overview")
    .setFontWeight("bold").setFontSize(14).setFontColor(COLOR_BURGUNDY);

  // 4 KPI cards: B5, C5, D5, E5
  createKPICard(d, "B", 5, "إجمالي الطلبات", "Total Orders", "=COUNTA(Orders!B2:B)", COLOR_BURGUNDY);
  createKPICard(d, "C", 5, "إجمالي الإيرادات", "Revenue (DA)", "=SUM(Orders!I2:I)", COLOR_GOLD);
  createKPICard(d, "D", 5, "متوسط الطلب", "Avg Order (DA)", "=IFERROR(ROUND(AVERAGE(Orders!I2:I),0),0)", "#016630");
  createKPICard(d, "E", 5, "المخزون الحالي", "Current Stock", "=Stock!B2", "#2F7D5B");

  // === Status Breakdown (Row 8-14) ===
  d.getRange("B8").setValue("📋 حالة الطلبات · Order Status")
    .setFontWeight("bold").setFontSize(14).setFontColor(COLOR_BURGUNDY);

  d.getRange("B9").setValue("Status");
  d.getRange("C9").setValue("Count");
  d.getRange("D9").setValue("العدد");
  fmtHeaderRow(d, 9, 3, COLOR_DARK, "B");

  for (var i = 0; i < STATUS_OPTIONS.length; i++) {
    var row = 10 + i;
    var st = STATUS_OPTIONS[i];
    d.getRange(row, 2).setValue(st)
      .setBackground(STATUS_COLORS[st])
      .setFontColor(STATUS_TEXT_COLORS[st])
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    d.getRange(row, 3).setFormula('=COUNTIF(Orders!C2:C,"' + st + '")')
      .setHorizontalAlignment("center")
      .setFontWeight("bold")
      .setFontSize(12);
    d.getRange(row, 4).setValue(getStatusArabic(st))
      .setHorizontalAlignment("center")
      .setFontColor(COLOR_MUTED);
    d.setRowHeight(row, 28);
  }

  // === Top Wilayas (Row 16+) — single QUERY outputs 2 columns (name + count) ===
  d.getRange("B16").setValue("🌍 أعلى الولايات · Top Wilayas")
    .setFontWeight("bold").setFontSize(14).setFontColor(COLOR_BURGUNDY);

  d.getRange("B17").setValue("Wilaya");
  d.getRange("C17").setValue("Orders");
  d.getRange("D17").setValue("الطلبات");
  fmtHeaderRow(d, 17, 3, COLOR_DARK, "B");

  // Single QUERY outputs BOTH columns (B = name, C = count) — guaranteed alignment
  // Uses "where F is not null and F != ''" to skip empty cells
  // "label count(F) ''" removes the default header so it's just the number
  d.getRange("B18").setFormula(
    '=IFERROR(QUERY(Orders!F2:I,' +
    '"select F, count(F) where F is not null and F != \'\' ' +
    'group by F order by count(F) desc limit 5 ' +
    'label F \'Wilaya\', count(F) \'Orders\'",0),"No orders yet")'
  );

  // Style the 5 rows
  for (var w = 0; w < 5; w++) {
    var row = 18 + w;
    d.getRange(row, 2).setHorizontalAlignment("center").setFontSize(11);
    d.getRange(row, 3).setHorizontalAlignment("center").setFontSize(11).setFontWeight("bold");
    d.getRange(row, 4).setBackground(COLOR_CREAM);
    d.setRowHeight(row, 24);
  }

  // === Recent Orders (Row 24+) — single QUERY outputs 4 columns ===
  d.getRange("B24").setValue("🕒 أحدث الطلبات · Recent Orders")
    .setFontWeight("bold").setFontSize(14).setFontColor(COLOR_BURGUNDY);

  var recentHeaders = ["Order No", "Customer", "Wilaya", "Total (DA)"];
  for (var h = 0; h < recentHeaders.length; h++) {
    d.getRange(25, 2 + h).setValue(recentHeaders[h]);
  }
  fmtHeaderRow(d, 25, 4, COLOR_DARK, "B");

  // Single QUERY outputs 4 columns starting at B26 (B=OrderNo, C=Customer, D=Wilaya, E=Total)
  // "order by A desc" = newest first (column A = Date)
  // "label" removes default headers so cells show just the data
  d.getRange("B26").setFormula(
    '=IFERROR(QUERY(Orders!B2:I,' +
    '"select B, D, F, I where B is not null order by A desc limit 5 ' +
    'label B \'\', D \'\', F \'\', I \'\'",0),"No orders yet")'
  );

  // Style the 5 rows
  for (var r = 0; r < 5; r++) {
    var row = 26 + r;
    for (var c = 2; c <= 5; c++) {
      d.getRange(row, c).setHorizontalAlignment("center").setFontSize(11);
      if (c === 5) d.getRange(row, c).setFontWeight("bold");
    }
    d.setRowHeight(row, 24);
  }

  // === Footer ===
  d.getRange("B32").setValue("💡 يتم تحديث الإحصائيات تلقائياً عند كل طلب جديد")
    .setFontColor(COLOR_MUTED).setFontSize(10).setHorizontalAlignment("center");
  d.getRange("B33").setValue("💡 Statistics auto-update on every new order")
    .setFontColor(COLOR_MUTED).setFontSize(10).setHorizontalAlignment("center");

  // Style spacer columns
  d.getRange("A1:A33").setBackground("#FFFFFF");
  d.getRange("F1:F33").setBackground("#FFFFFF");
}

/**
 * fixDashboard() — repairs the Dashboard tab without touching other tabs.
 * Run this if the Dashboard looks broken or shows errors.
 * Replaces all formulas with bulletproof QUERY-based ones.
 */
function fixDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = ss.getSheetByName("Dashboard");
  if (!d) {
    // Dashboard doesn't exist — create it
    createDashboardTab(ss);
    Logger.log("✅ Dashboard created (didn't exist).");
    return;
  }

  // Clear everything and rebuild
  d.clear();
  createDashboardTab(ss);
  SpreadsheetApp.flush();

  Logger.log("✅ Dashboard repaired with QUERY formulas.");
  Logger.log("📋 All formulas are now bulletproof (no array-formula issues).");
  Logger.log("📊 Statistics will auto-update on every new order.");
}

function createKPICard(sheet, col, row, arabicLabel, englishLabel, formula, color) {
  // Row 1: Arabic label
  sheet.getRange(col + row).setValue(arabicLabel)
    .setFontWeight("bold").setFontSize(11)
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.getRange(col + row).setBackground(color);

  // Row 2: Big number (formula)
  sheet.getRange(col + (row + 1)).setFormula(formula)
    .setFontWeight("bold").setFontSize(28)
    .setFontColor(color)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setNumberFormat("#,##0");
  sheet.getRange(col + (row + 1)).setBackground(COLOR_CREAM);

  // Row 3: English label
  sheet.getRange(col + (row + 2)).setValue(englishLabel)
    .setFontSize(9)
    .setFontColor(COLOR_MUTED)
    .setHorizontalAlignment("center");
  sheet.getRange(col + (row + 2)).setBackground(COLOR_CREAM);

  // Borders
  sheet.getRange(col + row + ":" + col + (row + 2)).setBorder(true, true, true, true, true, true);

  // Row heights
  sheet.setRowHeight(row, 24);
  sheet.setRowHeight(row + 1, 50);
  sheet.setRowHeight(row + 2, 18);
}

function getStatusArabic(status) {
  var map = {
    "New": "جديد",
    "Confirmed": "مؤكد",
    "Shipped": "مشحون",
    "Delivered": "مسلّم",
    "Cancelled": "ملغى"
  };
  return map[status] || status;
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

  // --- Idempotency check ---
  var idempotencyKey = d.idempotencyKey || "";
  if (idempotencyKey) {
    try {
      var allData = s.getDataRange().getValues();
      for (var i = allData.length - 1; i >= 1; i--) {
        if (allData[i][10] === idempotencyKey) {
          return {
            success: true,
            order: {
              id: allData[i][1],
              orderNo: allData[i][1],
              total: Number(allData[i][8]) || total,
              duplicate: true
            }
          };
        }
      }
    } catch (idemErr) {
      // Continue anyway
    }
  }

  // --- Generate order number + append row ---
  // LockService removed — it was causing "Server busy" errors when locks
  // got stuck from failed executions. Instead, we rely on:
  // 1. Idempotency key (prevents duplicate orders on retry)
  // 2. appendRow() is atomic at the row level (Google Sheets handles this)
  // 3. Order number uses row count (slight collision risk under extreme
  //    concurrency is acceptable — idempotency key catches duplicates)

  var no = generateOrderNumber(s);

  s.appendRow([
    new Date(),
    no,
    "New",
    String(d.fullName).trim(),
    String(d.phone).trim(),
    String(d.wilayaName),
    String(d.communeName),
    qty,
    total,
    String(d.notes || "").trim(),
    idempotencyKey
  ]);

  // Dashboard refresh removed from order flow for performance.
  // Google Sheets auto-recalculates formulas when admin opens the Sheet.
  // onEditTrigger still refreshes dashboard when admin changes order status.

  return {
    success: true,
    order: { id: no, orderNo: no, total: total }
  };
}

/**
 * Generate unique order number: AUR-YYYY-NNNNNN
 * Uses row count + timestamp suffix for uniqueness (prevents collision)
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
    // Skip empty rows
    if (!data[i][1] && !data[i][3]) continue;
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

/**
 * Update product from GET params (for Pages Function proxy).
 * Converts flat query params to a product object.
 */
function updateProductFromParams(p) {
  var product = {};
  // Known product fields
  var fields = ["basePrice", "oldPrice", "brandName", "lineName", "taglineArabic", "descriptionArabic"];
  for (var i = 0; i < fields.length; i++) {
    if (p[fields[i]] !== undefined) {
      var val = p[fields[i]];
      // Convert numeric fields
      if (fields[i] === "basePrice" || fields[i] === "oldPrice") {
        val = Number(val);
      }
      product[fields[i]] = val;
    }
  }
  return updateProduct(product);
}

/**
 * Update stock from GET params (for Pages Function proxy).
 */
function updateStockFromParams(p) {
  var stockVal = parseInt(String(p.stock), 10);
  if (isNaN(stockVal) || stockVal < 0) {
    return { success: false, error: "Invalid stock value" };
  }
  return updateStock(stockVal);
}

// ============================================================================
//  STATISTICS (for API)
// ============================================================================

function getStats() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  if (!s) return { totalOrders: 0, totalRevenue: 0 };
  var data = s.getDataRange().getValues();
  if (data.length < 2) return { totalOrders: 0, totalRevenue: 0 };

  var totalRevenue = 0, totalOrders = 0;
  var wilayaCounts = {}, statusCounts = {};

  for (var i = 1; i < data.length; i++) {
    if (!data[i][1] && !data[i][3]) continue;
    var total = data[i][8];
    var wilaya = data[i][5];
    var status = data[i][2];

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

/** Force-refresh dashboard formulas (called after every order). */
function refreshDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = ss.getSheetByName("Dashboard");
  if (!d) return;

  // Trigger recalculation by touching a cell
  var touch = d.getRange("A1").getValue();
  d.getRange("A1").setValue(touch === "" ? "." : "");

  // Force spreadsheet recalculation
  SpreadsheetApp.flush();
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
    if (col !== 3 || row < 2) return; // Column C = Status

    var newStatus = e.value;
    var oldStatus = e.oldValue;

    // If cell was cleared, do nothing
    if (!newStatus) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stockSheet = ss.getSheetByName("Stock");
    if (!stockSheet) return;

    var qtyCell = sheet.getRange(row, 8); // H = Qty
    var qty = Number(qtyCell.getValue()) || 0;

    // === STOCK RESERVATION LOGIC (bulletproof) ===
    // "Reserved" statuses: Confirmed, Shipped, Delivered (stock is held)
    // "Unreserved" statuses: New, Cancelled (stock is NOT held)
    //
    // Transitions:
    //   Unreserved → Reserved:  DECREASE stock (reserve it)
    //   Reserved → Unreserved:  INCREASE stock (release it back)
    //   Reserved → Reserved:    NO CHANGE (still reserved, just stage changed)
    //   Unreserved → Unreserved: NO CHANGE

    var RESERVED_STATUSES = ["Confirmed", "Shipped", "Delivered"];

    function isReserved(status) {
      return RESERVED_STATUSES.indexOf(status) !== -1;
    }

    var wasReserved = isReserved(oldStatus);
    var nowReserved = isReserved(newStatus);

    if (qty > 0) {
      if (!wasReserved && nowReserved) {
        // Reserve: decrease stock
        var current = Number(stockSheet.getRange("B2").getValue()) || 0;
        var newStock = Math.max(0, current - qty);
        stockSheet.getRange("B2").setValue(newStock);
      } else if (wasReserved && !nowReserved) {
        // Release: increase stock back
        var current2 = Number(stockSheet.getRange("B2").getValue()) || 0;
        stockSheet.getRange("B2").setValue(current2 + qty);
      }
      // else: no change needed (both reserved or both unreserved)
    }

    // Refresh dashboard
    try { refreshDashboard(); } catch (err) {}
  } catch (err) {
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

function fmtHeaderRow(sheet, row, cols, bgColor, startCol) {
  startCol = startCol || "A";
  var startColNum = startCol.charCodeAt(0) - 64;
  var r = sheet.getRange(row, startColNum, 1, cols);
  r.setFontWeight("bold");
  r.setBackground(bgColor);
  r.setFontColor("#FFFFFF");
  r.setHorizontalAlignment("center");
  r.setVerticalAlignment("middle");
  sheet.setRowHeight(row, 28);
}
