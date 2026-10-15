/**
 * ESP32 Web Flasher - Application Logic
 * FIBO School Consortium | Espino32 (ThaiEasyElec)
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let firmwares = [];
  let selectedFirmware = null;
  let localFile = null;
  let activeTab = 'github-tab';
  let serialPort = null;
  let serialReader = null;
  let serialKeepReading = false;
  let activeBlobUrls = [];

  // Authentication State
  const REQUIRED_ADMIN_EMAIL = 'schoolconsortium.fibo@gmail.com';
  let currentUser = JSON.parse(localStorage.getItem('esp32_admin_user') || 'null');
  let googleClientId = localStorage.getItem('esp32_google_client_id') || '';

  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const browserAlert = document.getElementById('browserAlert');
  
  // Auth Elements
  const authHeaderBar = document.getElementById('authHeaderBar');
  const uploadTabBtn = document.getElementById('uploadTabBtn');
  const uploadTabIcon = document.getElementById('uploadTabIcon');
  const uploadTabLockBadge = document.getElementById('uploadTabLockBadge');
  const uploadLockedView = document.getElementById('uploadLockedView');
  const uploadUnlockedView = document.getElementById('uploadUnlockedView');
  const lockedViewLoginBtn = document.getElementById('lockedViewLoginBtn');
  const loginModal = document.getElementById('loginModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const googleCustomLoginBtn = document.getElementById('googleCustomLoginBtn');
  const modalErrorAlert = document.getElementById('modalErrorAlert');
  const customClientIdInput = document.getElementById('customClientIdInput');
  const saveClientIdBtn = document.getElementById('saveClientIdBtn');
  const simulateAdminLoginBtn = document.getElementById('simulateAdminLoginBtn');
  
  // GitHub Library Elements
  const firmwareListContainer = document.getElementById('firmwareList');
  const githubFlashContainer = document.getElementById('githubFlashContainer');
  const githubFlashSummary = document.getElementById('githubFlashSummary');

  // Direct Upload Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePreview = document.getElementById('filePreview');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const offsetRadios = document.querySelectorAll('input[name="offsetOption"]');
  const customOffsetWrap = document.getElementById('customOffsetWrap');
  const customOffsetInput = document.getElementById('customOffsetInput');
  const customFlashContainer = document.getElementById('customFlashContainer');
  const customFlashSummary = document.getElementById('customFlashSummary');
  const customActionButtonsGroup = document.getElementById('customActionButtonsGroup');
  const openGithubUploadBtn = document.getElementById('openGithubUploadBtn');

  // GitHub Upload Modal Elements
  const githubUploadModal = document.getElementById('githubUploadModal');
  const ghModalCloseBtn = document.getElementById('ghModalCloseBtn');
  const ghCancelBtn = document.getElementById('ghCancelBtn');
  const ghSubmitUploadBtn = document.getElementById('ghSubmitUploadBtn');
  const ghViewCatalogBtn = document.getElementById('ghViewCatalogBtn');
  const ghViewRepoLink = document.getElementById('ghViewRepoLink');
  
  const ghFwName = document.getElementById('ghFwName');
  const ghFwVersion = document.getElementById('ghFwVersion');
  const ghFwCategory = document.getElementById('ghFwCategory');
  const ghFwDesc = document.getElementById('ghFwDesc');
  const ghFwAuthor = document.getElementById('ghFwAuthor');
  const ghFwOffset = document.getElementById('ghFwOffset');
  const ghRepoOwner = document.getElementById('ghRepoOwner');
  const ghRepoName = document.getElementById('ghRepoName');
  const ghRepoBranch = document.getElementById('ghRepoBranch');
  const ghTokenInput = document.getElementById('ghTokenInput');
  const ghToggleTokenVisibilityBtn = document.getElementById('ghToggleTokenVisibilityBtn');
  const ghRememberTokenCheck = document.getElementById('ghRememberTokenCheck');

  const ghUploadStatusBox = document.getElementById('ghUploadStatusBox');
  const ghStatusSpinner = document.getElementById('ghStatusSpinner');
  const ghStatusTitle = document.getElementById('ghStatusTitle');
  const ghStep1 = document.getElementById('ghStep1');
  const ghStep2 = document.getElementById('ghStep2');
  const ghStep3 = document.getElementById('ghStep3');
  const ghStep4 = document.getElementById('ghStep4');
  const ghStatusError = document.getElementById('ghStatusError');

  // Terminal Elements
  const termBaudSelect = document.getElementById('termBaudSelect');
  const termConnectBtn = document.getElementById('termConnectBtn');
  const termResetBtn = document.getElementById('termResetBtn');
  const termClearBtn = document.getElementById('termClearBtn');
  const termScreen = document.getElementById('termScreen');
  const termInput = document.getElementById('termInput');
  const termSendBtn = document.getElementById('termSendBtn');
  const termAutoscroll = document.getElementById('termAutoscroll');

  // Guide Accordions
  const guideHeaders = document.querySelectorAll('.guide-header');

  // Initialize UI & Auth
  initAuth();
  checkBrowserSupport();

  // Tab Navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  function isAuthorizedAdmin() {
    return currentUser && currentUser.email && currentUser.email.toLowerCase() === REQUIRED_ADMIN_EMAIL.toLowerCase();
  }

  function switchTab(tabId) {
    // If trying to access upload tab without admin authorization
    if (tabId === 'upload-tab' && !isAuthorizedAdmin()) {
      openLoginModal();
      return;
    }

    activeTab = tabId;
    tabs.forEach(t => {
      if (t.dataset.tab === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    tabContents.forEach(content => {
      if (content.id === tabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  function checkBrowserSupport() {
    if ('serial' in navigator) {
      browserAlert.className = 'browser-alert success';
      browserAlert.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="icon">✅</span>
          <span>บราวเซอร์นี้รองรับ <strong>Web Serial API</strong> พร้อมเชื่อมต่อกับ Espino32 ได้ทันที</span>
        </div>
        <span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7;">Supported</span>
      `;
    } else {
      browserAlert.className = 'browser-alert';
      browserAlert.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="icon">⚠️</span>
          <span>บราวเซอร์นี้<strong>ไม่รองรับ Web Serial API</strong> กรุณาเปิดด้วย <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong> บนคอมพิวเตอร์ (Windows / Mac / Linux)</span>
        </div>
        <span class="badge" style="background: rgba(239,68,68,0.2); color: #fca5a5;">Not Supported</span>
      `;
    }
  }

  // 3. Load GitHub Firmware Catalog
  loadFirmwareCatalog();

  async function loadFirmwareCatalog() {
    firmwareListContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">กำลังโหลดรายชื่อโปรแกรม...</div>`;
    try {
      const response = await fetch('firmwares.json');
      if (!response.ok) throw new Error('Cannot load firmwares.json');
      firmwares = await response.json();
    } catch (err) {
      console.warn('Fallback to default catalog:', err);
      // Fallback default
      firmwares = [
        {
          id: 'ailas_robot_v2',
          name: 'AILAS Robot Controller V2',
          version: '2.0.0',
          chipFamily: 'ESP32',
          category: 'Robot Controller',
          description: 'โปรแกรมควบคุมหุ่นยนต์ Mobile Robot สำหรับโครงการ FIBO-School Consortium',
          filename: 'ailas_firebase_V2.ino.bin',
          offset: 65536,
          offsetHex: '0x10000',
          date: '2026-09-09',
          author: 'FIBO School Consortium',
          tags: ['Robot', 'ESP32', 'Default']
        }
      ];
    }
    renderFirmwareList();
  }

  function renderFirmwareList() {
    firmwareListContainer.innerHTML = '';
    if (!firmwares || firmwares.length === 0) {
      firmwareListContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">ไม่พบรายการโปรแกรมในระบบ</div>`;
      return;
    }

    firmwares.forEach((fw, index) => {
      const card = document.createElement('div');
      card.className = `firmware-card ${index === 0 ? 'selected' : ''}`;
      card.dataset.id = fw.id;
      
      const tagHtml = fw.tags ? fw.tags.map(t => `<span class="badge">${t}</span>`).join(' ') : '';

      card.innerHTML = `
        <div class="firmware-card-header">
          <div class="firmware-card-title">${escapeHtml(fw.name)}</div>
          <span class="badge" style="background: rgba(121,40,202,0.2); color: #d8b4fe;">v${escapeHtml(fw.version)}</span>
        </div>
        <div class="firmware-card-desc">${escapeHtml(fw.description)}</div>
        <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 4px;">
          ${tagHtml}
        </div>
        <div class="firmware-card-meta">
          <span>📁 ${escapeHtml(fw.filename)}</span>
          <span>📍 Offset ${escapeHtml(fw.offsetHex || '0x10000')}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.firmware-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectFirmware(fw);
      });

      firmwareListContainer.appendChild(card);
    });

    // Select the first one by default
    if (firmwares.length > 0) {
      selectFirmware(firmwares[0]);
    }
  }

  function selectFirmware(fw) {
    selectedFirmware = fw;
    githubFlashSummary.innerHTML = `โปรแกรมที่เลือก: <strong>${escapeHtml(fw.name)}</strong> (ไฟล์: <code>${escapeHtml(fw.filename)}</code> | Offset: <code>${escapeHtml(fw.offsetHex || '0x10000')}</code>)`;
    
    // Generate manifest for this firmware
    // Convert relative filename to absolute URL so esp-web-tools can resolve it properly from a Blob manifest
    const partPath = new URL(fw.filename, window.location.href).href;

    const manifest = {
      name: fw.name,
      version: fw.version || "1.0.0",
      builds: [
        {
          chipFamily: fw.chipFamily || "ESP32",
          parts: [
            {
              path: partPath,
              offset: fw.offset || 65536
            }
          ]
        }
      ]
    };

    updateInstallButton(githubFlashContainer, manifest);
  }

  // 4. Direct Upload Handlers
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', () => {
    localFile = null;
    fileInput.value = '';
    filePreview.classList.remove('active');
    customFlashContainer.innerHTML = '';
    if (customActionButtonsGroup) customActionButtonsGroup.style.display = 'none';
    customFlashSummary.innerHTML = 'กรุณาเลือกไฟล์ <code>.bin</code> ด้านบนเพื่อเปิดใช้งานปุ่มการทำงาน';
  });

  offsetRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.offset-radio-label').forEach(l => l.classList.remove('selected'));
      radio.closest('.offset-radio-label').classList.add('selected');

      if (e.target.value === 'custom') {
        customOffsetWrap.classList.add('active');
      } else {
        customOffsetWrap.classList.remove('active');
      }

      if (localFile) {
        generateCustomFlashButton();
      }
    });
  });

  customOffsetInput.addEventListener('input', () => {
    if (localFile) {
      generateCustomFlashButton();
    }
  });

  function handleFileSelected(file) {
    if (!file.name.toLowerCase().endsWith('.bin')) {
      alert('กรุณาเลือกไฟล์ที่มีนามสกุล .bin (ไฟล์ไบนารีที่ได้จาก Arduino IDE)');
      return;
    }

    localFile = file;
    previewFileName.textContent = file.name;
    previewFileSize.textContent = formatBytes(file.size);
    filePreview.classList.add('active');

    // Auto-detect Offset from filename
    autoDetectOffset(file.name);

    // Generate Flash Button
    generateCustomFlashButton();
  }

  function autoDetectOffset(filename) {
    const lowerName = filename.toLowerCase();
    let targetRadio = 'app';

    if (lowerName.includes('merged.bin')) {
      targetRadio = 'merged';
    } else if (lowerName.includes('bootloader.bin')) {
      targetRadio = 'custom';
      customOffsetInput.value = '0x1000';
    } else if (lowerName.includes('partitions.bin')) {
      targetRadio = 'custom';
      customOffsetInput.value = '0x8000';
    } else {
      // Default Arduino IDE app export
      targetRadio = 'app';
    }

    offsetRadios.forEach(radio => {
      radio.checked = (radio.value === targetRadio);
      const label = radio.closest('.offset-radio-label');
      if (radio.checked) {
        label.classList.add('selected');
      } else {
        label.classList.remove('selected');
      }
    });

    if (targetRadio === 'custom') {
      customOffsetWrap.classList.add('active');
    } else {
      customOffsetWrap.classList.remove('active');
    }
  }

  function getSelectedOffset() {
    let selectedVal = 'app';
    offsetRadios.forEach(r => {
      if (r.checked) selectedVal = r.value;
    });

    if (selectedVal === 'app') return 65536; // 0x10000
    if (selectedVal === 'merged') return 0;   // 0x0
    if (selectedVal === 'custom') {
      const hexStr = customOffsetInput.value.trim();
      const num = parseInt(hexStr, 16);
      return isNaN(num) ? 65536 : num;
    }
    return 65536;
  }

  function generateCustomFlashButton() {
    if (!localFile) return;

    if (customActionButtonsGroup) {
      customActionButtonsGroup.style.display = 'flex';
    }

    const offsetNum = getSelectedOffset();
    const offsetHex = '0x' + offsetNum.toString(16).toUpperCase();

    customFlashSummary.innerHTML = `เตรียม Flash ไฟล์: <strong>${escapeHtml(localFile.name)}</strong> (ขนาด: ${formatBytes(localFile.size)}) ลงที่ Offset: <strong>${offsetHex} (${offsetNum})</strong>`;

    // Create Blob URLs
    const fileBlobUrl = URL.createObjectURL(localFile);
    activeBlobUrls.push(fileBlobUrl);

    const manifest = {
      name: localFile.name.replace(/\.bin$/i, ''),
      version: "1.0.0",
      builds: [
        {
          chipFamily: "ESP32",
          parts: [
            {
              path: fileBlobUrl,
              offset: offsetNum
            }
          ]
        }
      ]
    };

    updateInstallButton(customFlashContainer, manifest);
  }

  // 5. Update / Inject esp-web-install-button
  function updateInstallButton(container, manifestObject) {
    // Clear existing
    container.innerHTML = '';

    // Check Web Serial support ourselves first.
    // The esp-web-install-button's own "unsupported" slot detection can fail on
    // some configurations (e.g. GitHub Pages with Blob URLs), so we handle it here.
    if (!('serial' in navigator)) {
      container.innerHTML = `
        <div style="color:#fca5a5; font-size:0.9rem; display:flex; align-items:center; gap:10px; padding:12px 16px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:10px; max-width:520px; text-align:left;">
          <span style="font-size:1.5rem; flex-shrink:0;">&#9888;</span>
          <span>เบราว์เซอร์นี้ยังไม่รองรับ Web Serial API กรุณาเปิดด้วย <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong> บนคอมพิวเตอร์ (Desktop)</span>
        </div>`;
      return;
    }

    // Create Blob URL for Manifest
    const manifestBlob = new Blob([JSON.stringify(manifestObject)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    activeBlobUrls.push(manifestUrl);

    // Create new install button element (no "unsupported" slot — handled above)
    const installBtn = document.createElement('esp-web-install-button');
    installBtn.setAttribute('manifest', manifestUrl);

    // Add slotted custom activate button
    const customSlotBtn = document.createElement('button');
    customSlotBtn.slot = 'activate';
    customSlotBtn.className = 'custom-flash-btn';
    customSlotBtn.innerHTML = '&#9889; Connect &amp; Flash เข้า Espino32';

    // Friendly notification if Web Component has not yet finished loading from CDN
    customSlotBtn.addEventListener('click', () => {
      if (!customElements.get('esp-web-install-button')) {
        alert('กำลังโหลดโมดูล ESP Web Flasher กรุณารอสักครู่หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      }
    });

    installBtn.appendChild(customSlotBtn);
    container.appendChild(installBtn);
  }


  // 6. Web Serial Terminal / Monitor
  termConnectBtn.addEventListener('click', async () => {
    if (serialPort) {
      await disconnectSerial();
    } else {
      await connectSerial();
    }
  });

  async function connectSerial() {
    if (!('serial' in navigator)) {
      alert('เบราว์เซอร์ไม่รองรับ Web Serial API กรุณาใช้ Chrome หรือ Edge');
      return;
    }

    try {
      serialPort = await navigator.serial.requestPort();
      const baudRate = parseInt(termBaudSelect.value, 10) || 115200;
      await serialPort.open({ baudRate: baudRate });

      termConnectBtn.textContent = '❌ ตัดการเชื่อมต่อ (Disconnect)';
      termConnectBtn.className = 'terminal-btn disconnect';
      termResetBtn.disabled = false;
      appendTerminal(`[Connected to Serial Port at ${baudRate} baud]\n`, '#10b981');

      serialKeepReading = true;
      readSerialLoop();
    } catch (err) {
      console.error('Serial connection error:', err);
      appendTerminal(`[Connection Failed: ${err.message}]\n`, '#ef4444');
      serialPort = null;
    }
  }

  async function readSerialLoop() {
    while (serialPort && serialPort.readable && serialKeepReading) {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
      serialReader = textDecoder.readable.getReader();

      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) break;
          if (value) {
            appendTerminal(value);
          }
        }
      } catch (err) {
        console.warn('Serial read error:', err);
      } finally {
        serialReader.releaseLock();
      }
    }
  }

  async function disconnectSerial() {
    serialKeepReading = false;
    if (serialReader) {
      await serialReader.cancel().catch(() => {});
    }
    if (serialPort) {
      await serialPort.close().catch(() => {});
      serialPort = null;
    }
    termConnectBtn.textContent = '🔌 เชื่อมต่อ (Connect)';
    termConnectBtn.className = 'terminal-btn connect';
    termResetBtn.disabled = true;
    appendTerminal(`\n[Disconnected]\n`, '#f59e0b');
  }

  // Reset ESP32 board (Pulse RTS/DTR pins)
  termResetBtn.addEventListener('click', async () => {
    if (!serialPort) return;
    try {
      appendTerminal(`\n[Resetting ESP32 via RTS/DTR toggle...]\n`, '#38bdf8');
      await serialPort.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(100);
      await serialPort.setSignals({ dataTerminalReady: true, requestToSend: false });
      await sleep(50);
      await serialPort.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch (err) {
      console.error('Reset error:', err);
      appendTerminal(`[Reset Failed: ${err.message}]\n`, '#ef4444');
    }
  });

  // Clear Screen
  termClearBtn.addEventListener('click', () => {
    termScreen.textContent = '';
  });

  // Send Command to Serial
  termSendBtn.addEventListener('click', sendSerialInput);
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendSerialInput();
    }
  });

  async function sendSerialInput() {
    const text = termInput.value;
    if (!serialPort || !text) return;
    try {
      const encoder = new TextEncoder();
      const writer = serialPort.writable.getWriter();
      await writer.write(encoder.encode(text + '\r\n'));
      writer.releaseLock();
      termInput.value = '';
    } catch (err) {
      console.error('Send error:', err);
      appendTerminal(`[Send Failed: ${err.message}]\n`, '#ef4444');
    }
  }

  function appendTerminal(text, color = null) {
    if (color) {
      const span = document.createElement('span');
      span.style.color = color;
      span.textContent = text;
      termScreen.appendChild(span);
    } else {
      termScreen.appendChild(document.createTextNode(text));
    }

    if (termAutoscroll.checked) {
      termScreen.scrollTop = termScreen.scrollHeight;
    }
  }

  // 7. Guide Accordions
  guideHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.guide-item');
      item.classList.toggle('open');
    });
  });

  // Utility Functions
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(string) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
    return String(string).replace(/[&<>"'/]/g, (s) => entityMap[s]);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =========================================================================
  // Authentication & Authorization (Admin Only: schoolconsortium.fibo@gmail.com)
  // =========================================================================
  function initAuth() {
    updateAuthUI();

    // Fill Client ID input if already saved
    if (customClientIdInput) {
      customClientIdInput.value = googleClientId;
    }

    // Modal Close
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeLoginModal);
    }
    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
      });
    }

    // Locked View Button
    if (lockedViewLoginBtn) {
      lockedViewLoginBtn.addEventListener('click', openLoginModal);
    }

    // Direct Google Button Click
    if (googleCustomLoginBtn) {
      googleCustomLoginBtn.addEventListener('click', () => {
        hideModalError();
        // If GIS loaded and initialized with Client ID, invoke prompt
        if (window.google && window.google.accounts && googleClientId) {
          try {
            google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                fallbackGoogleLoginPrompt();
              }
            });
            return;
          } catch (e) {
            console.warn('GIS Prompt error:', e);
          }
        }
        // Fallback login prompt
        fallbackGoogleLoginPrompt();
      });
    }

    // Dev / Test Simulation Button
    if (simulateAdminLoginBtn) {
      simulateAdminLoginBtn.addEventListener('click', () => {
        loginSuccess({
          email: REQUIRED_ADMIN_EMAIL,
          name: 'FIBO Consortium Admin',
          picture: ''
        });
      });
    }

    // Save Client ID
    if (saveClientIdBtn) {
      saveClientIdBtn.addEventListener('click', () => {
        const id = customClientIdInput.value.trim();
        googleClientId = id;
        localStorage.setItem('esp32_google_client_id', id);
        alert('บันทึก Google OAuth Client ID เรียบร้อยแล้ว!');
        setupGoogleGIS();
      });
    }

    // Attempt GIS Setup
    window.addEventListener('load', () => {
      setTimeout(setupGoogleGIS, 500);
    });
  }

  function setupGoogleGIS() {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    if (!googleClientId) return;

    try {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });

      const container = document.getElementById('gsiButtonContainer');
      if (container) {
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          theme: 'filled_blue',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 320
        });
      }
    } catch (err) {
      console.warn('Failed to initialize GIS:', err);
    }
  }

  function handleGoogleCredentialResponse(response) {
    const payload = decodeJwt(response.credential);
    if (!payload || !payload.email) {
      showModalError('ไม่สามารถอ่านข้อมูลบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    if (payload.email.toLowerCase() === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
      loginSuccess({
        email: payload.email,
        name: payload.name || 'School Consortium Admin',
        picture: payload.picture || ''
      });
    } else {
      showModalError(`⛔ บัญชี "${payload.email}" ไม่มีสิทธิ์เข้าถึง!<br>ระบบอนุญาตเฉพาะบัญชีผู้ดูแลระบบ (Admin) เท่านั้น`);
    }
  }

  function fallbackGoogleLoginPrompt() {
    const inputEmail = prompt('กรุณาระบุอีเมล Google ของคุณเพื่อเข้าสู่ระบบผู้ดูแลระบบ:');
    if (inputEmail === null) return;

    if (inputEmail.trim().toLowerCase() === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
      loginSuccess({
        email: REQUIRED_ADMIN_EMAIL,
        name: 'School Consortium Admin',
        picture: ''
      });
    } else {
      showModalError(`⛔ บัญชี "${inputEmail}" ไม่มีสิทธิ์เข้าถึง!<br>ระบบอนุญาตเฉพาะบัญชีผู้ดูแลระบบ (Admin) เท่านั้น`);
    }
  }

  function loginSuccess(userData) {
    currentUser = userData;
    localStorage.setItem('esp32_admin_user', JSON.stringify(currentUser));
    closeLoginModal();
    updateAuthUI();
    switchTab('upload-tab');
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem('esp32_admin_user');
    updateAuthUI();
    switchTab('github-tab');
  }

  function updateAuthUI() {
    const isAuth = isAuthorizedAdmin();

    // 1. Update Tab Button
    if (uploadTabBtn) {
      if (isAuth) {
        uploadTabBtn.classList.add('unlocked');
        if (uploadTabIcon) uploadTabIcon.textContent = '💻';
        if (uploadTabLockBadge) {
          uploadTabLockBadge.textContent = '👑 ปลดล็อกแล้ว';
          uploadTabLockBadge.style.background = 'rgba(16, 185, 129, 0.2)';
          uploadTabLockBadge.style.color = '#a7f3d0';
          uploadTabLockBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        }
      } else {
        uploadTabBtn.classList.remove('unlocked');
        if (uploadTabIcon) uploadTabIcon.textContent = '🔒';
        if (uploadTabLockBadge) {
          uploadTabLockBadge.textContent = 'เฉพาะแอดมิน';
          uploadTabLockBadge.style.background = 'rgba(245, 158, 11, 0.2)';
          uploadTabLockBadge.style.color = '#fde68a';
          uploadTabLockBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        }
      }
    }

    // 2. Update Tab Content Views
    if (uploadLockedView && uploadUnlockedView) {
      if (isAuth) {
        uploadLockedView.style.display = 'none';
        uploadUnlockedView.style.display = 'block';
      } else {
        uploadLockedView.style.display = 'block';
        uploadUnlockedView.style.display = 'none';
      }
    }

    // 3. Update Header Auth Bar
    if (authHeaderBar) {
      if (isAuth) {
        authHeaderBar.innerHTML = `
          <div class="auth-user-badge">
            <span>👑</span>
            <span><strong>Admin:</strong> ${escapeHtml(currentUser.email)}</span>
            <button type="button" class="auth-logout-btn" id="authLogoutBtn">ออกจากระบบ</button>
          </div>
        `;
        const logoutBtn = document.getElementById('authLogoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', logout);
        }
      } else {
        authHeaderBar.innerHTML = `
          <button type="button" class="auth-login-header-btn" id="authHeaderLoginBtn">
            <span>🔑</span>
            <span>เข้าสู่ระบบ Admin (Google)</span>
          </button>
        `;
        const loginBtn = document.getElementById('authHeaderLoginBtn');
        if (loginBtn) {
          loginBtn.addEventListener('click', openLoginModal);
        }
      }
    }
  }

  function openLoginModal() {
    hideModalError();
    if (loginModal) {
      loginModal.classList.add('active');
    }
    setupGoogleGIS();
  }

  function closeLoginModal() {
    if (loginModal) {
      loginModal.classList.remove('active');
    }
    hideModalError();
  }

  function showModalError(message) {
    if (modalErrorAlert) {
      modalErrorAlert.innerHTML = message;
      modalErrorAlert.classList.add('active');
    }
  }

  function hideModalError() {
    if (modalErrorAlert) {
      modalErrorAlert.innerHTML = '';
      modalErrorAlert.classList.remove('active');
    }
  }

  function decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to decode JWT:', e);
      return null;
    }
  }

  // ==========================================
  // 7. GitHub Repository Upload Implementation
  // ==========================================
  initGithubUpload();

  function initGithubUpload() {
    // Load saved settings if any
    const savedGhToken = localStorage.getItem('esp32_github_token');
    if (savedGhToken && ghTokenInput) {
      ghTokenInput.value = savedGhToken;
    }
    const savedRepoOwner = localStorage.getItem('esp32_github_owner');
    if (savedRepoOwner && ghRepoOwner) ghRepoOwner.value = savedRepoOwner;
    const savedRepoName = localStorage.getItem('esp32_github_repo');
    if (savedRepoName && ghRepoName) ghRepoName.value = savedRepoName;
    const savedRepoBranch = localStorage.getItem('esp32_github_branch');
    if (savedRepoBranch && ghRepoBranch) ghRepoBranch.value = savedRepoBranch;

    // Toggle password visibility
    if (ghToggleTokenVisibilityBtn && ghTokenInput) {
      ghToggleTokenVisibilityBtn.addEventListener('click', () => {
        if (ghTokenInput.type === 'password') {
          ghTokenInput.type = 'text';
          ghToggleTokenVisibilityBtn.textContent = '🙈';
        } else {
          ghTokenInput.type = 'password';
          ghToggleTokenVisibilityBtn.textContent = '👁️';
        }
      });
    }

    // Open Modal
    if (openGithubUploadBtn) {
      openGithubUploadBtn.addEventListener('click', () => {
        if (!localFile) {
          alert('กรุณาเลือกไฟล์ .bin ก่อนทำการอัปโหลด');
          return;
        }
        openGithubModal();
      });
    }

    // Close Modal buttons
    if (ghModalCloseBtn) ghModalCloseBtn.addEventListener('click', closeGithubModal);
    if (ghCancelBtn) ghCancelBtn.addEventListener('click', closeGithubModal);

    // Close on overlay backdrop click
    if (githubUploadModal) {
      githubUploadModal.addEventListener('click', (e) => {
        if (e.target === githubUploadModal) closeGithubModal();
      });
    }

    // Submit Upload
    if (ghSubmitUploadBtn) {
      ghSubmitUploadBtn.addEventListener('click', handleGithubUpload);
    }
  }

  function openGithubModal() {
    if (!localFile) return;

    // Pre-populate clean program name from filename
    const rawName = localFile.name.replace(/\.ino\.bin$/i, '').replace(/\.bin$/i, '');
    const cleanName = rawName
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    
    if (ghFwName) ghFwName.value = cleanName || 'ESP32 Firmware';
    if (ghFwDesc) ghFwDesc.value = `โปรแกรม ${cleanName || 'ESP32'} สำหรับหุ่นยนต์ Mobile Robot (FIBO School Consortium)`;
    
    // Set Author
    if (ghFwAuthor) {
      ghFwAuthor.value = (currentUser && (currentUser.name || currentUser.email)) 
        ? `${currentUser.name || currentUser.email}`
        : 'FIBO School Consortium';
    }

    // Offset
    const offsetNum = getSelectedOffset();
    const offsetHex = '0x' + offsetNum.toString(16).toUpperCase();
    if (ghFwOffset) ghFwOffset.value = `${offsetHex} (${offsetNum})`;

    // Reset status & button states
    if (ghUploadStatusBox) ghUploadStatusBox.style.display = 'none';
    if (ghStatusError) {
      ghStatusError.style.display = 'none';
      ghStatusError.innerHTML = '';
    }
    [ghStep1, ghStep2, ghStep3, ghStep4].forEach(s => {
      if (s) s.className = 'gh-step';
    });

    if (ghSubmitUploadBtn) {
      ghSubmitUploadBtn.disabled = false;
      ghSubmitUploadBtn.style.display = 'inline-flex';
    }
    if (ghCancelBtn) ghCancelBtn.style.display = 'inline-flex';
    if (ghViewCatalogBtn) ghViewCatalogBtn.style.display = 'none';
    if (ghViewRepoLink) ghViewRepoLink.style.display = 'none';

    // Show modal
    if (githubUploadModal) githubUploadModal.classList.add('active');
  }

  function closeGithubModal() {
    if (githubUploadModal) {
      githubUploadModal.classList.remove('active');
    }
  }

  async function handleGithubUpload() {
    if (!localFile) {
      alert('ไม่พบไฟล์ .bin');
      return;
    }

    const fwName = ghFwName.value.trim();
    const fwVersion = (ghFwVersion.value || '1.0.0').trim();
    const fwCategory = ghFwCategory.value;
    const fwDesc = (ghFwDesc.value || `โปรแกรม ${fwName} สำหรับ ESP32`).trim();
    const fwAuthor = (ghFwAuthor.value || 'FIBO School Consortium').trim();
    const owner = (ghRepoOwner.value || 'schoolconsortiumfibo-code').trim();
    const repo = (ghRepoName.value || 'esp32-web-flash').trim();
    const branch = (ghRepoBranch.value || 'main').trim();
    const token = ghTokenInput.value.trim();

    if (!fwName) {
      alert('กรุณาระบุชื่อโปรแกรม');
      ghFwName.focus();
      return;
    }

    if (!token) {
      alert('กรุณากรอก GitHub Personal Access Token (PAT) ที่มีสิทธิ์ repo เพื่อให้อนุญาตเขียนไฟล์ลง Repository ได้');
      ghTokenInput.focus();
      return;
    }

    if (!owner || !repo) {
      alert('กรุณาระบุ Owner และ Repository Name');
      return;
    }

    // Save token if checked
    if (ghRememberTokenCheck && ghRememberTokenCheck.checked) {
      localStorage.setItem('esp32_github_token', token);
      localStorage.setItem('esp32_github_owner', owner);
      localStorage.setItem('esp32_github_repo', repo);
      localStorage.setItem('esp32_github_branch', branch);
    } else {
      localStorage.removeItem('esp32_github_token');
    }

    // Set UI state to Uploading
    ghSubmitUploadBtn.disabled = true;
    ghCancelBtn.style.display = 'none';
    ghUploadStatusBox.style.display = 'flex';
    ghStatusError.style.display = 'none';
    ghStatusError.innerHTML = '';
    ghStatusSpinner.textContent = '⏳';
    ghStatusTitle.textContent = 'กำลังดำเนินการอัปโหลดเข้า GitHub...';

    const setStep = (stepEl, status) => {
      if (stepEl) stepEl.className = `gh-step ${status}`;
    };

    try {
      // Step 1: Read binary as Base64
      setStep(ghStep1, 'active');
      ghStatusTitle.textContent = '1/4 กำลังแปลงไฟล์ .bin เป็น Base64...';
      const base64Content = await readBinaryFileAsBase64(localFile);
      setStep(ghStep1, 'done');

      // Step 2: Upload .bin to GitHub contents API
      setStep(ghStep2, 'active');
      ghStatusTitle.textContent = `2/4 กำลังอัปโหลดไฟล์ ${localFile.name} ขึ้น GitHub...`;

      const filename = localFile.name;
      const fileEndpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filename)}?ref=${encodeURIComponent(branch)}`;

      let existingFileSha = null;
      try {
        const checkRes = await fetch(fileEndpoint, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (checkRes.ok) {
          const fileData = await checkRes.json();
          existingFileSha = fileData.sha;
        } else if (checkRes.status === 401 || checkRes.status === 403) {
          throw new Error('GitHub Token ไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง Repository นี้ (กรุณาตรวจสอบสิทธิ์ repo ใน Token)');
        }
      } catch (errCheck) {
        if (errCheck.message && errCheck.message.includes('Token')) throw errCheck;
      }

      const uploadBody = {
        message: `Upload firmware binary: ${filename} via Web Flasher Admin`,
        content: base64Content,
        branch: branch
      };
      if (existingFileSha) {
        uploadBody.sha = existingFileSha;
      }

      const uploadRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadBody)
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(`อัปโหลดไฟล์ .bin ไม่สำเร็จ: ${errJson.message || uploadRes.statusText}`);
      }

      setStep(ghStep2, 'done');

      // Step 3: Fetch and update firmwares.json
      setStep(ghStep3, 'active');
      ghStatusTitle.textContent = '3/4 กำลังอัปเดตข้อมูลใน firmwares.json...';

      const jsonEndpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/firmwares.json?ref=${encodeURIComponent(branch)}`;
      let firmwaresSha = null;
      let catalogList = [];

      const getJsonRes = await fetch(jsonEndpoint, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getJsonRes.ok) {
        const jsonData = await getJsonRes.json();
        firmwaresSha = jsonData.sha;
        try {
          const jsonText = base64ToUtf8(jsonData.content);
          catalogList = JSON.parse(jsonText);
          if (!Array.isArray(catalogList)) catalogList = [];
        } catch (e) {
          console.warn('Could not parse existing firmwares.json, resetting array:', e);
          catalogList = [];
        }
      }

      const offsetNum = getSelectedOffset();
      const offsetHex = '0x' + offsetNum.toString(16).toUpperCase();
      const firmwareId = filename.replace(/\.bin$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

      const newEntry = {
        id: firmwareId,
        name: fwName,
        version: fwVersion,
        chipFamily: "ESP32",
        category: fwCategory,
        description: fwDesc,
        filename: filename,
        offset: offsetNum,
        offsetHex: offsetHex,
        date: new Date().toISOString().split('T')[0],
        author: fwAuthor,
        tags: [fwCategory, "ESP32", "WebUpload"]
      };

      const existingIndex = catalogList.findIndex(item => item.filename === filename || item.id === firmwareId);
      if (existingIndex >= 0) {
        catalogList[existingIndex] = newEntry;
      } else {
        catalogList.push(newEntry);
      }

      const updatedJsonString = JSON.stringify(catalogList, null, 2);
      const updatedJsonBase64 = utf8ToBase64(updatedJsonString);

      const updateJsonBody = {
        message: `Update firmwares.json catalog: add/update ${filename}`,
        content: updatedJsonBase64,
        branch: branch
      };
      if (firmwaresSha) {
        updateJsonBody.sha = firmwaresSha;
      }

      const updateJsonRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/firmwares.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateJsonBody)
      });

      if (!updateJsonRes.ok) {
        const errJson = await updateJsonRes.json().catch(() => ({}));
        throw new Error(`อัปเดต firmwares.json ไม่สำเร็จ: ${errJson.message || updateJsonRes.statusText}`);
      }

      setStep(ghStep3, 'done');

      // Step 4: Finish & Local State Update
      setStep(ghStep4, 'done');
      ghStatusSpinner.textContent = '🎉';
      ghStatusTitle.textContent = 'อัปโหลดเข้า GitHub และบันทึกเข้าคลังโปรแกรมสำเร็จแล้ว!';

      // Update in-memory catalog and re-render tab 1
      firmwares = catalogList;
      renderFirmwareList();

      // Update modal buttons
      ghSubmitUploadBtn.style.display = 'none';
      ghCancelBtn.style.display = 'none';
      ghViewCatalogBtn.style.display = 'inline-flex';

      const fileGithubUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${encodeURIComponent(filename)}`;
      ghViewRepoLink.href = fileGithubUrl;
      ghViewRepoLink.style.display = 'inline-flex';

      ghViewCatalogBtn.onclick = () => {
        closeGithubModal();
        switchTab('github-tab');
        const card = document.querySelector(`.firmware-card[data-id="${firmwareId}"]`);
        if (card) {
          document.querySelectorAll('.firmware-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectFirmware(newEntry);
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

    } catch (err) {
      console.error('GitHub Upload Error:', err);
      ghStatusSpinner.textContent = '❌';
      ghStatusTitle.textContent = 'เกิดข้อผิดพลาดในการอัปโหลด';
      ghStatusError.innerHTML = `<strong>เกิดข้อผิดพลาด:</strong> ${escapeHtml(err.message)}`;
      ghStatusError.style.display = 'block';
      ghSubmitUploadBtn.disabled = false;
      ghCancelBtn.style.display = 'inline-flex';
    }
  }

  function readBinaryFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.substring(result.indexOf(',') + 1);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binString = "";
    for (let i = 0; i < bytes.length; i++) {
      binString += String.fromCharCode(bytes[i]);
    }
    return btoa(binString);
  }

  function base64ToUtf8(base64) {
    const binString = atob(base64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
});

