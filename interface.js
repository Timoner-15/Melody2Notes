const tf = window.tf || {};
let audioElement, sourceNode, analyser, dataArray, canvas, canvasCtx, pianoRollCanvas, pianoRollCtx, waterfallCanvas, waterfallCtx;
let lastLogged = 0; // timestamp in ms
let isFirstPlay = true;
let isProcessInProgress = false;

window.addEventListener('load', () => {

    if (typeof createAndInsertWaterfallCanvas === "function") createAndInsertWaterfallCanvas();
    if (typeof createAndInsertPianoRoll === "function") createAndInsertPianoRoll();
    if (typeof drawPianoRoll === "function") drawPianoRoll();
    if (typeof initializeCharts === "function") initializeCharts();
    if (typeof loadFromLocal === "function") loadFromLocal();
    tryLoadModel();
});

function activateApp() {
    document.querySelectorAll("button").forEach(btn => btn.disabled = false);
    if (typeof initializeCharts === "function") initializeCharts();
    if (typeof drawSpectrums === "function") drawSpectrums();
    if (typeof loadFromLocal === "function") loadFromLocal();
}

document.getElementById('audioFile').addEventListener('change', function(event) {
    if (isProcessInProgress) {
        console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
        return;
    }
    const file = event.target.files[0];
    if (!file) return;
    const objectURL = URL.createObjectURL(file);
    initializeAudio(objectURL, file);
});

async function tryLoadModel() {
    try {
        await loadModel();
        console.log("✅ Модель завантажена");
        activateApp();
    } catch (err) {
        console.warn("⚠️ Модель не знайдена");
    }
}


function initializeAudio(url, file) {
    audioContext = new AudioContext();
    audioElement = new Audio(url);
    audioElement.load();
    sourceNode = audioContext.createMediaElementSource(audioElement);
    analyser = audioContext.createAnalyser();
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 8192;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    console.log("Analyser initialized with FFT size:", analyser.fftSize);

    canvas = document.getElementById("visualizer");
    canvasCtx = canvas.getContext("2d");

    audioElement.addEventListener("play", () => {
        if (melodyRecognitionInterval !== null) {
            stopMelodyRecognition();
        }

        if (!window._melodyStarted) {
            window._melodyStarted = true;
            window.audioStartTime = performance.now(); // 🕒 фіксуємо старт
            console.log("▶️ Аудіо запущено — старт розпізнавання");
            startMelodyRecognition(audioContext, analyser, dataArray);
        }
    });


    drawWaterfall();
    // drawPianoRoll();
    
    draw();
    
    document.getElementById("play").addEventListener("click", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        if (audioElement) {
          // 🧼 Очистити лог
          const logBox = document.getElementById("predictionLog");
          if (logBox) {
            logBox.innerHTML = "<strong>📋 Розпізнані акорди / ноти:</strong>";
          }
      
          // ⏱ Скинути стартовий час
          window.audioStartTime = null;
          window._melodyStarted = false; // дозволити перезапуск
      
          // ▶️ Старт аудіо
          audioElement.play();
        }
      });
    document.getElementById("pause").addEventListener("click", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        if (audioElement) {
            audioElement.pause();
            stopMelodyRecognition();
            window._melodyStarted = false;
            console.log("⏸️ Аудіо і розпізнавання поставлені на паузу");
        }
    });
    document.getElementById("stop").addEventListener("click", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
            stopMelodyRecognition(); // ❗ Зупиняємо розпізнавання
            window._melodyStarted = false;
            console.log("⏹ Розпізнавання і аудіо зупинені");
        }
    });

    document.getElementById("generateAndRecognize").addEventListener("click", () => {
        if (!audioContext || !analyser || !dataArray) {
            console.warn("⚠️ Аудіо або аналізатор ще не ініціалізовано.");
            return;
        }
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }

        // Очищуємо лог
        const logBox = document.getElementById("predictionLog");
        if (logBox) {
            logBox.innerHTML = "<strong>📋 Розпізнані акорди / ноти:</strong>";
        }

        // Завжди зупиняємо попередні процеси
        if (melodyRecognitionInterval !== null) {
            stopMelodyRecognition();
        }
        if (generatedMelodyInterval !== null) {
            clearInterval(generatedMelodyInterval);
            generatedMelodyInterval = null;
        }

        // Скидаємо стани
        window.audioStartTime = null;
        window._melodyStarted = false;
        window.canPredict = true;

        // 🔥 Завжди запускаємо розпізнавання нот та акордів ПЕРЕД мелодією
        startMelodyRecognition(audioContext, analyser, dataArray);

        if (isFirstPlay) {
            console.log("🎬 Відтворюємо Гімн України (перший раз)");
            playMyMelody(audioContext, analyser, dataArray);
            isFirstPlay = false;
        } else {
            console.log("🎬 Відтворюємо згенеровану мелодію");
            playGeneratedMelody(audioContext, analyser, dataArray, 8);
        }

    });

    

    document.getElementById("createModelBtn").addEventListener("click", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        createModel();
        console.log("🧠 Нова модель створена.");
    });

    document.getElementById("generateDataBtn").addEventListener("click", async () => {
        if (!audioContext || !analyser || !dataArray) {
            console.warn("⚠️ Аудіо не ініціалізовано.");
            return;
        }
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }

        disableAllControls();

        // Завжди зупиняємо розпізнавання перед генерацією
        if (melodyRecognitionInterval !== null) {
            stopMelodyRecognition();
            console.log("⏹ Розпізнавання зупинено для чистоти тренувальних даних.");
        }
        try {
            console.log("🎼 Генерація нот...");
            await generateNotesForTraining(audioContext, analyser, dataArray);

            console.log("🎹 Генерація акордів...");
            await generateChordsForTraining(audioContext, analyser, dataArray);

            console.log("✅ Генерація завершена.");
            saveToLocal();
            console.log("💾 Dataset збережено автоматично після генерації.");
        } catch (err) {
            console.warn("❌ Помилка під час генерації:", err);
        } finally {
            enableAllControls();
        }
    });

    document.getElementById("trainModelBtn").addEventListener("click", () => {
        if (!model) {
            console.warn("⚠️ Модель не створено.");
            return;
        }
        if (isProcessInProgress) {
            console.warn("⚠️ Тренування вже запущене.");
            return;
        }
        disableAllControls();

        console.log("🚀 Запуск тренування...");
        trainModelWithCharts().then(() => {
            console.log("✅ Тренування завершено.");
        }).catch(() => {
            console.warn("❌ Помилка під час тренування.");
        }).finally(() => {
            enableAllControls();
        });
    });

    document.getElementById("saveModelBtn").addEventListener("click", () => {
        if (model) {
            if (isProcessInProgress) {
                console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
                return;
            }
            saveModel();
            console.log("💾 Модель збережено.");
        } else {
            console.warn("⚠️ Модель ще не створено.");
        }
    });
    
    const progress = document.getElementById("progress");
    audioElement.addEventListener("timeupdate", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        progress.value = (audioElement.currentTime / audioElement.duration) * 100;
        updateFileInfo(file);
    });
    
    progress.addEventListener("input", () => {
        if (isProcessInProgress) {
            console.warn("⚠️ Неможливо виконати. Триває тренування моделі.");
            return;
        }
        audioElement.currentTime = (progress.value / 100) * audioElement.duration;
    });
}

function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.fillStyle = "black";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "white";
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    canvasCtx.stroke();
}

function createAndInsertPianoRoll(targetId = 'keyboardContainer') {
    const container = document.getElementById(targetId);
    if (!container) {
        console.error(`❌ Контейнер з id="${targetId}" не знайдено.`);
        return null;
    }

    const existingCanvas = document.getElementById('pianoRollCanvas');
    if (existingCanvas) existingCanvas.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'pianoRollCanvas';
    canvas.width = 600;
    canvas.height = 200;
    canvas.style.background = '#333';

    container.appendChild(canvas);

    pianoRollCanvas = canvas; // ← важливо
    pianoRollCtx = canvas.getContext('2d'); // ← важливо

    return canvas;
}

function drawPianoRoll(highlightedNotes = [], targetCanvasId = 'pianoRollCanvas') {
    const canvas = pianoRollCanvas || document.getElementById(targetCanvasId);
    if (!canvas) {
        console.error(`❌ Canvas з id="${targetCanvasId}" не знайдено.`);
        return;
    }

    const ctx = pianoRollCtx || canvas.getContext('2d');
    if (!ctx) {
        console.error(`❌ Canvas context не знайдено.`);
        return;
    }

    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startOctave = 3;
    const endOctave = 3;
    const keyWidth = canvas.width / (7);
    const blackKeyWidth = keyWidth * 0.6;
    const blackKeyHeight = canvas.height * 0.6;

    const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];
    const blackKeyOffsets = [0.7, 1.7, 3.7, 4.7, 5.7];
    const blackKeyNames = ["C#", "D#", "F#", "G#", "A#"];

    // Draw white keys
    for (let i = 0; i < whiteKeys.length; i++) {
        let note = whiteKeys[i] + startOctave;
        let isHighlighted = highlightedNotes.includes(note);
        ctx.fillStyle = isHighlighted ? "yellow" : "white";
        ctx.fillRect(i * keyWidth, 0, keyWidth - 2, canvas.height);
        ctx.strokeRect(i * keyWidth, 0, keyWidth, canvas.height);

        // Додаємо підпис ноти
        ctx.fillStyle = isHighlighted ? "black" : "black";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(note, i * keyWidth + keyWidth / 2, canvas.height - 10);
    }

    // Draw black keys
    for (let i = 0; i < blackKeyOffsets.length; i++) {
        let note = blackKeyNames[i] + startOctave;
        let x = blackKeyOffsets[i] * keyWidth;
        let isHighlighted = highlightedNotes.includes(note);
        ctx.fillStyle = isHighlighted ? "yellow" : "black";
        ctx.fillRect(x, 0, blackKeyWidth, blackKeyHeight);

        // Додаємо підпис ноти на чорній клавіші
        ctx.fillStyle = isHighlighted ? "black" : "white";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(note, x + blackKeyWidth / 2, blackKeyHeight - 5);
    }
}


function logPredictionToText(timestamp, predictedLabel, confidence, played = null) {
    const logBox = document.getElementById("predictionLog");
  
    // 🕒 коригований час відносно старту аудіо
    const offset = window.audioStartTime || 0;
    const relativeTime = ((timestamp * 1000 - offset) / 1000).toFixed(2);
  
    const time = `${relativeTime}s`;
    const pred = `${predictedLabel} (${(confidence * 100).toFixed(1)}%)`;
  
    let line = `🎵 ${time} → ${pred}`;
    if (played) {
      line = `▶️ ${time} — зіграно: ${played} | передбачено: ${pred}`;
    }
  
    logBox.innerHTML += `\n${line}`;
    logBox.scrollTop = logBox.scrollHeight;
}

window.highlightKey = function(labelOrNotes) {
    const notes = Array.isArray(labelOrNotes)
      ? labelOrNotes
      : (labelOrNotes.includes("_") ? labelOrNotes.split("_") : [labelOrNotes]);
  
    //console.log("🎹 Підсвітити ці ноти:", notes);
    drawPianoRoll(notes);
  };

function updateFileInfo(file) {
    const fileInfoDiv = document.getElementById("fileInfo");
    const duration = audioElement.duration ? audioElement.duration.toFixed(2) + " sec" : "Calculating...";
    fileInfoDiv.innerHTML = `<strong>File Name:</strong> ${file.name} <br>
                             <strong>Duration:</strong> ${duration} <br>`;
}


function normalizeData(dataArray) {
    const norm = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
        norm[i] = dataArray[i] / 255;
    }
    return norm;
}


// --- applyWindowFunction with TensorFlow ---
function applyWindowFunction(dataArray, type) {
    const N = dataArray.length;
    let windowTensor;

    if (type === "Hann") {
        windowTensor = tf.signal.hannWindow(N);
    } else if (type === "Hamming") {
        windowTensor = tf.signal.hammingWindow(N);
    } else {
        // Blackman-Harris вручну
        const winArray = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            winArray[i] = 0.35875
                - 0.48829 * Math.cos((2 * Math.PI * i) / (N - 1))
                + 0.14128 * Math.cos((4 * Math.PI * i) / (N - 1))
                - 0.01168 * Math.cos((6 * Math.PI * i) / (N - 1));
        }
        windowTensor = tf.tensor1d(winArray);
    }

    const inputTensor = tf.tensor1d(dataArray);
    const resultTensor = inputTensor.mul(windowTensor);
    const windowed = resultTensor.arraySync();

    inputTensor.dispose();
    windowTensor.dispose();
    resultTensor.dispose();

    return windowed;
}


function drawSpectrums() {
    requestAnimationFrame(drawSpectrums);
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    const rawCtx = document.getElementById("rawSpectrumCanvas")?.getContext("2d");
    const winCtx = document.getElementById("windowedSpectrumCanvas")?.getContext("2d");
    const windowType = document.getElementById("windowFunction")?.value || "Hamming";
    const processedData = applyWindowFunction(dataArray, windowType);
    const binCount = Math.floor((2000 / audioContext.sampleRate) * analyser.fftSize);

    if (rawCtx) {
        rawCtx.clearRect(0, 0, 600, 150);
        rawCtx.beginPath();
        rawCtx.moveTo(0, 150);
        for (let i = 0; i < binCount; i++) {
            const x = (i / binCount) * 600;
            const y = 150 - (dataArray[i] / 255) * 150;
            rawCtx.lineTo(x, y);
        }
        rawCtx.lineTo(600, 150);
        rawCtx.fillStyle = "rgba(255,255,255,0.3)";
        rawCtx.fill();
    }

    if (winCtx) {
        winCtx.clearRect(0, 0, 600, 150);
        winCtx.beginPath();
        winCtx.moveTo(0, 150);
    
        const maxValue = Math.max(...processedData); // знайти найбільше значення
        const scale = maxValue > 0 ? 1 / maxValue : 1; // нормування

        for (let i = 0; i < binCount; i++) {
        const normalized = processedData[i] * scale;
        const y = 150 - normalized * 150;
        const x = (i / binCount) * 600;
        winCtx.lineTo(x, y);
        }
    
        winCtx.lineTo(600, 150);
        winCtx.fillStyle = "rgba(255, 200, 0, 0.5)";
        winCtx.fill();
    }
}

function createAndInsertWaterfallCanvas(targetId = 'keyboardContainer') {
    const container = document.getElementById(targetId);
    if (!container) {
        console.error(`❌ Контейнер з id="${targetId}" не знайдено.`);
        return null;
    }

    // Очистити попередній, якщо є
    const existingCanvas = container.querySelector('#fallingNotesCanvas');
    if (existingCanvas) existingCanvas.remove();

    // Створити новий canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'fallingNotesCanvas';
    canvas.width = 600;
    canvas.height = 300;
    canvas.style.background = 'black';

    container.appendChild(canvas);

    // Оновити глобальні змінні
    waterfallCanvas = canvas;
    waterfallCtx = canvas.getContext('2d');
}

function drawWaterfall() {
    if (!analyser || !waterfallCtx) {
        console.error('Waterfall visualization: Analyser or Canvas context is not initialized');
        return;
    }

    if (!window.offscreenWaterfall) {
        const buffer = document.createElement("canvas");
        buffer.width = waterfallCanvas.width;
        buffer.height = waterfallCanvas.height;
        window.offscreenWaterfall = buffer;
        window.offscreenCtx = buffer.getContext("2d");
    }

    const ctx = window.offscreenCtx;
    const target = waterfallCtx;
    const width = waterfallCanvas.width;
    const height = waterfallCanvas.height;

    analyser.getByteFrequencyData(dataArray);
    const windowType = document.getElementById("windowFunction")?.value || "Hamming";
    const normalized = normalizeData(dataArray);
    const processedData = applyWindowFunction(normalized, windowType);

    const binCount = Math.floor((2000 / audioContext.sampleRate) * analyser.fftSize);

    const imageData = ctx.getImageData(0, 0, width, height - 1);
    ctx.putImageData(imageData, 0, 1);

    for (let i = 0; i < binCount; i++) {
        const value = processedData[i];
        const power = Math.pow(value, 0.5);
        const threshold = 0.03;
        if (power < threshold) continue;

        const logPower = Math.log10(1 + 9 * power);
        const x = Math.floor((i / binCount) * width);

        // Two-color gradient: black (low) to yellow (high)
        const intensity = Math.min(255, logPower * 255);
        ctx.fillStyle = `rgb(${intensity}, ${intensity}, 0)`;
        ctx.fillRect(x, 0, 1, 1);
    }

    target.clearRect(0, 0, width, height);
    target.drawImage(window.offscreenWaterfall, 0, 0);

    requestAnimationFrame(drawWaterfall);
}

function disableAllControls() {
    isProcessInProgress = true;
    document.querySelectorAll("button").forEach(btn => btn.disabled = true);
    console.log("🚫 Всі кнопки тимчасово заблоковані (тренування)");
}

function enableAllControls() {
    isProcessInProgress = false;
    document.querySelectorAll("button").forEach(btn => btn.disabled = false);
    console.log("✅ Кнопки знову активні");
}