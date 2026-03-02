// Simple Audio Visualizer using Web Audio API and Canvas

const audioFile = document.getElementById('audioFile');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const fftSizeSelect = document.getElementById('fftSize');
// full-screen canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ensure canvas is positioned to cover viewport behind the UI
// canvas layout is handled in CSS (fixed, inset:0, pointer-events:none)

let audioCtx = null;
let sourceNode = null;
let analyser = null;
let dataArray = null;
let bufferLength = 0;
let audioElement = null;
let audioBuffer = null; // decoded AudioBuffer
let isPlaying = false;
let startTimestamp = 0; // audioCtx.currentTime when playback started
let pausedAt = 0; // seconds into the buffer where paused
let animationId = null;
// Store previous frame's frequency data for smooth transitions
let previousData = null;
// Transition speed (0-1, higher = faster)
const smoothingFactor = 0.3;
// Fade effect opacity (0-1, lower = longer trails)
const fadeOpacity = 0.1;
// Microphone-related
let micStream = null;
let micSource = null;
const micBtn = document.getElementById('micBtn');
const micSelect = document.getElementById('micSelect');
const micGainControl = document.getElementById('micGain');
let micGainNode = null;
const statusEl = document.getElementById('status');

function resizeCanvas() {
  // Full viewport size in CSS pixels
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  // set the drawingbuffer size taking devicePixelRatio into account
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  // keep CSS size to viewport
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  // scale the context so drawing commands map to CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

async function setupAudio(arrayBuffer) {
  // Close any existing context
  if (audioCtx) {
    try { audioCtx.close(); } catch (e) {}
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // create analyser
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = parseInt(fftSizeSelect.value, 10);
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  // Initialize previous data array
  previousData = new Float32Array(bufferLength).fill(0);


  // decode audio data into an AudioBuffer and store it
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  // disconnect any previous source
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
    sourceNode.disconnect();
  }

  // create but don't start the BufferSource here; create on play so we can control offset
  analyser.connect(audioCtx.destination);

  playBtn.disabled = false;
  pauseBtn.disabled = false;

  // reset playback tracking
  pausedAt = 0;
  startTimestamp = 0;
  isPlaying = false;
  // start paused; play will call start/resume
}

function draw() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  // Apply fade effect instead of clearing
  ctx.fillStyle = `rgba(0,0,0,${fadeOpacity})`;
  ctx.fillRect(0, 0, width, height);

  // Animated, colorful frequency bars
  const barCount = bufferLength;
  const barWidth = width / barCount;
  for (let i = 0; i < barCount; i++) {
    // Smooth transition between current and previous values
    const currentAmplitude = dataArray[i] / 255;
    previousData[i] = previousData[i] + (currentAmplitude - previousData[i]) * smoothingFactor;
    const amplitude = previousData[i];

    const barHeight = amplitude * height;
    
    // Create gradient for each bar
    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
    const hue = Math.round((i / barCount) * 270 + 90);
    gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
    gradient.addColorStop(1, `hsla(${hue}, 80%, 80%, 0.2)`);
    
    ctx.fillStyle = gradient;
    
    // Draw bar with rounded top
    const x = i * barWidth;
    const w = Math.max(1, barWidth - 1);
    
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x, height - barHeight + w/2);
    ctx.arc(x + w/2, height - barHeight + w/2, w/2, Math.PI, 0, false);
    ctx.lineTo(x + w, height);
    ctx.fill();
    
    // Add highlight effect
    if (amplitude > 0.5) {
      ctx.fillStyle = `hsla(${hue}, 90%, 90%, ${(amplitude - 0.5) * 0.5})`;
      ctx.fillRect(x, height - barHeight, w, w);
    }
  }

  animationId = requestAnimationFrame(draw);
}

audioFile.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const arrayBuffer = ev.target.result;
    await setupAudio(arrayBuffer);
    resizeCanvas();
    if (animationId) cancelAnimationFrame(animationId);
    draw();
  };
  reader.onerror = (err) => {
    console.error('FileReader error', err);
  };
  reader.readAsArrayBuffer(f);
});

// Microphone controls
async function startMic() {
  // create AudioContext and analyser if missing
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = parseInt(fftSizeSelect.value, 10);
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    previousData = new Float32Array(bufferLength).fill(0);
    // we'll connect analyser to destination later if needed
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('getUserMedia not supported in this browser. Use a modern browser such as Chrome, Edge, or Firefox.');
    return;
  }

  micBtn.disabled = true; // prevent double clicks while requesting
  console.log('Requesting microphone access...');
  if (statusEl) statusEl.textContent = 'Status: requesting microphone...';
  try {
    const selected = micSelect.value;
    const constraints = selected ? { audio: { deviceId: { exact: selected } }, video: false } : { audio: true, video: false };
    micStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Microphone stream acquired', micStream);
      // After permission is granted, device labels become available — refresh list
      try { await populateMicDevices(); } catch (e) { /* ignore */ }
  if (statusEl) statusEl.textContent = 'Status: microphone active';
  } catch (err) {
    console.error('Microphone permission denied or error:', err);
    if (statusEl) statusEl.textContent = 'Status: microphone error';
    alert('Could not access microphone: ' + (err && err.message ? err.message : err));
    micBtn.disabled = false;
    return;
  } finally {
    micBtn.disabled = false;
  }

  micSource = audioCtx.createMediaStreamSource(micStream);
  // create gain node if not exists
  if (!micGainNode) micGainNode = audioCtx.createGain();
  micGainNode.gain.value = parseFloat(micGainControl.value || '1');
  // connect mic -> gain -> analyser
  micSource.connect(micGainNode);
  micGainNode.connect(analyser);

  // connect analyser to destination so audio can be heard (optional)
  if (!analyser.connectedToDestination) {
    analyser.connect(audioCtx.destination);
    analyser.connectedToDestination = true;
  }

  // update UI state
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  isPlaying = true;
  micBtn.textContent = 'Stop Microphone';
  if (!animationId) draw();
}

function stopMic() {
  if (micSource) {
    try { micSource.disconnect(); } catch (e) {}
    micSource = null;
  }
  if (micGainNode) {
    try { micGainNode.disconnect(); } catch (e) {}
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  playBtn.disabled = false;
  pauseBtn.disabled = false;
  isPlaying = false;
  micBtn.textContent = 'Use Microphone';
  if (statusEl) statusEl.textContent = 'Status: idle';
}

micBtn.addEventListener('click', async () => {
  if (micStream) {
    stopMic();
  } else {
    // stop any playing buffer source
    if (sourceNode) {
      try { sourceNode.stop(); } catch (e) {}
      try { sourceNode.disconnect(); } catch (e) {}
      sourceNode = null;
      isPlaying = false;
    }
    await startMic();
  }
});

// mic gain control listener
micGainControl.addEventListener('input', () => {
  if (micGainNode) micGainNode.gain.value = parseFloat(micGainControl.value);
});

// enumerate devices and populate micSelect
async function populateMicDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    micSelect.innerHTML = '<option value="">Default</option>';
    inputs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microphone ${micSelect.length}`;
      micSelect.appendChild(opt);
    });
  } catch (e) {
    console.error('Could not enumerate devices', e);
  }
}

// call populate on load
populateMicDevices();

playBtn.addEventListener('click', async () => {
  if (!audioCtx || !audioBuffer) return;
  // resume context if suspended
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  // if already playing, do nothing
  if (isPlaying) return;

  // create a fresh BufferSource and start at pausedAt offset
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
    sourceNode.disconnect();
  }
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.loop = true;
  sourceNode.connect(analyser);

  // record when playback starts
  startTimestamp = audioCtx.currentTime - pausedAt;
  sourceNode.start(0, pausedAt % audioBuffer.duration);
  isPlaying = true;
});

pauseBtn.addEventListener('click', () => {
  if (!audioCtx || !isPlaying) return;
  // calculate paused position
  pausedAt = audioCtx.currentTime - startTimestamp;
  // stop the current source
  try { sourceNode.stop(); } catch (e) {}
  try { sourceNode.disconnect(); } catch (e) {}
  sourceNode = null;
  isPlaying = false;
});

fftSizeSelect.addEventListener('change', () => {
  if (!analyser) return;
  analyser.fftSize = parseInt(fftSizeSelect.value, 10);
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  previousData = new Float32Array(bufferLength).fill(0);
});

// init
resizeCanvas();
