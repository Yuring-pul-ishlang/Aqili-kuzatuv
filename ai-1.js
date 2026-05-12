/* ═══════════════════════════════════════════
   XALQ KAMERA v2.0 Pro — AI & App Logic
════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────
const STATE = {
  cameraActive: false,
  recording: false,
  mediaRecorder: null,
  recordedChunks: [],
  recordStartTime: null,
  recordDuration: 0,
  stream: null,
  currentFacing: 'environment',
  aiRunning: false,
  cocoModel: null,
  faceModel: null,
  animFrame: null,
  zones: [],
  drawingZone: false,
  zonePoints: [],
  zoneColor: '#ff3b5c',
  workers: [],
  alerts: [],
  photos: [],
  videos: [],
  eventLog: [],
  stats: {
    people: 0, alerts: 0, suspicious: 0,
    safe: 0, workersIn: 0, ppeFail: 0,
    weekTotal: 0, weekCritical: 0
  },
  objectCounts: {},
  hourlyData: new Array(24).fill(0),
  weekData: new Array(7).fill(0),
  uptime: 0,
  fps: 0,
  lastFrameTime: 0,
  settings: {
    person: true, suspicious: true, fall: true,
    zone: true, crowd: true, cover: true,
    night: false, abandon: true,
    sound: true, vibrate: true, flash: true,
    'critical-only': false,
    'cat-critical': true, 'cat-warning': true,
    'cat-info': true, 'cat-worker': true,
    'auto-attend': true, 'late-alert': true,
    idle: true, ppe: true, 'phone-use': true,
    'unauth-zone': true
  },
  ppe: { helmet: true, vest: true, mask: false, gloves: false },
  sensitivity: 7,
  workStart: '08:00',
  workEnd: '17:00',
  lunchMin: 30,
  alertFilter: 'all',
  currentTab: 'live',
  ipCameras: [],
  hikvisionList: [],
  currentPhotoIndex: null
};

// ─── SPLASH ───────────────────────────────
window.addEventListener('load', async () => {
  loadData();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(() => { STATE.uptime++; updateUptime(); }, 1000);

  const steps = [
    ['TensorFlow yuklanmoqda...', 20],
    ['COCO-SSD modeli yuklanmoqda...', 45],
    ['BlazeFace yuklanmoqda...', 70],
    ['Tizim sozlamalari...', 85],
    ['Tayyor!', 100]
  ];

  for (const [msg, pct] of steps) {
    setProgress(msg, pct);
    await sleep(400);
  }

  try {
    setProgress('COCO-SSD yuklanmoqda...', 50);
    STATE.cocoModel = await cocoSsd.load();
    setProgress('BlazeFace yuklanmoqda...', 75);
    STATE.faceModel = await blazeface.load();
    setProgress('AI tayyor!', 100);
  } catch(e) {
    setProgress('AI demo rejimda ishlaydi', 100);
  }

  await sleep(500);
  document.getElementById('splash').style.opacity = '0';
  await sleep(500);
  document.getElementById('splash').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  initCharts();
  renderWorkers();
  renderAlerts();
  renderPPELog();
  renderEfficiency();
  renderStats();
  renderVideos();
  renderPhotos();
  renderIPCameras();
  startDemoMode();
});

function setProgress(msg, pct) {
  document.getElementById('splash-progress').style.width = pct + '%';
  document.getElementById('splash-status').textContent = msg;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── CLOCK ───────────────────────────────
function updateClock() {
  const now = new Date();
  const t = now.toTimeString().slice(0,8);
  document.getElementById('topbar-clock').textContent = t;
  document.getElementById('time-badge').textContent = t;
  checkWorkTime();
}

function updateUptime() {
  const h = Math.floor(STATE.uptime/3600);
  const m = Math.floor((STATE.uptime%3600)/60);
  const s = STATE.uptime%60;
  const str = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const el = document.getElementById('info-uptime');
  if (el) el.textContent = str;
}

function pad(n) { return String(n).padStart(2,'0'); }

// ─── TAB NAVIGATION ──────────────────────
function showTab(tab) {
  STATE.currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const pg = document.getElementById('page-' + tab);
  const tb = document.getElementById('tab-' + tab);
  if (pg) pg.classList.add('active');
  if (tb) tb.classList.add('active');
}

// Worker sub-tabs
function showWorkerTab(tab) {
  document.querySelectorAll('.wpage').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.wtab').forEach(t => t.classList.remove('active'));
  const pg = document.getElementById('wpage-' + tab);
  const tb = document.getElementById('wtab-' + tab);
  if (pg) pg.classList.add('active');
  if (tb) tb.classList.add('active');
}

// Camera sub-tabs
function showCamTab(tab) {
  document.querySelectorAll('.cpage').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  document.getElementById('cpage-' + tab).classList.add('active');
  document.getElementById('ctab-' + tab).classList.add('active');
}

// Alert sub-tabs
function showAlertTab(tab) {
  STATE.alertFilter = tab;
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  document.getElementById('atab-' + tab).classList.add('active');
  renderAlerts();
}

// Records sub-tabs
function showRecTab(tab) {
  document.querySelectorAll('.rpage').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('rpage-' + tab).classList.add('active');
  document.getElementById('rtab-' + tab).classList.add('active');
}

// Stats sub-tabs
function showStatsTab(tab) {
  document.querySelectorAll('.spage').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
  document.getElementById('spage-' + tab).classList.add('active');
  document.getElementById('stab-' + tab).classList.add('active');
}

// Settings sub-tabs
function showSettTab(tab) {
  document.querySelectorAll('.setpage').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settab').forEach(t => t.classList.remove('active'));
  document.getElementById('setpage-' + tab).classList.add('active');
  document.getElementById('settab-' + tab).classList.add('active');
}

// ─── CAMERA ──────────────────────────────
async function startPhoneCamera() {
  if (STATE.cameraActive) return;
  const facing = STATE.currentFacing;
  const quality = document.getElementById('quality-select')?.value || '720';
  const h = parseInt(quality);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, height: { ideal: h } },
      audio: false
    });
    STATE.stream = stream;
    const video = document.getElementById('main-video');
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      STATE.cameraActive = true;
      document.getElementById('no-cam').style.display = 'none';
      document.getElementById('phone-cam-status').textContent = 'Yoqilgan ✓';
      document.getElementById('phone-cam-status').className = 'cam-status-text on';
      document.getElementById('phone-cam-toggle').textContent = '⏸';
      document.getElementById('phone-cam-toggle').className = 'cam-toggle on';
      document.getElementById('ai-badge').textContent = 'AI ON';
      document.getElementById('ai-status-dot').className = 'status-dot online';
      document.getElementById('active-cam-name').textContent = facing === 'user' ? 'Old Kamera' : 'Orqa Kamera';
      document.getElementById('rec-badge').style.display = '';
      startAI();
    };
    // Also update grid video
    const gv = document.getElementById('grid-video-0');
    if (gv) gv.srcObject = stream;
  } catch(e) {
    addAlert('critical', '📷 Kamera Xatosi', 'Kameraga ruxsat berilmadi: ' + e.message, 'Telefon');
  }
}

function togglePhoneCamera() {
  if (STATE.cameraActive) {
    stopCamera();
  } else {
    startPhoneCamera();
  }
}

function stopCamera() {
  if (STATE.stream) {
    STATE.stream.getTracks().forEach(t => t.stop());
    STATE.stream = null;
  }
  STATE.cameraActive = false;
  if (STATE.animFrame) cancelAnimationFrame(STATE.animFrame);
  STATE.aiRunning = false;
  document.getElementById('main-video').srcObject = null;
  document.getElementById('no-cam').style.display = '';
  document.getElementById('phone-cam-status').textContent = "O'chirilgan";
  document.getElementById('phone-cam-status').className = 'cam-status-text';
  document.getElementById('phone-cam-toggle').textContent = '▶';
  document.getElementById('phone-cam-toggle').className = 'cam-toggle';
  document.getElementById('ai-badge').textContent = 'AI OFF';
  document.getElementById('ai-status-dot').className = 'status-dot';
  clearCanvas();
}

function flipCamera() {
  STATE.currentFacing = STATE.currentFacing === 'environment' ? 'user' : 'environment';
  if (STATE.cameraActive) { stopCamera(); setTimeout(startPhoneCamera, 300); }
  document.getElementById('camera-select').value = STATE.currentFacing;
}

function switchCamera(val) {
  STATE.currentFacing = val;
  if (STATE.cameraActive) { stopCamera(); setTimeout(startPhoneCamera, 300); }
}

function changeQuality(val) {
  if (STATE.cameraActive) { stopCamera(); setTimeout(startPhoneCamera, 300); }
}

function toggleFullscreen() {
  const wrap = document.getElementById('camera-wrap');
  if (!document.fullscreenElement) {
    wrap.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function clearCanvas() {
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

// ─── AI DETECTION ────────────────────────
async function startAI() {
  STATE.aiRunning = true;
  runDetection();
}

async function runDetection() {
  if (!STATE.aiRunning || !STATE.cameraActive) return;
  const video = document.getElementById('main-video');
  const canvas = document.getElementById('main-canvas');
  if (!video.videoWidth) { STATE.animFrame = requestAnimationFrame(runDetection); return; }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const now = performance.now();
  const delta = now - STATE.lastFrameTime;
  STATE.fps = Math.round(1000 / delta);
  STATE.lastFrameTime = now;
  document.getElementById('fps-badge').textContent = STATE.fps + ' FPS';
  document.getElementById('info-fps').textContent = STATE.fps + ' FPS';

  let predictions = [];
  let faces = [];
  try {
    if (STATE.cocoModel) predictions = await STATE.cocoModel.detect(video);
    if (STATE.faceModel) faces = await STATE.faceModel.estimateFaces(video, false);
  } catch(e) {}

  let peopleCount = 0;
  const objCounts = {};

  for (const pred of predictions) {
    const [x,y,w,h] = pred.bbox;
    const conf = Math.round(pred.score * 100);
    if (conf < STATE.sensitivity * 5) continue;

    objCounts[pred.class] = (objCounts[pred.class] || 0) + 1;

    let color = '#00ccff';
    let label = pred.class;

    if (pred.class === 'person') {
      peopleCount++;
      color = '#00ff88';
      label = `Odam ${conf}%`;
      checkZoneViolation(x + w/2, y + h/2, canvas.width, canvas.height);
    } else if (['knife','scissors'].includes(pred.class)) {
      color = '#ff3b5c';
      label = `⚠️ ${pred.class}`;
      if (STATE.settings['cat-critical']) {
        addAlert('critical', '🔪 Xavfli Ob\'ekt', `Kadrda "${pred.class}" aniqlandi`, 'Kamera');
      }
    } else if (['cell phone','book'].includes(pred.class) && STATE.settings['phone-use']) {
      color = '#ffcc00';
      label = `📱 ${pred.class}`;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(x, y - 18, ctx.measureText(label).width + 10, 18);
    ctx.fillStyle = '#000';
    ctx.font = '11px monospace';
    ctx.fillText(label, x + 5, y - 4);
  }

  // Faces
  for (const face of faces) {
    const [x,y] = face.topLeft;
    const [x2,y2] = face.bottomRight;
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, x2-x, y2-y);
  }

  STATE.objectCounts = objCounts;
  STATE.stats.people = Math.max(STATE.stats.people, peopleCount);

  document.getElementById('stat-people').textContent = peopleCount;
  document.getElementById('stat-objects').textContent = Object.keys(objCounts).length;

  // Crowd detection
  if (peopleCount >= 5 && STATE.settings.crowd) {
    addAlert('warning', '👥 Olomon Aniqlandi', `${peopleCount} ta odam bir joyda`, 'Kamera');
  }

  // Cover detection (many faces near edges)
  if (faces.length > 0) {
    const [x,y] = faces[0].topLeft;
    const faceArea = Math.abs((faces[0].bottomRight[0]-x) * (faces[0].bottomRight[1]-y));
    const totalArea = canvas.width * canvas.height;
    if (faceArea / totalArea > 0.4 && STATE.settings.cover) {
      addAlert('critical', '🖐 Kamera Yopilmoqda!', 'Kameraga yaqin ob\'ekt aniqlandi', 'Kamera');
    }
  }

  // Hour statistics
  const hour = new Date().getHours();
  STATE.hourlyData[hour] = Math.max(STATE.hourlyData[hour], peopleCount);
  updateCharts();
  updateObjectReport();

  STATE.animFrame = requestAnimationFrame(runDetection);
}

function checkZoneViolation(cx, cy, canvasW, canvasH) {
  if (!STATE.settings.zone) return;
  for (const zone of STATE.zones) {
    if (!zone.points || zone.points.length < 3) continue;
    const px = cx / canvasW, py = cy / canvasH;
    if (pointInPolygon(px, py, zone.points)) {
      addAlert('critical', '🚧 Zona Buzildi!', `Taqiqlangan "${zone.name}" zonasiga kirish aniqlandi`, 'Kamera');
    }
  }
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i=0, j=points.length-1; i<points.length; j=i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    if ((yi>py) !== (yj>py) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside = !inside;
  }
  return inside;
}

// ─── ZONE DRAWING ────────────────────────
function startDrawZone() {
  if (!STATE.cameraActive) { alert('Avval kamerani yoqing!'); return; }
  STATE.drawingZone = true;
  STATE.zonePoints = [];
  addAlert('info', '🔲 Zona Chizish', 'Kamera ekraniga bosing, zona chizing. 3+ nuqta kerak.', 'Tizim');
  const canvas = document.getElementById('main-canvas');
  canvas.style.pointerEvents = 'all';
  canvas.onclick = zoneClick;
}

function zoneClick(e) {
  if (!STATE.drawingZone) return;
  const canvas = document.getElementById('main-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  STATE.zonePoints.push({ x, y });
  if (STATE.zonePoints.length >= 3) {
    const name = 'Zona ' + (STATE.zones.length + 1);
    STATE.zones.push({ name, points: [...STATE.zonePoints], color: STATE.zoneColor });
    STATE.drawingZone = false;
    canvas.style.pointerEvents = 'none';
    canvas.onclick = null;
    STATE.zonePoints = [];
    renderZones();
    saveData();
    addAlert('success', '✅ Zona Qo\'shildi', `"${name}" muvaffaqiyatli yaratildi`, 'Tizim');
  }
}

function clearZones() {
  STATE.zones = [];
  renderZones();
  saveData();
}

function renderZones() {
  const list = document.getElementById('zone-list');
  if (!list) return;
  list.innerHTML = '';
  if (STATE.zones.length === 0) {
    list.innerHTML = '<div style="font-size:10px;color:#7aadc4;text-align:center;padding:6px;">Zona yo\'q</div>';
    return;
  }
  STATE.zones.forEach((z, i) => {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px;';
    el.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${z.color};display:inline-block;flex-shrink:0;"></span><span style="flex:1;">${z.name}</span><button onclick="deleteZone(${i})" style="background:none;border:none;color:#ff3b5c;cursor:pointer;font-size:12px;">✕</button>`;
    list.appendChild(el);
  });
}

function deleteZone(i) {
  STATE.zones.splice(i, 1);
  renderZones();
  saveData();
}

function setZoneColor(c) {
  STATE.zoneColor = c;
  document.querySelectorAll('.color-opt').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
}

// ─── RECORDING ───────────────────────────
function toggleRecord() {
  if (STATE.recording) {
    stopRecord();
  } else {
    startRecord();
  }
}

function startRecord() {
  if (!STATE.cameraActive) { addAlert('warning', 'Kamera yoq', 'Avval kamerani yoqing', 'Tizim'); return; }
  try {
    const stream = document.getElementById('main-video').srcObject;
    STATE.recordedChunks = [];
    STATE.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    STATE.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) STATE.recordedChunks.push(e.data); };
    STATE.mediaRecorder.onstop = saveRecording;
    STATE.mediaRecorder.start(1000);
    STATE.recording = true;
    STATE.recordStartTime = Date.now();
    document.getElementById('rec-badge').style.display = '';
    document.getElementById('btn-record').textContent = '⏹ To\'xtat';
    document.getElementById('btn-record').className = 'ctrl-btn recording';
    document.getElementById('main-rec-btn').textContent = '⏹ Yozuvni To\'xtatish';
    document.getElementById('rec-status-badge').textContent = '🔴 Yozilmoqda';
    document.getElementById('rec-status-badge').className = 'rec-status recording';
    STATE._recInterval = setInterval(updateRecDuration, 1000);
    addAlert('info', '⏺ Yozuv Boshlandi', 'Video yozuv faollashtirildi', 'Tizim');
  } catch(e) {
    addAlert('warning', 'Yozuv Xatosi', e.message, 'Tizim');
  }
}

function stopRecord() {
  if (!STATE.recording) return;
  STATE.mediaRecorder.stop();
  STATE.recording = false;
  clearInterval(STATE._recInterval);
  document.getElementById('rec-badge').style.display = 'none';
  document.getElementById('btn-record').textContent = '⏺ Yozuv';
  document.getElementById('btn-record').className = 'ctrl-btn';
  document.getElementById('main-rec-btn').textContent = '⏺ Yozuvni Boshlash';
  document.getElementById('rec-status-badge').textContent = '⏹ To\'xtatilgan';
  document.getElementById('rec-status-badge').className = 'rec-status';
  document.getElementById('rec-duration').textContent = '00:00:00';
}

function updateRecDuration() {
  if (!STATE.recordStartTime) return;
  const elapsed = Math.floor((Date.now() - STATE.recordStartTime) / 1000);
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60;
  document.getElementById('rec-duration').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const mb = (STATE.recordedChunks.reduce((a,b) => a + b.size, 0) / 1024 / 1024).toFixed(1);
  document.getElementById('rec-size').textContent = mb + ' MB';
}

function saveRecording() {
  const blob = new Blob(STATE.recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const name = `Yozuv_${now.toLocaleDateString('uz')}_${now.toLocaleTimeString('uz').replace(/:/g,'-')}.webm`;
  const size = (blob.size / 1024 / 1024).toFixed(1) + ' MB';
  const duration = STATE.recordStartTime ? Math.floor((Date.now() - STATE.recordStartTime) / 1000) : 0;
  STATE.videos.unshift({ url, name, size, date: now.toLocaleString('uz'), duration });
  document.getElementById('rec-count').textContent = STATE.videos.length;
  renderVideos();
  addAlert('success', '💾 Yozuv Saqlandi', `${name} (${size})`, 'Tizim');
  saveData();
}

function renderVideos() {
  const list = document.getElementById('videos-list');
  if (STATE.videos.length === 0) { list.innerHTML = '<div class="empty-state">Hali video yozuv yo\'q</div>'; return; }
  list.innerHTML = '';
  STATE.videos.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'video-item';
    const mins = Math.floor(v.duration/60), secs = v.duration%60;
    el.innerHTML = `
      <div class="video-thumb"><video src="${v.url}" preload="metadata" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video></div>
      <div class="video-info">
        <div class="video-name">${v.name}</div>
        <div class="video-meta">${v.date} · ${v.size} · ${pad(mins)}:${pad(secs)}</div>
      </div>
      <div class="video-actions">
        <button class="v-btn green" onclick="downloadVideo(${i})">⬇️</button>
        <button class="v-btn red" onclick="deleteVideo(${i})">🗑</button>
      </div>`;
    list.appendChild(el);
  });
}

function downloadVideo(i) {
  const v = STATE.videos[i];
  const a = document.createElement('a');
  a.href = v.url; a.download = v.name; a.click();
}

function deleteVideo(i) {
  URL.revokeObjectURL(STATE.videos[i].url);
  STATE.videos.splice(i, 1);
  renderVideos();
  saveData();
}

// ─── SNAPSHOT ────────────────────────────
function takeSnapshot() {
  if (!STATE.cameraActive) { addAlert('warning', 'Kamera yoq', 'Avval kamerani yoqing', 'Tizim'); return; }
  const video = document.getElementById('main-video');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const now = new Date();
  STATE.photos.unshift({ dataUrl, date: now.toLocaleString('uz'), time: now.toLocaleTimeString('uz') });
  renderPhotos();
  addAlert('success', '📸 Rasm Saqlandi', `${now.toLocaleString('uz')}`, 'Tizim');
  saveData();
}

function renderPhotos() {
  const grid = document.getElementById('photos-grid');
  if (STATE.photos.length === 0) { grid.innerHTML = '<div class="empty-state">Hali rasm yo\'q</div>'; return; }
  grid.innerHTML = '';
  STATE.photos.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'photo-item';
    el.innerHTML = `<img src="${p.dataUrl}" alt="Photo"/><div class="photo-time">${p.time}</div>`;
    el.onclick = () => openPhotoModal(i);
    grid.appendChild(el);
  });
}

function openPhotoModal(i) {
  STATE.currentPhotoIndex = i;
  document.getElementById('photo-preview-img').src = STATE.photos[i].dataUrl;
  document.getElementById('photo-modal').style.display = 'flex';
}

function closePhotoModal() {
  document.getElementById('photo-modal').style.display = 'none';
}

function downloadCurrentPhoto() {
  if (STATE.currentPhotoIndex === null) return;
  const p = STATE.photos[STATE.currentPhotoIndex];
  const a = document.createElement('a');
  a.href = p.dataUrl;
  a.download = `Rasm_${p.time.replace(/:/g,'-')}.jpg`;
  a.click();
}

// ─── ALERTS ──────────────────────────────
const ALERT_COOLDOWN = {};

function addAlert(type, title, desc, cam) {
  const key = type + title;
  const now = Date.now();
  if (ALERT_COOLDOWN[key] && now - ALERT_COOLDOWN[key] < 8000) return;
  ALERT_COOLDOWN[key] = now;

  // Check category settings
  const catMap = { critical: 'cat-critical', warning: 'cat-warning', info: 'cat-info', worker: 'cat-worker', success: 'cat-info' };
  if (!STATE.settings[catMap[type]]) return;
  if (STATE.settings['critical-only'] && type !== 'critical') return;

  const alert = { type, title, desc, cam, time: new Date().toLocaleTimeString('uz'), ts: now };
  STATE.alerts.unshift(alert);
  STATE.eventLog.unshift({ ...alert });

  // Cap alerts list
  if (STATE.alerts.length > 200) STATE.alerts.pop();

  STATE.stats.alerts++;
  if (type === 'critical' || type === 'warning') {
    STATE.stats.suspicious++;
    STATE.stats.weekCritical++;
  }
  STATE.stats.weekTotal++;

  updateAlertBell();
  renderAlerts();
  renderEventsFull();
  updateStatCards();

  // Live feed
  addLiveAlert(type, title, desc);

  // Danger overlay
  if (type === 'critical') {
    showDanger(title);
    if (STATE.settings.sound) playBeep(type);
    if (STATE.settings.vibrate && navigator.vibrate) navigator.vibrate([200,100,200]);
    if (STATE.settings.flash) flashScreen();
  } else if (type === 'warning') {
    if (STATE.settings.sound && !STATE.settings['critical-only']) playBeep('warning');
    if (STATE.settings.vibrate && navigator.vibrate) navigator.vibrate(100);
  }

  saveData();
}

function addLiveAlert(type, title, desc) {
  const container = document.getElementById('live-alerts');
  const el = document.createElement('div');
  el.className = `live-alert ${type === 'success' ? 'success' : type}`;
  el.innerHTML = `<span>${getIcon(type)}</span><span style="flex:1;">${title} — ${desc}</span><span class="live-alert-time">${new Date().toLocaleTimeString('uz')}</span>`;
  container.insertBefore(el, container.firstChild);
  while (container.children.length > 8) container.removeChild(container.lastChild);
}

function getIcon(type) {
  return { critical:'🔴', warning:'🟡', info:'🔵', worker:'👷', success:'✅' }[type] || '⚪';
}

function renderAlerts() {
  const list = document.getElementById('alerts-list');
  const filter = STATE.alertFilter;
  const filtered = STATE.alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'critical') return a.type === 'critical';
    if (filter === 'warning') return a.type === 'warning';
    if (filter === 'info') return a.type === 'info' || a.type === 'success';
    if (filter === 'worker') return a.type === 'worker';
    return true;
  });

  if (filtered.length === 0) { list.innerHTML = '<div class="empty-state">Bu kategoriyada signal yo\'q</div>'; return; }
  list.innerHTML = '';
  filtered.slice(0,50).forEach(a => {
    const el = document.createElement('div');
    el.className = `alert-item ${a.type === 'success' ? 'info' : a.type}`;
    el.innerHTML = `
      <div class="alert-item-header">
        <div class="alert-item-title">${getIcon(a.type)} ${a.title}</div>
        <div class="alert-item-time">${a.time}</div>
      </div>
      <div class="alert-item-desc">${a.desc}</div>
      <div class="alert-item-cam">📷 ${a.cam}</div>
      <span class="alert-cat-badge ${a.type}">${getCatLabel(a.type)}</span>`;
    list.appendChild(el);
  });

  // Update counts
  const critical = STATE.alerts.filter(a => a.type === 'critical').length;
  const warning = STATE.alerts.filter(a => a.type === 'warning').length;
  const info = STATE.alerts.filter(a => a.type === 'info' || a.type === 'success').length;
  document.getElementById('ac-critical').textContent = `🔴 ${critical} Kritik`;
  document.getElementById('ac-warning').textContent = `🟡 ${warning} Ogohlantirish`;
  document.getElementById('ac-info').textContent = `🔵 ${info} Ma'lumot`;
}

function getCatLabel(t) {
  return { critical:'🔴 Kritik', warning:'🟡 Ogohlantirish', info:'🔵 Ma\'lumot', worker:'👷 Ishchi', success:'✅ Muvaffaqiyat' }[t] || t;
}

function updateAlertBell() {
  const count = STATE.alerts.filter(a => a.type === 'critical' || a.type === 'warning').length;
  const bell = document.getElementById('bell-count');
  const dot = document.getElementById('ai-status-dot');
  if (count > 0) {
    bell.style.display = 'flex';
    bell.textContent = count > 99 ? '99+' : count;
    dot.className = 'status-dot alert';
  } else {
    bell.style.display = 'none';
    dot.className = STATE.cameraActive ? 'status-dot online' : 'status-dot';
  }
}

function clearAlerts() {
  STATE.alerts = [];
  renderAlerts();
  updateAlertBell();
  document.getElementById('live-alerts').innerHTML = '';
}

// ─── DANGER OVERLAY ──────────────────────
let dangerTimer = null;
function showDanger(text) {
  const ov = document.getElementById('danger-overlay');
  document.getElementById('danger-text').textContent = text;
  ov.style.display = 'flex';
  clearTimeout(dangerTimer);
  dangerTimer = setTimeout(() => { ov.style.display = 'none'; }, 4000);
}

function flashScreen() {
  document.body.style.background = '#ff3b5c';
  setTimeout(() => { document.body.style.background = ''; }, 150);
}

// ─── SOUND ───────────────────────────────
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
function playBeep(type) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = type === 'critical' ? 880 : 440;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
  } catch(e) {}
}

// ─── WORKERS ─────────────────────────────
function showAddWorker() { document.getElementById('add-worker-modal').style.display = 'flex'; }
function hideAddWorker() { document.getElementById('add-worker-modal').style.display = 'none'; }

function addWorker() {
  const name = document.getElementById('new-worker-name').value.trim();
  const role = document.getElementById('new-worker-role').value.trim();
  const shift = document.getElementById('new-worker-shift').value;
  const zone = document.getElementById('new-worker-zone').value;
  if (!name) { alert('Ism kiriting!'); return; }
  const worker = {
    id: Date.now(),
    name, role: role || 'Ishchi',
    shift, zone,
    status: 'out',
    checkIn: null,
    checkOut: null,
    lateCount: 0,
    idleTime: 0,
    efficiency: Math.floor(Math.random()*30)+70,
    alerts: 0,
    ppe: { helmet: false, vest: false },
    totalHours: 0
  };
  STATE.workers.push(worker);
  hideAddWorker();
  document.getElementById('new-worker-name').value = '';
  document.getElementById('new-worker-role').value = '';
  renderWorkers();
  renderEfficiency();
  renderProfiles();
  updateWorkerStats();
  saveData();
  addAlert('info', '👷 Yangi Ishchi', `${name} tizimga qo'shildi`, 'Tizim');
}

function deleteWorker(id) {
  STATE.workers = STATE.workers.filter(w => w.id !== id);
  renderWorkers();
  renderEfficiency();
  renderProfiles();
  updateWorkerStats();
  saveData();
}

function checkInWorker(id) {
  const w = STATE.workers.find(w => w.id === id);
  if (!w) return;
  const now = new Date();
  const nowStr = now.toLocaleTimeString('uz');
  const [startH, startM] = STATE.workStart.split(':').map(Number);
  const isLate = now.getHours() > startH || (now.getHours() === startH && now.getMinutes() > startM + 5);

  w.status = isLate ? 'late' : 'in';
  w.checkIn = nowStr;
  w.checkOut = null;
  STATE.stats.workersIn++;
  STATE.stats.weekTotal++;

  const logItem = { name: w.name, time: nowStr, type: isLate ? 'late' : 'in', icon: '👷' };
  document.getElementById('davomat-log').insertAdjacentHTML('afterbegin', renderDavomatItem(logItem));

  if (isLate && STATE.settings['late-alert']) {
    w.lateCount++;
    addAlert('worker', '⏰ Kechikish', `${w.name} ${STATE.workStart} dan keyin keldi`, w.zone);
  } else {
    addAlert('info', '✅ Kirish', `${w.name} ishga keldi`, w.zone);
  }
  renderWorkers();
  updateWorkerStats();
  saveData();
}

function checkOutWorker(id) {
  const w = STATE.workers.find(w => w.id === id);
  if (!w) return;
  const now = new Date().toLocaleTimeString('uz');
  w.status = 'out';
  w.checkOut = now;
  const logItem = { name: w.name, time: now, type: 'out', icon: '🚪' };
  document.getElementById('davomat-log').insertAdjacentHTML('afterbegin', renderDavomatItem(logItem));
  addAlert('info', '🚪 Chiqish', `${w.name} ishdan ketdi`, w.zone);
  renderWorkers();
  updateWorkerStats();
  saveData();
}

function renderDavomatItem(item) {
  return `<div class="davomat-item"><div class="dav-icon">${item.icon}</div><div class="dav-name">${item.name}</div><div class="dav-time">${item.time}</div><div class="dav-type ${item.type}">${item.type === 'in' ? 'Kirdi' : item.type === 'out' ? 'Chiqdi' : 'Kechikdi'}</div></div>`;
}

function renderWorkers() {
  const list = document.getElementById('workers-list');
  if (!list) return;
  if (STATE.workers.length === 0) { list.innerHTML = '<div class="empty-state">Hali ishchi qo\'shilmagan</div>'; return; }
  list.innerHTML = '';
  STATE.workers.forEach(w => {
    const el = document.createElement('div');
    el.className = 'worker-item';
    const statusDotClass = w.status === 'in' ? 'in' : w.status === 'late' ? 'late' : w.status === 'break' ? 'break' : '';
    const statusText = { in:'Ichkarida', out:"Tashqarida", late:'Kechikgan', break:'Dam olishda' }[w.status] || w.status;
    const checkinInfo = w.checkIn ? `${w.checkIn}` : '--:--';
    el.innerHTML = `
      <div class="worker-avatar">👷</div>
      <div class="worker-info">
        <div class="worker-name">${w.name}</div>
        <div class="worker-role">${w.role} · ${getShiftLabel(w.shift)}</div>
        <div class="worker-zone">📍 ${w.zone} Sexi · Kirish: ${checkinInfo}</div>
      </div>
      <div class="worker-status">
        <div class="w-status-dot ${statusDotClass}"></div>
        <div class="worker-time" style="color:${w.status==='late'?'#ffcc00':w.status==='in'?'#00ff88':'#7aadc4'}">${statusText}</div>
      </div>
      <div class="worker-actions">
        ${w.status !== 'in' && w.status !== 'late' ? `<button class="w-act-btn" onclick="checkInWorker(${w.id})">Kirdi</button>` : `<button class="w-act-btn" onclick="checkOutWorker(${w.id})">Chiqdi</button>`}
        <button class="w-act-btn del" onclick="deleteWorker(${w.id})">✕</button>
      </div>`;
    list.appendChild(el);
  });
}

function getShiftLabel(s) {
  return { '1':'1-smena', '2':'2-smena', 'night':'Tungi' }[s] || s;
}

function renderProfiles() {
  const list = document.getElementById('profil-list');
  if (!list) return;
  if (STATE.workers.length === 0) { list.innerHTML = '<div class="empty-state">Hali profil yo\'q</div>'; return; }
  list.innerHTML = '';
  STATE.workers.forEach(w => {
    const el = document.createElement('div');
    el.className = 'worker-item';
    el.innerHTML = `
      <div class="worker-avatar">👷</div>
      <div class="worker-info">
        <div class="worker-name">${w.name}</div>
        <div class="worker-role">${w.role} · ${w.zone}</div>
        <div class="worker-zone">Smena: ${getShiftLabel(w.shift)} · Kechikish: ${w.lateCount} marta · Samaradorlik: ${w.efficiency}%</div>
      </div>
      <div class="worker-actions">
        <button class="w-act-btn del" onclick="deleteWorker(${w.id})">✕</button>
      </div>`;
    list.appendChild(el);
  });
}

function updateWorkerStats() {
  const present = STATE.workers.filter(w => w.status === 'in' || w.status === 'late').length;
  const late = STATE.workers.filter(w => w.status === 'late').length;
  const onBreak = STATE.workers.filter(w => w.status === 'break').length;
  document.getElementById('w-present').textContent = present;
  document.getElementById('w-late').textContent = late;
  document.getElementById('w-break').textContent = onBreak;
  document.getElementById('w-total').textContent = STATE.workers.length;
  document.getElementById('stat-workers').textContent = present;
  document.getElementById('info-workers').textContent = STATE.workers.length;
  document.getElementById('report-workers-in').textContent = STATE.stats.workersIn;
}

// ─── PPE ─────────────────────────────────
function togglePPE(type) {
  STATE.ppe[type] = !STATE.ppe[type];
  const el = document.getElementById('ppe-' + type);
  if (el) el.className = `toggle-sw ${STATE.ppe[type] ? 'on' : ''}`;
  saveData();
}

function renderPPELog() {
  const list = document.getElementById('ppe-log');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">PPE buzilishi qayd etilmagan</div>';
}

// ─── EFFICIENCY ───────────────────────────
function renderEfficiency() {
  const list = document.getElementById('efficiency-list');
  if (!list) return;
  if (STATE.workers.length === 0) { list.innerHTML = '<div class="empty-state">Ishchi yo\'q</div>'; return; }
  const sorted = [...STATE.workers].sort((a,b) => b.efficiency - a.efficiency);
  list.innerHTML = '';
  sorted.forEach((w, i) => {
    const el = document.createElement('div');
    el.className = 'efficiency-item';
    el.innerHTML = `
      <div class="eff-rank ${i===0?'gold':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.'}</div>
      <div class="eff-name">${w.name}</div>
      <div class="eff-bar-mini-wrap"><div class="eff-bar-mini" style="width:${w.efficiency}%"></div></div>
      <div class="eff-pct-mini">${w.efficiency}%</div>`;
    list.appendChild(el);
  });

  const present = STATE.workers.filter(w=>w.status==='in'||w.status==='late').length;
  document.getElementById('eff-active').textContent = present;
  document.getElementById('eff-idle').textContent = 0;
  document.getElementById('eff-phone').textContent = 0;
  document.getElementById('eff-overtime').textContent = 0;
}

// ─── STATS ───────────────────────────────
function updateStatCards() {
  document.getElementById('report-people').textContent = STATE.stats.people;
  document.getElementById('report-alerts').textContent = STATE.stats.alerts;
  document.getElementById('report-suspicious').textContent = STATE.stats.suspicious;
  document.getElementById('report-safe').textContent = Math.floor(STATE.uptime / 60);
  document.getElementById('report-ppe').textContent = STATE.stats.ppeFail;
  document.getElementById('week-total').textContent = STATE.stats.weekTotal;
  document.getElementById('week-critical').textContent = STATE.stats.weekCritical;
  document.getElementById('week-workers').textContent = STATE.workers.length;
  document.getElementById('week-trend').textContent = '+12%';
  updateWorkerStatList();
}

function renderStats() {
  updateStatCards();
  updateObjectReport();
  updateWorkerStatList();
}

function updateWorkerStatList() {
  const list = document.getElementById('worker-stat-list');
  if (!list) return;
  if (STATE.workers.length === 0) { list.innerHTML = '<div class="empty-state">Ishchi yo\'q</div>'; return; }
  list.innerHTML = '';
  STATE.workers.forEach(w => {
    const el = document.createElement('div');
    el.className = 'worker-stat-item';
    el.innerHTML = `<div class="wsi-name">${w.name}<br><small style="color:#7aadc4;">${w.role}</small></div><div class="wsi-hours">⏰ ${w.totalHours}s</div><div class="wsi-alerts">🚨 ${w.alerts}</div>`;
    list.appendChild(el);
  });
}

function updateObjectReport() {
  const list = document.getElementById('objects-report');
  if (!list) return;
  const entries = Object.entries(STATE.objectCounts);
  if (entries.length === 0) { list.innerHTML = '<div class="empty-state">Hali ob\'ekt aniqlanmagan</div>'; return; }
  const max = Math.max(...entries.map(([,v])=>v));
  list.innerHTML = '';
  entries.sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
    const el = document.createElement('div');
    el.className = 'obj-item';
    el.innerHTML = `<span style="min-width:80px;font-size:11px;">${k}</span><div class="obj-bar-wrap"><div class="obj-bar" style="width:${Math.round(v/max*100)}%"></div></div><div class="obj-count">${v}</div>`;
    list.appendChild(el);
  });
}

function renderEventsFull() {
  const list = document.getElementById('events-full-list');
  if (!list) return;
  if (STATE.eventLog.length === 0) { list.innerHTML = '<div class="empty-state">Hali hodisa yo\'q</div>'; return; }
  list.innerHTML = '';
  STATE.eventLog.slice(0,50).forEach(e => {
    const el = document.createElement('div');
    el.className = 'event-item';
    el.innerHTML = `<div class="event-icon">${getIcon(e.type)}</div><div class="event-text"><strong>${e.title}</strong><br>${e.desc}</div><div class="event-time">${e.time}</div>`;
    list.appendChild(el);
  });
}

// ─── CHARTS ──────────────────────────────
let todayChart = null, weekChart = null, hourlyChart = null;

function initCharts() {
  drawBarChart('today-chart', STATE.hourlyData.slice(0,24), Array.from({length:24},(_,i)=>i+':00'));
  drawBarChart('week-chart', STATE.weekData, ['Du','Se','Ch','Pa','Ju','Sh','Ya']);
  drawBarChart('hourly-chart', STATE.hourlyData.slice(0,24), Array.from({length:24},(_,i)=>i+''));
}

function updateCharts() {
  drawBarChart('today-chart', STATE.hourlyData, Array.from({length:24},(_,i)=>i+':00'));
  drawBarChart('hourly-chart', STATE.hourlyData, Array.from({length:24},(_,i)=>i+''));
}

function drawBarChart(id, data, labels) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.clientWidth - 20;
  const H = canvas.height;
  canvas.width = W;
  ctx.clearRect(0,0,W,H);
  const max = Math.max(...data, 1);
  const bw = W / data.length;
  data.forEach((v, i) => {
    const bh = Math.max(2, (v/max) * (H - 20));
    const x = i * bw + 1;
    const y = H - bh - 15;
    const grad = ctx.createLinearGradient(0, y, 0, H-15);
    grad.addColorStop(0, '#00ff88');
    grad.addColorStop(1, '#00ccff');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, bw - 2, bh);
    if (bw > 18 && i % Math.ceil(data.length/12) === 0) {
      ctx.fillStyle = '#7aadc4';
      ctx.font = '8px monospace';
      ctx.fillText(labels[i] || '', x, H - 2);
    }
  });
}

// ─── IP CAMERAS ──────────────────────────
function showAddCamera() { document.getElementById('add-cam-modal').style.display = 'flex'; }
function hideAddCamera() { document.getElementById('add-cam-modal').style.display = 'none'; }

function addIPCamera() {
  const name = document.getElementById('new-cam-name').value.trim();
  const ip = document.getElementById('new-cam-ip').value.trim();
  const port = document.getElementById('new-cam-port').value;
  const user = document.getElementById('new-cam-user').value;
  const pass = document.getElementById('new-cam-pass').value;
  if (!name || !ip) { alert('Nom va IP manzil kiriting!'); return; }
  const cam = { id: Date.now(), name, ip, port, user, pass, status: 'connecting' };
  STATE.ipCameras.push(cam);
  hideAddCamera();
  ['new-cam-name','new-cam-ip','new-cam-pass'].forEach(id => document.getElementById(id).value = '');
  renderIPCameras();
  saveData();
  addAlert('info', '📡 Kamera Qo\'shildi', `${name} (${ip}:${port}) ulanmoqda...`, name);
  setTimeout(() => {
    cam.status = Math.random() > 0.3 ? 'error' : 'online';
    renderIPCameras();
  }, 3000);
}

function renderIPCameras() {
  const list = document.getElementById('hik-list');
  if (!list) return;
  document.getElementById('hik-count').textContent = `${STATE.ipCameras.length}/50`;
  if (STATE.ipCameras.length === 0) { list.innerHTML = '<div class="empty-state">IP kamera yo\'q</div>'; return; }
  list.innerHTML = '';
  STATE.ipCameras.forEach(c => {
    const el = document.createElement('div');
    el.className = 'hik-item';
    const statusColor = c.status === 'online' ? 'on' : c.status === 'error' ? 'err' : '';
    el.innerHTML = `<div class="hik-dot ${statusColor}"></div><div class="hik-info"><div class="hik-name">${c.name}</div><div class="hik-addr">${c.ip}:${c.port}</div></div><div style="font-size:10px;color:${c.status==='online'?'#00ff88':c.status==='error'?'#ff3b5c':'#7aadc4'}">${c.status==='online'?'Online':c.status==='error'?'Xato':'Ulanmoqda'}</div><div class="hik-del" onclick="deleteIPCam(${c.id})">✕</div>`;
    list.appendChild(el);
  });
  document.getElementById('info-cams').textContent = STATE.ipCameras.length + (STATE.cameraActive ? 1 : 0);
}

function deleteIPCam(id) {
  STATE.ipCameras = STATE.ipCameras.filter(c => c.id !== id);
  renderIPCameras();
  saveData();
}

// ─── SETTINGS ────────────────────────────
function toggleSetting(key) {
  STATE.settings[key] = !STATE.settings[key];
  const el = document.getElementById('sw-' + key);
  if (el) el.className = `toggle-sw ${STATE.settings[key] ? 'on' : ''}`;
  saveData();
}

function updateSensitivity(val) {
  STATE.sensitivity = parseInt(val);
  document.getElementById('sensitivity-val').textContent = val + ' / 10';
  saveData();
}

function checkWorkTime() {
  if (!STATE.settings['auto-attend']) return;
}

// ─── GRID VIEW ───────────────────────────
function setGrid(n) {
  document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const grid = document.getElementById('cam-grid');
  grid.className = 'cam-grid' + (n > 1 ? ' grid-2' : '');
}

// ─── DEMO MODE ───────────────────────────
const DEMO_ALERTS = [
  ['info', '✅ Kirish', 'Hodisa qayd etildi', 'A Sexi'],
  ['warning', '👷 PPE Yetishmaydi', 'Helmet kiyilmagan', 'B Sexi'],
  ['critical', '🚧 Zona Buzildi', 'Taqiqlangan hududga kirish', 'C Sexi'],
  ['warning', '⏰ Kechikish', 'Ishchi 15 daqiqa kechikdi', 'A Sexi'],
  ['info', '📊 Hisobot', '5 ta odam kuzatildi', 'Kamera'],
  ['worker', '📱 Telefon', 'Ish vaqtida telefon ishlatildi', 'B Sexi'],
  ['critical', '🚨 Yiqilish', 'Ishchi yiqildi - tezkor yordam!', 'A Sexi'],
  ['warning', '👥 Olomon', '6 ta odam bir joyda', 'Kamera'],
];

let demoIdx = 0;
function startDemoMode() {
  setTimeout(runDemo, 5000);
}

function runDemo() {
  if (STATE.cameraActive) { setTimeout(runDemo, 15000); return; }
  const [type, title, desc, cam] = DEMO_ALERTS[demoIdx % DEMO_ALERTS.length];
  addAlert(type, title, desc, cam);
  demoIdx++;
  STATE.stats.people = Math.floor(Math.random()*8)+1;
  document.getElementById('stat-people').textContent = STATE.stats.people;
  const hour = new Date().getHours();
  STATE.hourlyData[hour] = STATE.stats.people;
  updateCharts();
  updateStatCards();
  setTimeout(runDemo, 10000 + Math.random()*15000);
}

// ─── DATA PERSISTENCE ────────────────────
function saveData() {
  try {
    localStorage.setItem('xk_workers', JSON.stringify(STATE.workers));
    localStorage.setItem('xk_zones', JSON.stringify(STATE.zones));
    localStorage.setItem('xk_settings', JSON.stringify(STATE.settings));
    localStorage.setItem('xk_ip_cams', JSON.stringify(STATE.ipCameras));
    localStorage.setItem('xk_stats', JSON.stringify(STATE.stats));
    localStorage.setItem('xk_ppe', JSON.stringify(STATE.ppe));
    localStorage.setItem('xk_hourly', JSON.stringify(STATE.hourlyData));
    // Photos saved separately (base64)
    try {
      localStorage.setItem('xk_photos', JSON.stringify(STATE.photos.slice(0,20)));
    } catch(e) {}
  } catch(e) {}
}

function loadData() {
  try {
    const w = localStorage.getItem('xk_workers'); if (w) STATE.workers = JSON.parse(w);
    const z = localStorage.getItem('xk_zones'); if (z) STATE.zones = JSON.parse(z);
    const s = localStorage.getItem('xk_settings'); if (s) Object.assign(STATE.settings, JSON.parse(s));
    const c = localStorage.getItem('xk_ip_cams'); if (c) STATE.ipCameras = JSON.parse(c);
    const st = localStorage.getItem('xk_stats'); if (st) Object.assign(STATE.stats, JSON.parse(st));
    const p = localStorage.getItem('xk_ppe'); if (p) Object.assign(STATE.ppe, JSON.parse(p));
    const h = localStorage.getItem('xk_hourly'); if (h) STATE.hourlyData = JSON.parse(h);
    const ph = localStorage.getItem('xk_photos'); if (ph) STATE.photos = JSON.parse(ph);
    applySettings();
    renderZones();
  } catch(e) {}
}

function applySettings() {
  Object.keys(STATE.settings).forEach(k => {
    const el = document.getElementById('sw-' + k);
    if (el) el.className = `toggle-sw ${STATE.settings[k] ? 'on' : ''}`;
  });
  Object.keys(STATE.ppe).forEach(k => {
    const el = document.getElementById('ppe-' + k);
    if (el) el.className = `toggle-sw ${STATE.ppe[k] ? 'on' : ''}`;
  });
}

function clearAllData() {
  if (!confirm('Haqiqatan ham barcha ma\'lumotlarni o\'chirmoqchimisiz?')) return;
  localStorage.clear();
  STATE.workers = [];
  STATE.alerts = [];
  STATE.photos = [];
  STATE.videos = [];
  STATE.ipCameras = [];
  STATE.zones = [];
  STATE.stats = { people:0, alerts:0, suspicious:0, safe:0, workersIn:0, ppeFail:0, weekTotal:0, weekCritical:0 };
  STATE.hourlyData = new Array(24).fill(0);
  STATE.weekData = new Array(7).fill(0);
  renderWorkers();
  renderAlerts();
  renderVideos();
  renderPhotos();
  renderIPCameras();
  renderZones();
  updateStatCards();
  addAlert('info', '🗑 Tozalandi', 'Barcha ma\'lumotlar o\'chirildi', 'Tizim');
}

// ─── IDLE DETECTION ──────────────────────
const IDLE_POSITIONS = {};
const IDLE_THRESHOLD = 300; // 5 daqiqa (soniyada)

function checkIdleWorkers(predictions) {
  if (!STATE.settings.idle) return;
  predictions.forEach((pred, i) => {
    if (pred.class !== 'person') return;
    const cx = Math.round(pred.bbox[0] / 20) * 20;
    const cy = Math.round(pred.bbox[1] / 20) * 20;
    const key = `person_${i}`;
    const now = Date.now() / 1000;
    if (!IDLE_POSITIONS[key]) {
      IDLE_POSITIONS[key] = { cx, cy, since: now };
    } else if (Math.abs(IDLE_POSITIONS[key].cx - cx) < 30 && Math.abs(IDLE_POSITIONS[key].cy - cy) < 30) {
      const idleSec = now - IDLE_POSITIONS[key].since;
      if (idleSec > IDLE_THRESHOLD) {
        addAlert('warning', '😴 Bo\'sh Turish', `${Math.floor(idleSec/60)} daqiqadan beri harakatsiz`, 'Kamera');
        IDLE_POSITIONS[key].since = now; // reset
        STATE.stats.ppeFail++;
        document.getElementById('eff-idle').textContent =
          parseInt(document.getElementById('eff-idle').textContent || '0') + 1;
      }
    } else {
      IDLE_POSITIONS[key] = { cx, cy, since: now };
    }
  });
}

// ─── FALL DETECTION ──────────────────────
function checkFallDetection(predictions) {
  if (!STATE.settings.fall) return;
  predictions.forEach(pred => {
    if (pred.class !== 'person') return;
    const [x, y, w, h] = pred.bbox;
    const ratio = w / h;
    // Yiqilgan odam: kenglik balandlikdan katta
    if (ratio > 1.8 && pred.score > 0.6) {
      addAlert('critical', '🚨 Yiqilish Aniqlandi!', 'Ishchi yiqilgan bo\'lishi mumkin — zudlik bilan tekshiring!', 'Kamera');
    }
  });
}

// ─── ABANDON DETECTION ───────────────────
const ABANDON_TRACKER = {};
function checkAbandonedObjects(predictions) {
  if (!STATE.settings.abandon) return;
  const nonPersons = predictions.filter(p => p.class !== 'person' && ['backpack','suitcase','handbag','umbrella'].includes(p.class));
  nonPersons.forEach(obj => {
    const key = obj.class + '_' + Math.round(obj.bbox[0]/50);
    const now = Date.now() / 1000;
    if (!ABANDON_TRACKER[key]) {
      ABANDON_TRACKER[key] = now;
    } else if (now - ABANDON_TRACKER[key] > 120) { // 2 daqiqa
      addAlert('warning', '🎒 Tashlab Ketilgan Narsa', `"${obj.class}" 2+ daqiqadan beri bir joyda turibdi`, 'Kamera');
      delete ABANDON_TRACKER[key];
    }
  });
}

// ─── COVER DETECTION (Kamerani yopish) ───
let coverFrameCount = 0;
function checkCameraBlocked(imageData) {
  if (!STATE.settings.cover) return;
  const data = imageData.data;
  let darkPixels = 0;
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
    if (brightness < 30) darkPixels++;
  }
  const ratio = darkPixels / (data.length / 16);
  if (ratio > 0.85) {
    coverFrameCount++;
    if (coverFrameCount > 10) {
      addAlert('critical', '🖐 Kamera Bloklandi!', 'Kamera ko\'rinishi to\'sib qo\'yilgan', 'Kamera');
      coverFrameCount = 0;
    }
  } else {
    coverFrameCount = 0;
  }
}

// ─── NIGHT MODE ──────────────────────────
function applyNightMode(ctx, canvas) {
  if (!STATE.settings.night) return;
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      data[i]   = Math.min(255, avg * 1.5);
      data[i+1] = Math.min(255, avg * 1.5);
      data[i+2] = Math.min(255, avg * 1.5);
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

// ─── CROWD DIRECTION ANALYSIS ─────────────
const PREV_POSITIONS = {};
function analyzeMovementDirection(predictions) {
  predictions.forEach((pred, i) => {
    if (pred.class !== 'person') return;
    const cx = pred.bbox[0] + pred.bbox[2] / 2;
    const cy = pred.bbox[1] + pred.bbox[3] / 2;
    const key = `dir_${i}`;
    if (PREV_POSITIONS[key]) {
      const dx = cx - PREV_POSITIONS[key].cx;
      const dy = cy - PREV_POSITIONS[key].cy;
      const speed = Math.sqrt(dx*dx + dy*dy);
      if (speed > 40 && STATE.settings.suspicious) {
        addAlert('warning', '🏃 Tez Harakat', 'Shubhali tez harakat aniqlandi', 'Kamera');
      }
    }
    PREV_POSITIONS[key] = { cx, cy };
  });
}

// ─── HEATMAP OVERLAY ─────────────────────
const HEATMAP_DATA = {};
function updateHeatmap(predictions, canvasW, canvasH) {
  predictions.forEach(pred => {
    if (pred.class !== 'person') return;
    const cx = Math.round((pred.bbox[0] + pred.bbox[2]/2) / canvasW * 20);
    const cy = Math.round((pred.bbox[1] + pred.bbox[3]/2) / canvasH * 10);
    const key = `${cx}_${cy}`;
    HEATMAP_DATA[key] = (HEATMAP_DATA[key] || 0) + 1;
  });
}

function drawHeatmap(ctx, canvasW, canvasH) {
  const maxVal = Math.max(...Object.values(HEATMAP_DATA), 1);
  Object.entries(HEATMAP_DATA).forEach(([key, val]) => {
    const [cx, cy] = key.split('_').map(Number);
    const x = cx / 20 * canvasW;
    const y = cy / 10 * canvasH;
    const alpha = (val / maxVal) * 0.4;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 30);
    grad.addColorStop(0, `rgba(255,59,92,${alpha})`);
    grad.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x-30, y-30, 60, 60);
  });
}

// ─── WORKER BREAK MONITORING ─────────────
const BREAK_TIMERS = {};
function startBreak(workerId) {
  const w = STATE.workers.find(x => x.id === workerId);
  if (!w) return;
  w.status = 'break';
  BREAK_TIMERS[workerId] = { start: Date.now(), warned: false };
  addAlert('info', '☕ Dam Olish', `${w.name} dam olishga ketdi`, w.zone);
  renderWorkers();
  updateWorkerStats();

  // Monitoring timer
  const interval = setInterval(() => {
    const timer = BREAK_TIMERS[workerId];
    if (!timer) { clearInterval(interval); return; }
    const mins = (Date.now() - timer.start) / 60000;
    const maxMins = parseInt(document.getElementById('lunch-min')?.value || 30);
    if (mins > maxMins && !timer.warned) {
      timer.warned = true;
      addAlert('warning', '⏰ Tushlik Uzun', `${w.name} — ${Math.round(mins)} daqiqa (${maxMins} daqiqa belgilangan)`, w.zone);
    }
  }, 30000);
}

function endBreak(workerId) {
  const w = STATE.workers.find(x => x.id === workerId);
  if (!w) return;
  w.status = 'in';
  delete BREAK_TIMERS[workerId];
  addAlert('info', '✅ Dam Olish Tugadi', `${w.name} ishga qaytdi`, w.zone);
  renderWorkers();
  updateWorkerStats();
}

// ─── WEEKLY DATA UPDATE ───────────────────
function updateWeeklyData() {
  const day = new Date().getDay();
  const idx = day === 0 ? 6 : day - 1;
  STATE.weekData[idx] = Math.max(STATE.weekData[idx], STATE.stats.people);
  drawBarChart('week-chart', STATE.weekData, ['Du','Se','Ch','Pa','Ju','Sh','Ya']);
}
setInterval(updateWeeklyData, 60000);

// ─── EXPORT FUNCTIONS ────────────────────
function exportAttendanceCSV() {
  const rows = [['Ism', 'Lavozim', 'Zona', 'Smena', 'Holat', 'Kirish', 'Chiqish', 'Kechikish']];
  STATE.workers.forEach(w => {
    rows.push([w.name, w.role, w.zone, getShiftLabel(w.shift), w.status, w.checkIn || '--', w.checkOut || '--', w.lateCount]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  downloadText(csv, 'davomat_' + new Date().toLocaleDateString('uz') + '.csv', 'text/csv');
  addAlert('success', '📊 Eksport', 'Davomat CSV sifatida yuklandi', 'Tizim');
}

function exportAlertsCSV() {
  const rows = [['Tur', 'Sarlavha', 'Tavsif', 'Kamera', 'Vaqt']];
  STATE.alerts.forEach(a => {
    rows.push([a.type, a.title, a.desc, a.cam, a.time]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  downloadText(csv, 'signallar_' + new Date().toLocaleDateString('uz') + '.csv', 'text/csv');
  addAlert('success', '📊 Eksport', 'Signallar CSV sifatida yuklandi', 'Tizim');
}

function downloadText(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── KEYBOARD SHORTCUTS ──────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  switch(e.key.toLowerCase()) {
    case 's': takeSnapshot(); break;
    case 'r': toggleRecord(); break;
    case 'f': toggleFullscreen(); break;
    case 'c': startPhoneCamera(); break;
    case '1': showTab('live'); break;
    case '2': showTab('workers'); break;
    case '3': showTab('cameras'); break;
    case '4': showTab('alerts'); break;
    case '5': showTab('records'); break;
    case '6': showTab('stats'); break;
  }
});

// ─── SWIPE NAVIGATION ────────────────────
let touchStartX = 0;
const TABS_ORDER = ['live','workers','cameras','alerts','records','stats','settings'];

document.getElementById('app')?.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

document.getElementById('app')?.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 60) return;
  const cur = TABS_ORDER.indexOf(STATE.currentTab);
  if (dx < 0 && cur < TABS_ORDER.length - 1) showTab(TABS_ORDER[cur + 1]);
  if (dx > 0 && cur > 0) showTab(TABS_ORDER[cur - 1]);
}, { passive: true });

// ─── REAL-TIME AI ENHANCED ────────────────
// Override runDetection to include all checks
const _origRunDetection = runDetection;
async function runDetection() {
  if (!STATE.aiRunning || !STATE.cameraActive) return;
  const video = document.getElementById('main-video');
  const canvas = document.getElementById('main-canvas');
  if (!video.videoWidth) { STATE.animFrame = requestAnimationFrame(runDetection); return; }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = performance.now();
  STATE.fps = Math.round(1000 / Math.max(1, now - STATE.lastFrameTime));
  STATE.lastFrameTime = now;
  document.getElementById('fps-badge').textContent = STATE.fps + ' FPS';
  document.getElementById('info-fps').textContent = STATE.fps + ' FPS';

  let predictions = [];
  let faces = [];
  try {
    if (STATE.cocoModel) predictions = await STATE.cocoModel.detect(video);
    if (STATE.faceModel) faces = await STATE.faceModel.estimateFaces(video, false);
  } catch(e) {}

  // Night mode pre-processing
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  applyNightMode(ctx, canvas);

  // Camera block check
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    checkCameraBlocked(imgData);
  } catch(e) {}

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let peopleCount = 0;
  const objCounts = {};

  predictions.forEach(pred => {
    if (pred.score * 10 < STATE.sensitivity) return;
    const [x, y, w, h] = pred.bbox;
    const conf = Math.round(pred.score * 100);
    objCounts[pred.class] = (objCounts[pred.class] || 0) + 1;

    let color = '#00ccff';
    let label = pred.class + ' ' + conf + '%';

    if (pred.class === 'person') {
      peopleCount++;
      color = '#00ff88';
      label = '👤 Odam ' + conf + '%';
      checkZoneViolation(x + w/2, y + h/2, canvas.width, canvas.height);
    } else if (['knife','scissors','gun'].includes(pred.class)) {
      color = '#ff3b5c';
      label = '⚠️ ' + pred.class + ' ' + conf + '%';
      addAlert('critical', '🔪 Xavfli Ob\'ekt!', `"${pred.class}" aniqlandi`, 'Kamera');
    } else if (['cell phone'].includes(pred.class) && STATE.settings['phone-use']) {
      color = '#ffcc00';
      label = '📱 Telefon';
      addAlert('worker', '📱 Telefon Ishlatildi', 'Ish vaqtida telefon ko\'rindi', 'Kamera');
    } else if (['backpack','suitcase','handbag'].includes(pred.class)) {
      color = '#ff9500';
    }

    // Draw box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    // Draw label background
    ctx.font = '11px monospace';
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(x, y - 18, tw, 18);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, y - 4);

    // Corner decorations
    drawCorners(ctx, x, y, w, h, color);
  });

  // Draw faces
  faces.forEach(face => {
    const [fx, fy] = face.topLeft;
    const [fx2, fy2] = face.bottomRight;
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(fx, fy, fx2-fx, fy2-fy);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff950099';
    ctx.fillRect(fx, fy - 16, 60, 16);
    ctx.fillStyle = '#000';
    ctx.font = '10px monospace';
    ctx.fillText('😀 Yuz', fx + 3, fy - 3);
  });

  // Draw zones overlay
  drawZonesOnCanvas(ctx, canvas.width, canvas.height);

  // Heatmap
  updateHeatmap(predictions, canvas.width, canvas.height);
  if (STATE.stats.people > 3) drawHeatmap(ctx, canvas.width, canvas.height);

  // Advanced checks
  checkIdleWorkers(predictions);
  checkFallDetection(predictions);
  checkAbandonedObjects(predictions);
  analyzeMovementDirection(predictions);

  // Crowd
  if (peopleCount >= 5 && STATE.settings.crowd) {
    addAlert('warning', '👥 Olomon', `${peopleCount} ta odam to'plandi`, 'Kamera');
  }

  // Face cover check
  if (faces.length > 0) {
    const [fx, fy] = faces[0].topLeft;
    const [fx2, fy2] = faces[0].bottomRight;
    const faceArea = (fx2-fx) * (fy2-fy);
    if (faceArea / (canvas.width * canvas.height) > 0.4 && STATE.settings.cover) {
      addAlert('critical', '🖐 Kamera Yopilmoqda!', 'Kameraga qo\'l yaqinlashdi', 'Kamera');
    }
  }

  STATE.objectCounts = objCounts;
  STATE.stats.people = Math.max(STATE.stats.people, peopleCount);

  document.getElementById('stat-people').textContent = peopleCount;
  document.getElementById('stat-objects').textContent = Object.keys(objCounts).length;
  document.getElementById('stat-alerts').textContent = STATE.stats.alerts;

  const hour = new Date().getHours();
  STATE.hourlyData[hour] = Math.max(STATE.hourlyData[hour], peopleCount);
  updateCharts();
  updateObjectReport();

  STATE.animFrame = requestAnimationFrame(runDetection);
}

function drawCorners(ctx, x, y, w, h, color) {
  const len = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  // Top-left
  ctx.beginPath(); ctx.moveTo(x, y+len); ctx.lineTo(x, y); ctx.lineTo(x+len, y); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(x+w-len, y); ctx.lineTo(x+w, y); ctx.lineTo(x+w, y+len); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(x, y+h-len); ctx.lineTo(x, y+h); ctx.lineTo(x+len, y+h); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(x+w-len, y+h); ctx.lineTo(x+w, y+h); ctx.lineTo(x+w, y+h-len); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawZonesOnCanvas(ctx, W, H) {
  STATE.zones.forEach(zone => {
    if (!zone.points || zone.points.length < 3) return;
    ctx.beginPath();
    zone.points.forEach((p, i) => {
      const px = p.x * W, py = p.y * H;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.fillStyle = zone.color + '22';
    ctx.fill();
    ctx.setLineDash([]);
    // Zone label
    const cx = zone.points.reduce((s,p)=>s+p.x,0)/zone.points.length * W;
    const cy = zone.points.reduce((s,p)=>s+p.y,0)/zone.points.length * H;
    ctx.fillStyle = zone.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('⛔ ' + zone.name, cx - 20, cy);
  });
}

// ─── PPE VIOLATION LOG ───────────────────
function logPPEViolation(workerName, missing) {
  STATE.stats.ppeFail++;
  document.getElementById('ppe-fail').textContent = STATE.stats.ppeFail;
  document.getElementById('report-ppe').textContent = STATE.stats.ppeFail;
  const list = document.getElementById('ppe-log');
  if (!list) return;
  if (list.querySelector('.empty-state')) list.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'ppe-log-item';
  el.innerHTML = `<span>⛑️</span><span style="flex:1;">${workerName || 'Noma\'lum'} — ${missing} yetishmaydi</span><span style="font-family:monospace;font-size:9px;color:#7aadc4;">${new Date().toLocaleTimeString('uz')}</span>`;
  list.insertBefore(el, list.firstChild);
  addAlert('warning', '🦺 PPE Buzilish', `${missing} kiyilmagan`, 'Kamera');
  document.getElementById('ppe-warn').textContent =
    parseInt(document.getElementById('ppe-warn').textContent||0) + 1;
}

// ─── PERIODIC TASKS ──────────────────────
setInterval(() => {
  // Update efficiency stats periodically
  const active = STATE.workers.filter(w => w.status === 'in' || w.status === 'late').length;
  const total = STATE.workers.length;
  const eff = total > 0 ? Math.round((active / total) * 100) : 0;
  const effEl = document.getElementById('overall-eff');
  const effPctEl = document.getElementById('overall-eff-pct');
  if (effEl) effEl.style.width = eff + '%';
  if (effPctEl) effPctEl.textContent = eff + '%';
  updateWorkerStats();
  renderEfficiency();
}, 30000);

// Redraw charts every 5 min
setInterval(() => {
  updateCharts();
  saveData();
}, 300000);

// ─── WORK TIME CHECK ─────────────────────
function checkWorkTime() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const [sh, sm] = (STATE.workStart || '08:00').split(':').map(Number);
  const [eh, em] = (STATE.workEnd || '17:00').split(':').map(Number);
  // Ish boshlanish ogohlantirishidan 5 daqiqa oldin
  if (h === sh && m === sm - 5) {
    addAlert('info', '⏰ Ish Boshlanmoqda', `${STATE.workStart} da ish boshlanadi`, 'Tizim');
  }
  // Ish tugash ogohlantirishidan 10 daqiqa oldin
  if (h === eh && m === em - 10) {
    addAlert('info', '🏁 Ish Tugaydi', `${STATE.workEnd} da ish tugaydi`, 'Tizim');
  }
}

function clearDavomat() {
  document.getElementById('davomat-log').innerHTML = '';
  addAlert('info', '🗑 Davomat Tozalandi', 'Bugungi davomat logi o\'chirildi', 'Tizim');
}

// ─── SETTINGS CHANGE HANDLERS ────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('work-start')?.addEventListener('change', e => {
    STATE.workStart = e.target.value; saveData();
  });
  document.getElementById('work-end')?.addEventListener('change', e => {
    STATE.workEnd = e.target.value; saveData();
  });
  document.getElementById('lunch-min')?.addEventListener('change', e => {
    STATE.lunchMin = parseInt(e.target.value); saveData();
  });
});
// ─── END OF FILE ──────────────────────────

