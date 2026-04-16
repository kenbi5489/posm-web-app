const CONFIG = {
  SPREADSHEET_ID: "1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM",
  SHEET_NAME: "Data nghiệm thu",
  DRIVE_FOLDER_ID: "1ytDh-kl6rwGa6E6TsgcL8lAtXKJ1vdO0"
};

function doPost(e) {
  try {
    Logger.log("==== NEW REQUEST ====");
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "Thiếu postData.contents" });
    }

    const data = JSON.parse(e.postData.contents);
    Logger.log("PAYLOAD: " + JSON.stringify({
      employeeName: data.employeeName,
      brand: data.brand,
      jobCode: data.jobCode,
      project: data.project,
      Project: data.Project,
      isAdHoc: data.isAdHoc
    }));

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];

    // Đọc header row 1
    const lastCol = sheet.getLastColumn();
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    const colIdx = {};
    headerRow.forEach(function(h, i) {
      const hClean = String(h || "").toLowerCase().trim();
      if (!hClean) return;

      if ((hClean === "tên nhân viên" || hClean.includes("nhân viên")) && colIdx["Tên nhân viên"] === undefined) colIdx["Tên nhân viên"] = i;
      else if (hClean === "brand" && colIdx["Brand"] === undefined) colIdx["Brand"] = i;
      else if (hClean === "địa chỉ" && colIdx["Địa chỉ"] === undefined) colIdx["Địa chỉ"] = i;
      else if ((hClean.includes("mã cv") || hClean.includes("qc1")) && colIdx["Mã cv"] === undefined) colIdx["Mã cv"] = i;
      else if ((hClean === "project" || hClean === "dự án") && colIdx["Project"] === undefined) colIdx["Project"] = i;
      else if (hClean.includes("hoạt động urgift") && colIdx["Hoạt động UrGift"] === undefined) colIdx["Hoạt động UrGift"] = i;
      else if (hClean === "ghi chú" && colIdx["Ghi chú"] === undefined) colIdx["Ghi chú"] = i;
      else if ((hClean === "link 1" || hClean === "ảnh 1") && colIdx["Link 1"] === undefined) colIdx["Link 1"] = i;
      else if ((hClean === "link 2" || hClean === "ảnh 2") && colIdx["Link 2"] === undefined) colIdx["Link 2"] = i;
      else if ((hClean === "mall_name" || hClean === "mall name") && colIdx["Mall_Name"] === undefined) colIdx["Mall_Name"] = i;
      else if (hClean === "location_type" && colIdx["Location_Type"] === undefined) colIdx["Location_Type"] = i;
      else if ((hClean === "district" || hClean === "quận") && colIdx["District"] === undefined) colIdx["District"] = i;
      else if ((hClean === "city" || hClean === "thành phố" || hClean === "tỉnh") && colIdx["City"] === undefined) colIdx["City"] = i;
      else if ((hClean === "posm_status" || hClean === "tình trạng posm") && colIdx["POSM_Status"] === undefined) colIdx["POSM_Status"] = i;
      else if ((hClean === "lý do không có posm" || hClean.includes("lý do")) && colIdx["Lý do không có POSM"] === undefined) colIdx["Lý do không có POSM"] = i;
      else if (hClean === "frame" && colIdx["Frame"] === undefined) colIdx["Frame"] = i;
    });
    Logger.log("COLUMN MAP: " + JSON.stringify(colIdx));

    // Đọc các field từ payload
    const rawName    = String(data.employeeName || data.staffName || "").trim();
    const rawBrand   = String(data.brand || "").trim();
    const rawAddress = String(data.address || "").trim();
    const jobCode    = String(data.jobCode || "").trim();
    const storeStatus = String(data.storeStatus || "Site check").trim();
    const note       = String(data.note || "").trim();
    const posmStatus = String(data.posmStatus || "").trim();
    const noPosmReason = String(data.noPosmReason || "").trim();

    // ── PROJECT: đọc từ payload, ưu tiên data.project rồi data.Project ──
    const project = String(data.project || data.Project || "UrGift").trim();
    Logger.log("PROJECT VALUE TO WRITE: [" + project + "]");

    const mall    = getMallName(rawAddress);
    const locType = mall !== "Standalone" ? "Mall" : "Standalone";
    const district = getDistrict(rawAddress);
    const city    = getCityFromAddress(rawAddress);
    const frame   = getFrameStatus(data, note);

    const link1 = saveImageToDrive(data.image1 || (data.images && data.images[0]));
    const link2 = saveImageToDrive(data.image2 || (data.images && data.images[1]));

    // Tìm hàng hiện có hoặc tạo hàng mới
    const targetRow = findExistingRow(sheet, colIdx, jobCode, rawName, rawAddress) || getNextRow(sheet);
    Logger.log("TARGET ROW: " + targetRow);

    // Ghi từng cell trực tiếp bằng column index đã tìm được
    const writeCell = function(fieldName, value) {
      if (colIdx[fieldName] !== undefined) {
        sheet.getRange(targetRow, colIdx[fieldName] + 1).setValue(value);
      }
    };

    // Ghi timestamp vào cột A (index 0)
    sheet.getRange(targetRow, 1).setValue(new Date());

    writeCell("Tên nhân viên", rawName);
    writeCell("Brand", rawBrand);
    writeCell("Địa chỉ", rawAddress);
    writeCell("Mã cv", jobCode);
    writeCell("Project", project);            // ← GHI PROJECT
    writeCell("Hoạt động UrGift", storeStatus);
    writeCell("Ghi chú", note);
    writeCell("Link 1", link1);
    writeCell("Link 2", link2);
    writeCell("Mall_Name", mall);
    writeCell("Location_Type", locType);
    writeCell("District", district);
    writeCell("City", city);
    writeCell("POSM_Status", normalizePosmStatus(posmStatus, data));
    writeCell("Frame", frame);
    if (posmStatus.toUpperCase().includes("KHÔNG POSM")) {
      writeCell("Lý do không có POSM", noPosmReason);
    }

    SpreadsheetApp.flush();

    return jsonResponse({
      status: "success",
      message: "Báo cáo thành công!",
      debug: { targetRow, project, colProject: colIdx["Project"] }
    });

  } catch (err) {
    Logger.log("ERROR: " + err.message + "\n" + err.stack);
    return jsonResponse({ status: "error", message: err.message });
  }
}

// ── Tìm hàng đã có theo jobCode, fallback theo tên+địa chỉ ────────────────
function findExistingRow(sheet, colIdx, jobCode, employeeName, address) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const lastCol = sheet.getLastColumn();
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const jcIdx   = colIdx["Mã cv"];
  const nameIdx = colIdx["Tên nhân viên"];
  const addrIdx = colIdx["Địa chỉ"];

  if (jobCode && jcIdx !== undefined) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][jcIdx] || "").trim() === jobCode) return i + 2;
    }
  }
  if (employeeName && address && nameIdx !== undefined && addrIdx !== undefined) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][nameIdx] || "").trim() === employeeName &&
          String(data[i][addrIdx] || "").trim() === address) return i + 2;
    }
  }
  return null;
}

function getNextRow(sheet) {
  const vals = sheet.getRange("A:A").getValues();
  for (let i = 1; i < vals.length; i++) {
    if (!vals[i][0]) return i + 1;
  }
  return vals.length + 1;
}

function getMallName(address) {
  if (!address || address === "N/A") return "Standalone";
  const addr = address.toLowerCase();
  const mallMap = [
    { keys: ["aeon"], name: "Aeon" },
    { keys: ["vincom"], name: "Vincom" },
    { keys: ["lotte mart", "lotte"], name: "Lotte Mart" },
    { keys: ["big c", "bigc"], name: "Big C" },
    { keys: ["coopxtra", "co.opxtra"], name: "Co.opXtra" },
    { keys: ["coopmart", "co.opmart"], name: "Co.opmart" },
    { keys: ["van hanh mall", "van hanh", "vạn hạnh mall", "tttm van hanh"], name: "Van Hanh Mall" },
    { keys: ["gigamall"], name: "Gigamall" },
    { keys: ["thiso mall", "thiso"], name: "Thiso Mall" },
    { keys: ["crescent mall"], name: "Crescent Mall" },
    { keys: ["vivo city", "sc vivo", "vivo"], name: "Vivo City" },
    { keys: ["tttm"], name: "Mall" }
  ];
  for (let i = 0; i < mallMap.length; i++) {
    for (let j = 0; j < mallMap[i].keys.length; j++) {
      if (addr.indexOf(mallMap[i].keys[j]) !== -1) return mallMap[i].name;
    }
  }
  return "Standalone";
}

function getDistrict(address) {
  if (!address) return "";
  const patterns = [
    /\b(Q\.?\s*\d{1,2})\b/i,
    /\b(Quận\s*\d{1,2})\b/i,
    /\b(TP\.\s*Thủ Đức)\b/i,
    /\b(Thủ Đức)\b/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = address.match(patterns[i]);
    if (match) return standardizeDistrict(match[1]);
  }
  return "";
}

function standardizeDistrict(text) {
  if (!text) return "";
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.includes("thủ đức")) return "TP. Thủ Đức";
  const qMatch = t.match(/(?:q\.?|quận)\s*(\d{1,2})/i);
  if (qMatch) return "Q." + qMatch[1];
  return text.trim();
}

function getCityFromAddress(address) {
  if (!address) return "";
  const addr = address.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (addr.includes("ha noi") || addr.includes("hanoi")) return "Hà Nội";
  if (addr.includes("da nang")) return "Đà Nẵng";
  if (addr.includes("ho chi minh") || addr.includes("tp.hcm") ||
      addr.includes("tphcm") || addr.includes("sai gon")) return "Hồ Chí Minh";
  if (getDistrict(address)) return "Hồ Chí Minh";
  return "";
}

function normalizePosmStatus(posmStatus, data) {
  const val = String(posmStatus || "").trim();
  if (val) return val;
  if (data.noPosmReason) return "KHÔNG POSM";
  return "";
}

function getFrameStatus(data, note) {
  const text = [data.frame, data.note, data.posmNote, data.extraNote].join(" ").toLowerCase();
  return text.includes("frame") ? "Frame" : "No";
}

function saveImageToDrive(base64) {
  if (!base64 || String(base64).length < 50) return "";
  try {
    const raw = String(base64);
    const base64Data = raw.indexOf(",") > -1 ? raw.split(",")[1] : raw;
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data), "image/jpeg",
      "img_" + Date.now() + ".jpg"
    );
    const file = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID)
      .createFile(blob)
      .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("saveImageToDrive error: " + e.message);
    return "";
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── DEBUG: Chạy hàm này để kiểm tra column mapping ────────────────────────
function debugColumnMap() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log("Total cols: " + headerRow.length);
  headerRow.forEach(function(h, i) {
    Logger.log("Col " + (i+1) + ": [" + h + "]");
  });
}

function doGet(e) {
  return ContentService.createTextOutput("POSM Tracker GAS API - OK").setMimeType(ContentService.MimeType.TEXT);
}
