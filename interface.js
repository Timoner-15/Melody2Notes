const tf = window.tf || {};
// console.log(audioContext);
let audioElement, sourceNode, analyser, dataArray, canvas, canvasCtx, pianoRollCanvas, pianoRollCtx, waterfallCanvas, waterfallCtx;
let lastLogged = 0; // timestamp in ms

// Додаємо новий canvas для частотного водоспаду
window.onload = function() {
    const windowSelect = document.createElement("select");
    windowSelect.id = "windowFunction";
    ["Hamming", "Blackman-Harris", "Hann"].forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        windowSelect.appendChild(opt);
    });
    document.body.insertBefore(windowSelect, document.body.firstChild);

    // --- Add Save Training Data Button ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Зберегти Training Data";
    saveBtn.onclick = () => {
        const blob = new Blob([
            JSON.stringify({ trainingData, labels }, null, 2)
        ], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "training_data.json";
        link.click();
    };
    document.body.insertBefore(saveBtn, windowSelect.nextSibling);

    const trainBtn = document.createElement("button");
    trainBtn.textContent = "Тренувати модель";
    trainBtn.onclick = () => {
        trainModel();
    };
    document.body.appendChild(trainBtn);

    const predictBtn = document.createElement("button");
    predictBtn.textContent = "Передбачити ноту";
    predictBtn.onclick = () => {
        analyser.getByteFrequencyData(dataArray);
        const input = Array.from(dataArray).map(v => v / 255);
        const index = predictNote(input);
        const note = indexToNote(index);
        alert("Передбачена нота: " + note);
        highlightKey(note);
    };
    document.body.appendChild(predictBtn);

    waterfallCanvas = document.createElement("canvas");
    waterfallCanvas.width = 600;
    waterfallCanvas.height = 100;
    waterfallCanvas.style.background = "black";
    document.body.appendChild(waterfallCanvas);

     // Додаємо canvas для сирого спектру
     const rawSpectrumCanvas = document.createElement("canvas");
     rawSpectrumCanvas.id = "rawSpectrumCanvas";
     rawSpectrumCanvas.width = 600;
     rawSpectrumCanvas.height = 150;
     rawSpectrumCanvas.style.background = "#111";
     document.body.appendChild(rawSpectrumCanvas);
 
     // Додаємо canvas для спектру після віконної функції
     const windowedSpectrumCanvas = document.createElement("canvas");
     windowedSpectrumCanvas.id = "windowedSpectrumCanvas";
     windowedSpectrumCanvas.width = 600;
     windowedSpectrumCanvas.height = 150;
     windowedSpectrumCanvas.style.background = "#111";
     document.body.appendChild(windowedSpectrumCanvas);
 
     // Стартуємо анімацію спектрів
     drawSpectrums();

    waterfallCtx = waterfallCanvas.getContext("2d", { willReadFrequently: true });
};

document.getElementById('audioFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const objectURL = URL.createObjectURL(file);
        initializeAudio(objectURL, file);
    }
});

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
    
    pianoRollCanvas = document.createElement("canvas");
    pianoRollCanvas.width = 600;
    pianoRollCanvas.height = 200;
    pianoRollCanvas.style.background = "#333";
    document.body.appendChild(pianoRollCanvas);
    pianoRollCtx = pianoRollCanvas.getContext("2d");
    
    draw();
    drawPianoRoll();
    drawWaterfall();
    
    document.getElementById("train").addEventListener("click", () => {
        generateNotesForTraining(audioContext, analyser, dataArray);
    });
    document.getElementById("play").addEventListener("click", () => {
        if (audioElement) {
            audioElement.play();
        }
    });
    document.getElementById("pause").addEventListener("click", () => {
        if (audioElement) {
            audioElement.pause();
        }
    });
    document.getElementById("restart").addEventListener("click", () => {
        if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play();
        }
    });
    
    const progress = document.getElementById("progress");
    audioElement.addEventListener("timeupdate", () => {
        progress.value = (audioElement.currentTime / audioElement.duration) * 100;
        updateFileInfo(file);
    });
    
    progress.addEventListener("input", () => {
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

function drawPianoRoll(highlightedNote = null) {
    if (!pianoRollCtx) {
        console.error("pianoRollCtx is not initialized");
        return;
    }
    pianoRollCtx.fillStyle = "#333";
    pianoRollCtx.fillRect(0, 0, pianoRollCanvas.width, pianoRollCanvas.height);
    
    const numOctaves = 4;
    const totalKeys = numOctaves * 12;
    const keyWidth = pianoRollCanvas.width / (numOctaves * 7);
    const blackKeyWidth = keyWidth * 0.6;
    const blackKeyHeight = pianoRollCanvas.height * 0.6;
    
    const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];
    const blackKeyOffsets = [0.7, 1.7, 3.7, 4.7, 5.7];
    const blackKeyNames = ["C#", "D#", "F#", "G#", "A#"];
    
    // Draw white keys
    for (let oct = 0; oct < numOctaves; oct++) {
        for (let i = 0; i < whiteKeys.length; i++) {
            let note = whiteKeys[i] + (oct + 1);
            pianoRollCtx.fillStyle = (note === highlightedNote) ? "yellow" : "white";
            pianoRollCtx.fillRect((oct * 7 + i) * keyWidth, 0, keyWidth - 2, pianoRollCanvas.height);
            pianoRollCtx.strokeRect((oct * 7 + i) * keyWidth, 0, keyWidth, pianoRollCanvas.height);
        }
    }
    
    // Draw black keys
    for (let oct = 0; oct < numOctaves; oct++) {
        for (let i = 0; i < blackKeyOffsets.length; i++) {
            let note = blackKeyNames[i] + (oct + 1);
            let x = (oct * 7 + blackKeyOffsets[i]) * keyWidth;
            pianoRollCtx.fillStyle = (note === highlightedNote) ? "yellow" : "black";
            pianoRollCtx.fillRect(x, 0, blackKeyWidth, blackKeyHeight);
        }
    }
}

function highlightKey(note) {
    drawPianoRoll(note);
}

function updateFileInfo(file) {
    const fileInfoDiv = document.getElementById("fileInfo");
    const duration = audioElement.duration ? audioElement.duration.toFixed(2) + " sec" : "Calculating...";
    fileInfoDiv.innerHTML = `<strong>File Name:</strong> ${file.name} <br>
                             <strong>Duration:</strong> ${duration} <br>
                             <strong>Current Chord:</strong> (Not implemented yet)`;
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
        for (let i = 0; i < binCount; i++) {
            const x = (i / binCount) * 600;
            const y = 150 - (processedData[i] / 255) * 150;
            winCtx.lineTo(x, y);
        }
        winCtx.lineTo(600, 150);
        winCtx.fillStyle = "rgba(255, 200, 0, 0.3)";
        winCtx.fill();
    }
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
