# Simple Audio Visualizer

A minimal HTML/CSS/JS project demonstrating an audio visualizer using the Web Audio API and an HTML canvas.


Files:
- `index.html` — main page with controls and canvas
  
- `style.css` — basic styling
  
- `script.js` — Web Audio API + canvas visualization logic

Usage:

1. Open `index.html` in a modern browser (Chrome/Edge/Firefox). For local file audio playback, browsers usually allow playing a selected file without a server.
2. Click "Choose File" to pick an audio file (MP3, WAV, OGG, etc.).
3. Press Play to begin visualization. Use Pause to stop playback. Change FFT size for different granularity.

Microphone input:

- Click "Use Microphone" to allow the page to access your system microphone. Your browser will prompt for permission.
- Use the "Mic:" dropdown to choose a specific input device if you have multiple microphones.
- Adjust the "Gain" slider to change mic sensitivity.

Security / serving note:

- getUserMedia (microphone access) requires a secure context (HTTPS) or `http://localhost`. If you open the file via the `file:///` protocol, the microphone may not be available. To serve locally, run:

```powershell
# from the project folder
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

Notes:

- Some browsers restrict autoplay; the visualizer requires a user gesture to start audio.
- If you want to serve files over localhost,
- run a small static server, e.g. with Python:

  ```powershell
  # from the project folder
  python -m http.server 8000
  # then open http://localhost:8000 in your browser
  ```

Feel free to request additional features (spectrum smoothing, color themes, peak detection, microphone input, etc.)
