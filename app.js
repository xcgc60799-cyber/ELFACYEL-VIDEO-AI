// State Management
const state = {
  projects: JSON.parse(localStorage.getItem('elfacyel_projects')) || [],
  activeProjectId: null,
  character: JSON.parse(localStorage.getItem('elfacyel_char')) || null,
  scenes: [], // { title, duration, imgElement }
  audioCtx: null,
  analyser: null,
  dataArray: null,
  isPlaying: false,
  animationId: null
};

// Navigation
function switchTab(targetId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-target="${targetId}"]`).classList.add('active');
  document.getElementById(targetId).classList.add('active');
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.target));
});

// Update Dashboard Stats
function updateUI() {
  document.getElementById('statProjects').textContent = state.projects.length;
  document.getElementById('statChar').textContent = state.character ? state.character.name : 'Non défini';
  document.getElementById('statScenes').textContent = state.scenes.length;

  const activeProj = state.projects.find(p => p.id === state.activeProjectId);
  document.getElementById('projectStatus').textContent = activeProj
    ? `Projet actif : ${activeProj.name} (${activeProj.ratio})`
    : 'Projet actif : Aucun';

  renderProjects();
  renderCharacter();
}

// 1. Project Manager
document.getElementById('createProjectBtn').addEventListener('click', () => {
  const name = document.getElementById('projectNameInput').value.trim();
  const ratio = document.getElementById('projectRatio').value;
  if (!name) return alert('Veuillez entrer un titre de projet.');

  const newProj = { id: Date.now(), name, ratio, date: new Date().toLocaleDateString('fr-FR') };
  state.projects.push(newProj);
  state.activeProjectId = newProj.id;
  localStorage.setItem('elfacyel_projects', JSON.stringify(state.projects));
  document.getElementById('projectNameInput').value = '';
  adjustCanvasRatio(ratio);
  updateUI();
});

function renderProjects() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';
  state.projects.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${p.name}</strong> — [${p.ratio}] <small>(${p.date})</small></span>
      <button class="btn-secondary" onclick="selectProject(${p.id})">Ouvrir</button>
    `;
    list.appendChild(li);
  });
}

window.selectProject = (id) => {
  state.activeProjectId = id;
  const proj = state.projects.find(p => p.id === id);
  if (proj) adjustCanvasRatio(proj.ratio);
  updateUI();
};

function adjustCanvasRatio(ratio) {
  const canvas = document.getElementById('studioCanvas');
  if (ratio === '9:16') { canvas.width = 360; canvas.height = 640; }
  else if (ratio === '1:1') { canvas.width = 500; canvas.height = 500; }
  else { canvas.width = 640; canvas.height = 360; }
}

// 2. Character Lock
document.getElementById('saveCharBtn').addEventListener('click', () => {
  const name = document.getElementById('charName').value.trim();
  const prompt = document.getElementById('charPrompt').value.trim();
  const fileInput = document.getElementById('charRefImage');

  if (!name) return alert('Nom de personnage requis.');

  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      state.character = { name, prompt, image: e.target.result };
      localStorage.setItem('elfacyel_char', JSON.stringify(state.character));
      updateUI();
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    state.character = { name, prompt, image: state.character?.image || null };
    localStorage.setItem('elfacyel_char', JSON.stringify(state.character));
    updateUI();
  }
});

function renderCharacter() {
  const box = document.getElementById('charPreview');
  if (!state.character) return;
  box.innerHTML = `
    <div class="card">
      <strong>🔒 ${state.character.name}</strong>
      <p style="margin:8px 0; color:#ccc;">${state.character.prompt}</p>
      ${state.character.image ? `<img src="${state.character.image}" style="max-height:140px; border-radius:8px;" />` : ''}
    </div>
  `;
}

// 3. Scene Director
document.getElementById('addSceneBtn').addEventListener('click', () => {
  const title = document.getElementById('sceneTitle').value.trim() || `Scène ${state.scenes.length + 1}`;
  const duration = parseInt(document.getElementById('sceneDuration').value) || 4;
  const file = document.getElementById('sceneImageInput').files[0];

  if (!file) return alert('Veuillez sélectionner une image pour cette scène.');

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      state.scenes.push({ title, duration, img, src: e.target.result });
      renderScenes();
      updateUI();
    };
  };
  reader.readAsDataURL(file);
});

function renderScenes() {
  const container = document.getElementById('scenesContainer');
  container.innerHTML = '';
  state.scenes.forEach((s, idx) => {
    const div = document.createElement('div');
    div.className = 'scene-card';
    div.innerHTML = `
      <img src="${s.src}" alt="${s.title}" />
      <div><strong>${idx + 1}. ${s.title}</strong></div>
      <small style="color:#9a9aa6;">Durée : ${s.duration}s</small>
    `;
    container.appendChild(div);
  });
}

// 4. Music Sync (Web Audio API)
const audioPlayer = document.getElementById('audioPlayer');
document.getElementById('audioFileInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  audioPlayer.src = URL.createObjectURL(file);
  setupAudioAnalyser();
});

function setupAudioAnalyser() {
  if (state.audioCtx) return;
  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.audioCtx.createMediaElementSource(audioPlayer);
  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = 128;
  source.connect(state.analyser);
  state.analyser.connect(state.audioCtx.destination);
  state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);
  drawVisualizer();
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  if (!state.analyser) return;
  const vCanvas = document.getElementById('visualizerCanvas');
  const vCtx = vCanvas.getContext('2d');
  state.analyser.getByteFrequencyData(state.dataArray);

  vCtx.fillStyle = '#070709';
  vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);

  const barWidth = (vCanvas.width / state.dataArray.length) * 1.5;
  let x = 0;
  for (let i = 0; i < state.dataArray.length; i++) {
    const barHeight = state.dataArray[i] / 2;
    vCtx.fillStyle = i < 10 ? '#dc143c' : '#66000b';
    vCtx.fillRect(x, vCanvas.height - barHeight, barWidth - 2, barHeight);
    x += barWidth;
  }
}

// 5. Video Editor & Real-time Render Engine
const studioCanvas = document.getElementById('studioCanvas');
const ctx = studioCanvas.getContext('2d');

function renderStudioFrame() {
  if (!state.isPlaying) return;
  state.animationId = requestAnimationFrame(renderStudioFrame);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, studioCanvas.width, studioCanvas.height);

  // Calculate Bass Energy
  let bass = 0;
  if (state.analyser && state.dataArray) {
    state.analyser.getByteFrequencyData(state.dataArray);
    bass = (state.dataArray[0] + state.dataArray[1] + state.dataArray[2]) / 3;
  }

  // Determine current scene based on audio time
  let currentTime = audioPlayer.currentTime || (performance.now() / 1000);
  let totalCycle = state.scenes.reduce((acc, s) => acc + s.duration, 0) || 1;
  let loopTime = currentTime % totalCycle;

  let activeScene = state.scenes[0];
  let elapsed = 0;
  for (const scene of state.scenes) {
    if (loopTime >= elapsed && loopTime < elapsed + scene.duration) {
      activeScene = scene;
      break;
    }
    elapsed += scene.duration;
  }

  const effect = document.getElementById('effectSelect').value;

  if (activeScene && activeScene.img) {
    ctx.save();
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (effect === 'pulse') {
      scale = 1 + (bass / 255) * 0.14;
    } else if (effect === 'shake' && bass > 180) {
      offsetX = (Math.random() - 0.5) * 14;
      offsetY = (Math.random() - 0.5) * 14;
    }

    const w = studioCanvas.width * scale;
    const h = studioCanvas.height * scale;
    const x = (studioCanvas.width - w) / 2 + offsetX;
    const y = (studioCanvas.height - h) / 2 + offsetY;

    ctx.drawImage(activeScene.img, x, y, w, h);

    if (effect === 'crimson') {
      ctx.fillStyle = `rgba(220, 20, 60, ${0.18 + (bass / 255) * 0.2})`;
      ctx.fillRect(0, 0, studioCanvas.width, studioCanvas.height);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#dc143c';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ajoutez des scènes dans Scene Director', studioCanvas.width / 2, studioCanvas.height / 2);
  }

  // Watermark / Artist Credit
  if (state.character) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${state.character.name} — ELFACYEL VIDEO AI`, 16, studioCanvas.height - 16);
  }
}

document.getElementById('playPreviewBtn').addEventListener('click', () => {
  if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
  if (audioPlayer.src) audioPlayer.play();
  state.isPlaying = true;
  renderStudioFrame();
});

document.getElementById('stopPreviewBtn').addEventListener('click', () => {
  state.isPlaying = false;
  audioPlayer.pause();
  cancelAnimationFrame(state.animationId);
});

// 6. Export Video (MediaRecorder API)
document.getElementById('startExportBtn').addEventListener('click', () => {
  if (state.scenes.length === 0) return alert('Ajoutez au moins une scène avant d\'exporter.');

  const status = document.getElementById('exportStatus');
  const downloadContainer = document.getElementById('downloadContainer');
  downloadContainer.innerHTML = '';

  const stream = studioCanvas.captureStream(30); // 30 FPS
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    status.textContent = '✅ Export terminé avec succès !';
    downloadContainer.innerHTML = `
      <a href="${url}" download="ELFACYEL_CLIP.webm" class="btn-primary" style="display:inline-block; text-decoration:none; margin-top:10px;">
        ⬇ Télécharger la vidéo (.WEBM)
      </a>
    `;
  };

  // Start playback & recording
  if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
  audioPlayer.currentTime = 0;
  if (audioPlayer.src) audioPlayer.play();
  state.isPlaying = true;
  renderStudioFrame();
  recorder.start();

  const totalDuration = state.scenes.reduce((acc, s) => acc + s.duration, 0) * 1000;
  status.textContent = `⏳ Enregistrement en cours (${totalDuration / 1000}s)... Ne fermez pas la page.`;

  setTimeout(() => {
    recorder.stop();
    state.isPlaying = false;
    audioPlayer.pause();
  }, totalDuration);
});

// Initialize
updateUI();
  
