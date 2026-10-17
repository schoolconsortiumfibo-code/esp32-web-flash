/**
 * =========================================================================
 * ESP32 Web Flasher - Google Apps Script Backend (GitHub Proxy)
 * โครงการ FIBO - School Consortium | Robot Flasher
 * =========================================================================
 * 
 * สคริปต์นี้ทำหน้าที่เป็น Serverless Backend ตัวกลางสำหรับอัปโหลดไฟล์ .bin
 * และอัปเดต firmwares.json บน GitHub โดยไม่ต้องเปิดเผย GitHub Token ให้ผู้ใช้หน้าเว็บเห็น
 * 
 * -------------------------------------------------------------------------
 * 📋 วิธีติดตั้งและนำไปใช้งาน (ทำเพียงครั้งเดียว):
 * 1. เปิดเว็บ https://script.google.com แล้วกด "โครงการใหม่" (New Project)
 * 2. คัดลอกโค้ดทั้งหมดในไฟล์นี้ ไปวางแทนที่โค้ดเดิมใน Code.gs
 * 3. ใส่ GitHub Personal Access Token ของคุณในตัวแปร GITHUB_TOKEN ด้านล่าง (ต้องมีสิทธิ์ repo)
 * 4. คลิกปุ่มสีน้ำเงิน "ทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 5. เลือกประเภท (รูปฟันเฟือง): "เว็บแอป" (Web app)
 *    - คำอธิบาย: ESP32 Flasher Backend
 *    - ดำเนินการในฐานะ (Execute as): "ฉัน" (Me - บัญชีของคุณ)
 *    - ผู้มีสิทธิ์เข้าถึง (Who has access): "ทุกคน" (Anyone) *** สำคัญมาก เพื่อให้หน้าเว็บส่งไฟล์มาได้ ***
 * 6. กด "ทำให้ใช้งานได้" (Deploy) และกดอนุญาตสิทธิ์ (Authorize Access)
 * 7. คัดลอก "URL ของเว็บแอป" (ที่ลงท้ายด้วย /exec) นำไปใส่ในหน้าเว็บ ESP32 Web Flasher ได้ทันที!
 * -------------------------------------------------------------------------
 */

const CONFIG = {
  // 🔑 ใส่ GitHub Personal Access Token ที่มีสิทธิ์ repo ที่นี่
  // (หรือตั้งใน การตั้งค่าโครงการ > คุณสมบัติของสคริปต์ ด้วยคีย์ GITHUB_TOKEN)
  GITHUB_TOKEN: "PASTE_YOUR_GITHUB_TOKEN_HERE",

  DEFAULT_OWNER: "schoolconsortiumfibo-code",
  DEFAULT_REPO: "esp32-web-flash",
  DEFAULT_BRANCH: "main"
};

/**
 * ดึง Token จาก Script Properties หรือตัวแปร CONFIG
 */
function getGitHubToken() {
  try {
    var propToken = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
    if (propToken && propToken.trim() !== "") {
      return propToken.trim();
    }
  } catch (e) {}
  return CONFIG.GITHUB_TOKEN ? CONFIG.GITHUB_TOKEN.trim() : "";
}

/**
 * ทดสอบสถานะเซิร์ฟเวอร์ (เมื่อเปิด URL ผ่านเบราว์เซอร์ตรงๆ)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "ESP32 Web Flasher Google Apps Script Backend is running ready!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * รับคำขออัปโหลดไฟล์จากหน้าเว็บ
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("ไม่พบข้อมูล Payload ที่ส่งมา");
    }

    var payload = JSON.parse(e.postData.contents);
    var token = getGitHubToken();

    if (!token || token === "PASTE_YOUR_GITHUB_TOKEN_HERE") {
      throw new Error("ยังไม่ได้ใส่ GITHUB_TOKEN ใน Google Apps Script กรุณานำ Token สิทธิ์ repo มาใส่ในตัวแปร CONFIG.GITHUB_TOKEN");
    }

    var owner = payload.owner || CONFIG.DEFAULT_OWNER;
    var repo = payload.repo || CONFIG.DEFAULT_REPO;
    var branch = payload.branch || CONFIG.DEFAULT_BRANCH;
    var filename = payload.filename;
    var fileBase64 = payload.fileBase64;
    var firmware = payload.firmware || {};

    if (!filename || !fileBase64) {
      throw new Error("ข้อมูลไม่ครบถ้วน: ต้องมี filename และ fileBase64");
    }

    // 1. อัปโหลดไฟล์ไบนารี .bin ขึ้น GitHub
    var uploadResult = uploadFileToGitHub(owner, repo, branch, filename, fileBase64, token);

    // 2. อัปเดตข้อมูลใน firmwares.json
    var catalogResult = updateFirmwaresCatalog(owner, repo, branch, firmware, filename, token);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "อัปโหลดไฟล์เข้า GitHub และบันทึกเข้าคลังโปรแกรมสำเร็จแล้ว",
      filename: filename,
      branch: branch,
      commitUrl: "https://github.com/" + owner + "/" + repo + "/blob/" + branch + "/" + encodeURIComponent(filename),
      catalog: catalogResult.catalog
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString().replace(/^Error:\s*/, "")
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * อัปโหลดไฟล์ขึ้น GitHub ผ่าน GitHub Contents API
 */
function uploadFileToGitHub(owner, repo, branch, filename, base64Content, token) {
  var url = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + encodeURIComponent(filename) + "?ref=" + encodeURIComponent(branch);
  
  var existingSha = null;
  try {
    var checkRes = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GAS-ESP32-Web-Flasher"
      },
      muteHttpExceptions: true
    });
    if (checkRes.getResponseCode() === 200) {
      var checkData = JSON.parse(checkRes.getContentText());
      existingSha = checkData.sha;
    } else if (checkRes.getResponseCode() === 401 || checkRes.getResponseCode() === 403) {
      throw new Error("GitHub Token ใน Apps Script ไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง Repository นี้ (HTTP " + checkRes.getResponseCode() + ")");
    }
  } catch (e) {
    if (e.message && e.message.indexOf("GitHub Token") !== -1) throw e;
  }

  var putUrl = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + encodeURIComponent(filename);
  var body = {
    message: "Upload firmware binary: " + filename + " via Google Apps Script Backend",
    content: base64Content,
    branch: branch
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  var uploadRes = UrlFetchApp.fetch(putUrl, {
    method: "PUT",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "GAS-ESP32-Web-Flasher"
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = uploadRes.getResponseCode();
  if (code !== 200 && code !== 201) {
    var errObj = {};
    try { errObj = JSON.parse(uploadRes.getContentText()); } catch(ex){}
    var rawMsg = errObj.message || uploadRes.getContentText();
    if (code === 404) {
      rawMsg = "GitHub แจ้ง 'Not Found' (404) - กรุณาตรวจสอบ: 1) ชื่อ Repository ('" + owner + "/" + repo + "') มีอยู่จริงและสะกดถูกต้อง 2) บัญชีที่ใช้สร้าง GitHub Token ต้องมีสิทธิ์ Write/Push ในโปรเจกต์นี้ 3) หลังใส่ Token ใน Apps Script แล้วต้อง Deploy เป็น New version เสมอ";
    }
    throw new Error("อัปโหลดไฟล์ " + filename + " ไม่สำเร็จ: " + rawMsg);
  }

  return JSON.parse(uploadRes.getContentText());
}

/**
 * อัปเดตรายการใน firmwares.json
 */
function updateFirmwaresCatalog(owner, repo, branch, firmware, filename, token) {
  var jsonUrl = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/firmwares.json?ref=" + encodeURIComponent(branch);
  
  var firmwaresSha = null;
  var catalogList = [];

  var getRes = UrlFetchApp.fetch(jsonUrl, {
    method: "GET",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GAS-ESP32-Web-Flasher"
    },
    muteHttpExceptions: true
  });

  if (getRes.getResponseCode() === 200) {
    var jsonData = JSON.parse(getRes.getContentText());
    firmwaresSha = jsonData.sha;
    try {
      var decodedBytes = Utilities.base64Decode(jsonData.content.replace(/\s/g, ""));
      var jsonStr = Utilities.newBlob(decodedBytes).getDataAsString("UTF-8");
      catalogList = JSON.parse(jsonStr);
      if (!Array.isArray(catalogList)) catalogList = [];
    } catch (ex) {
      catalogList = [];
    }
  }

  var offsetNum = firmware && firmware.offset ? firmware.offset : 65536;
  var offsetHex = firmware && firmware.offsetHex ? firmware.offsetHex : "0x10000";
  var firmwareId = filename.replace(/\.bin$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

  var newEntry = {
    id: firmwareId,
    name: firmware.name || filename,
    version: firmware.version || "1.0.0",
    chipFamily: "ESP32",
    category: firmware.category || "Robot Controller",
    description: firmware.description || ("โปรแกรม " + filename + " สำหรับ ESP32"),
    filename: filename,
    offset: offsetNum,
    offsetHex: offsetHex,
    date: Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"),
    author: firmware.author || "FIBO School Consortium",
    tags: [firmware.category || "Robot Controller", "ESP32", "WebUpload"]
  };

  var existingIndex = -1;
  for (var i = 0; i < catalogList.length; i++) {
    if (catalogList[i].filename === filename || catalogList[i].id === firmwareId) {
      existingIndex = i;
      break;
    }
  }

  if (existingIndex >= 0) {
    catalogList[existingIndex] = newEntry;
  } else {
    catalogList.push(newEntry);
  }

  var updatedJsonString = JSON.stringify(catalogList, null, 2);
  var updatedBase64 = Utilities.base64Encode(Utilities.newBlob(updatedJsonString, "application/json").getBytes());

  var putJsonUrl = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/firmwares.json";
  var updateBody = {
    message: "Update firmwares.json catalog: add/update " + filename + " via Google Apps Script Backend",
    content: updatedBase64,
    branch: branch
  };
  if (firmwaresSha) {
    updateBody.sha = firmwaresSha;
  }

  var putRes = UrlFetchApp.fetch(putJsonUrl, {
    method: "PUT",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "GAS-ESP32-Web-Flasher"
    },
    payload: JSON.stringify(updateBody),
    muteHttpExceptions: true
  });

  var code = putRes.getResponseCode();
  if (code !== 200 && code !== 201) {
    var errObj = {};
    try { errObj = JSON.parse(putRes.getContentText()); } catch(ex){}
    throw new Error("อัปเดต firmwares.json ไม่สำเร็จ: " + (errObj.message || putRes.getContentText()));
  }

  return { success: true, catalog: catalogList };
}
