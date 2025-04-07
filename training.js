// Генератор нот для тренування
async function generateNotesForTraining(audioContext, analyser, dataArray) {
    if (!(analyser instanceof AnalyserNode)) {
        console.error("Invalid analyser instance:", analyser);
        return;
    }

    // Встановлюємо FFT розмір
    // analyser.fftSize = 8192;
    // const bufferLength = analyser.frequencyBinCount;
    // dataArray = new Uint8Array(bufferLength);

    console.log("Training Analyser initialized with FFT size:", analyser.fftSize);    
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
            playGeneratedNote(audioContext, analyser, dataArray, frequency, 1, () => {
                captureTrainingData(note, analyser, dataArray);
                resolve();
            });
        });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log("Автоматичне тренування завершено.");
}

function playGeneratedNote(audioContext, analyser, dataArray, frequency, duration = 1, callback = null) {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency;

    osc.connect(gainNode);
    gainNode.connect(analyser); // Підключаємо до аналізатора
    gainNode.connect(audioContext.destination); // Відправляємо звук в динаміки

    osc.start();
    osc.stop(audioContext.currentTime + duration);

    osc.onended = () => {
        if (callback) callback();
    };
}

// Функція для збереження спектральних даних
const trainingData = [];
const labels = [];

function captureTrainingData(note, analyser, dataArray) {
    if (!(analyser instanceof AnalyserNode)) {
        console.error("Invalid analyser instance:", analyser);
        return;
    }
    if (!dataArray) {
        console.error("Data array is not initialized.");
        return;
    }
    setTimeout(() => {
        analyser.getByteFrequencyData(dataArray);
        const input = Array.from(dataArray);
        trainingData.push(input);
        
        const output = new Array(180).fill(0);
        const index = noteIndex(note);
        if (index >= 0 && index < 180) {
            output[index] = 1;
        } else {
            console.warn(`Note ${note} has an invalid index: ${index}`);
        }
        labels.push(output);
        console.log(`Збережено: ${note}, Індекс: ${index}, Дані:`, input.slice(0, 10)); // Перевіряємо перші 10 значень
    }, 200);
}

function noteIndex(note) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = parseInt(note.slice(-1));
    const key = notes.indexOf(note.slice(0, -1));
    return (octave - 3) * 12 + key;
}

function captureTrainingData(note, analyser, dataArray) {
    if (!(analyser instanceof AnalyserNode)) {
        console.error("Invalid analyser instance:", analyser);
        return;
    }
    if (!dataArray) {
        console.error("Data array is not initialized.");
        return;
    }
    
    analyser.getByteFrequencyData(dataArray);
    const input = Array.from(dataArray);
    trainingData.push(input);
    
    const output = new Array(180).fill(0);
    const index = noteIndex(note);
    if (index >= 0 && index < 180) {
        output[index] = 1;
    } else {
        console.warn(`Note ${note} has an invalid index: ${index}`);
    }
    labels.push(output);

    console.log(`Збережено: ${note}, Індекс: ${index}, Дані:`, input.slice(0, 10)); // Виводимо перші 10 значень
}
