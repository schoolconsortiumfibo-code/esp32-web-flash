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

  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const browserAlert = document.getElementById('browserAlert');
  
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

  // 1. Check Browser Web Serial API Support
  checkBrowserSupport();

  // 2. Tab Navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  function switchTab(tabId) {
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
          id: 'ailas_firebase_v2',
          name: 'AILAS Firebase Robot Controller V2',
          version: '2.0.0',
          chipFamily: 'ESP32',
          category: 'Robot Controller',
          description: 'โปรแกรมควบคุมหุ่นยนต์ Mobile Robot เชื่อมต่อ Firebase Realtime Database สำหรับโครงการ FIBO-School Consortium',
          filename: 'ailas_firebase_V2.ino.bin',
          offset: 65536,
          offsetHex: '0x10000',
          date: '2026-09-09',
          author: 'FIBO School Consortium',
          tags: ['Robot', 'Firebase', 'ESP32', 'Default']
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
    const manifest = {
      name: fw.name,
      version: fw.version || "1.0.0",
      builds: [
        {
          chipFamily: fw.chipFamily || "ESP32",
          parts: [
            {
              path: fw.filename,
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
    customFlashSummary.innerHTML = 'กรุณาเลือกไฟล์ <code>.bin</code> เพื่อเปิดใช้งานปุ่ม Flash';
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

    // Create Blob URL for Manifest
    const manifestBlob = new Blob([JSON.stringify(manifestObject)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    activeBlobUrls.push(manifestUrl);

    // Create new install button element
    const installBtn = document.createElement('esp-web-install-button');
    installBtn.setAttribute('manifest', manifestUrl);

    // Add slotted custom button
    const customSlotBtn = document.createElement('button');
    customSlotBtn.slot = 'activate';
    customSlotBtn.className = 'custom-flash-btn';
    customSlotBtn.innerHTML = '⚡ Connect & Flash เข้า Espino32';

    const unsupportedSpan = document.createElement('span');
    unsupportedSpan.slot = 'unsupported';
    unsupportedSpan.style.color = '#fca5a5';
    unsupportedSpan.innerHTML = '⚠️ เบราว์เซอร์นี้ไม่รองรับ Web Serial กรุณาเปิดด้วย Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์';

    installBtn.appendChild(customSlotBtn);
    installBtn.appendChild(unsupportedSpan);

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
});
