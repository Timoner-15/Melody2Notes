if (!window.tf) {
    const tf = window.tf || {};
}
if (!window.audioContext) {
    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}
let audioContext = window.audioContext;
console.log(audioContext);
if (!window.analyser || !(window.analyser instanceof AnalyserNode)) {
    window.analyser = null;
    window.dataArray = null;
}

// Генератор нот для тренування
window.generateNotesForTraining = async function() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!window.analyser || !(window.analyser instanceof AnalyserNode)) {
        window.analyser = audioContext.createAnalyser();
        window.sourceNode = audioContext.createOscillator();
        window.sourceNode.connect(window.analyser);
        window.analyser.connect(audioContext.destination);
        window.analyser.fftSize = 8192;
        if (!window.dataArray) {
            window.dataArray = new Uint8Array(window.analyser.frequencyBinCount);
        }
    }
    
    const notes = {
        "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94,
        "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00, "A4": 440.00, "B4": 493.88,
        "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99, "A5": 880.00, "B5": 987.77,
        "C6": 1046.50, "D6": 1174.66, "E6": 1318.51, "F6": 1396.91, "G6": 1567.98, "A6": 1760.00, "B6": 1975.53,
        "C7": 2093.00
    };
    
    for (const [note, frequency] of Object.entries(notes)) {
        console.log("Граю та записую:", note);
        await new Promise(resolve => {
            playGeneratedNote(frequency, 1, () => {
                captureTrainingData(note);
                resolve();
            });
        });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log("Автоматичне тренування завершено.");
}

window.playGeneratedNote = function(frequency, duration = 1, callback = null) {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency;
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + duration);

    osc.onended = () => {
        if (callback) callback();
    };
}

// Функція для збереження спектральних даних
const trainingData = [];
const labels = [];

window.captureTrainingData = function(note) {
    if (!window.analyser || !window.dataArray) {
        console.error("Analyser or dataArray is not initialized");
        return;
    }
    analyser.getByteFrequencyData(dataArray);
    const input = Array.from(dataArray);
    trainingData.push(input);
    
    const output = new Array(180).fill(0);
    output[noteIndex(note)] = 1;
    labels.push(output);
}

window.noteIndex = function(note) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = parseInt(note.slice(-1));
    const key = notes.indexOf(note.slice(0, -1));
    return (octave - 3) * 12 + key;
}
