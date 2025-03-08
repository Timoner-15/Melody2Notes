const tf = window.tf || {};
// console.log(audioContext);
let audioElement, sourceNode, analyser, dataArray, canvas, canvasCtx, pianoRollCanvas, pianoRollCtx, waterfallCanvas, waterfallCtx;

// Додаємо новий canvas для частотного водоспаду
window.onload = function() {
    waterfallCanvas = document.createElement("canvas");
    waterfallCanvas.width = 600;
    waterfallCanvas.height = 100;
    waterfallCanvas.style.background = "black";
    document.body.appendChild(waterfallCanvas);
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

/// Функція для оновлення частотного водоспаду
function drawWaterfall() {
    setTimeout(drawWaterfall, 20);
    analyser.getByteFrequencyData(dataArray);
    
    const imageData = waterfallCtx.getImageData(0, 0, waterfallCanvas.width, waterfallCanvas.height);
    waterfallCtx.putImageData(imageData, 0, 1);
    
    for (let i = 0; i < dataArray.length; i++) {
        const frequency = (i / analyser.fftSize) * audioContext.sampleRate;
        if (frequency >= 32 && frequency <= 261) {
            const x = (frequency - 32) / (261 - 32) * waterfallCanvas.width;
            const intensity = dataArray[i];
            waterfallCtx.fillStyle = `rgb(${intensity}, ${intensity * 0.8}, ${intensity * 0.4})`;
            waterfallCtx.fillRect(x, 0, 2, 1);
        }
    }
}


