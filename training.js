// --- TensorFlow model logic ---
let model;

// --- Дані для тренування ---
const trainingData = [];
const labels = [];

// --- Список міток для нот і акордів ---
const allLabels = [
    // 48 нот (від C3 до B6, частоти в Гц)
    "C3 (130.81Hz)","C#3 (138.59Hz)","D3 (146.83Hz)","D#3 (155.56Hz)","E3 (164.81Hz)","F3 (174.61Hz)","F#3 (185.00Hz)","G3 (196.00Hz)","G#3 (207.65Hz)","A3 (220.00Hz)","A#3 (233.08Hz)","B3 (246.94Hz)",
    "C4 (261.63Hz)","C#4 (277.18Hz)","D4 (293.66Hz)","D#4 (311.13Hz)","E4 (329.63Hz)","F4 (349.23Hz)","F#4 (369.99Hz)","G4 (392.00Hz)","G#4 (415.30Hz)","A4 (440.00Hz)","A#4 (466.16Hz)","B4 (493.88Hz)",
    "C5 (523.25Hz)","C#5 (554.37Hz)","D5 (587.33Hz)","D#5 (622.25Hz)","E5 (659.25Hz)","F5 (698.46Hz)","F#5 (739.99Hz)","G5 (783.99Hz)","G#5 (830.61Hz)","A5 (880.00Hz)","A#5 (932.33Hz)","B5 (987.77Hz)",
    "C6 (1046.50Hz)","C#6 (1108.73Hz)","D6 (1174.66Hz)","D#6 (1244.51Hz)","E6 (1318.51Hz)","F6 (1396.91Hz)","F#6 (1479.98Hz)","G6 (1567.98Hz)","G#6 (1661.22Hz)","A6 (1760.00Hz)","A#6 (1864.66Hz)","B6 (1975.53Hz)",
    "C7 (2093.00Hz)"

    // 132 акорди, випадково вибрані (назви умовні, можуть бути будь-які комбінації)
    // "C_E_G", "D_F_A", "E_G_B", "F_A_C5", "G_B_D5", "A_C5_E5", "B_D5_F#5", "C#4_E4_A4",
    // "D#4_G4_B4", "F#4_A4_C5", "G#4_C5_E5", "A#4_D5_F5", "C5_E5_G5", "D5_F5_A5", "E5_G5_B5",
    // "F5_A5_C6", "G5_B5_D6", "A5_C6_E6", "B5_D6_F#6", "C6_E6_G6", "D6_F6_A6", "E6_G6_B6",
    // "C_E_G#", "D_F#_A#", "E_G#_B", "F#_A_C#5", "G#_B_D#5", "A#_C#5_E5", "B_D#5_F#5",
    // "C4_E4_F#4", "D4_F#4_G4", "E4_G4_A4", "F4_A4_B4", "G4_B4_C5", "A4_C5_D5", "B4_D5_E5",
    // "C5_E5_F#5", "D5_F#5_G5", "E5_G5_A5", "F5_A5_B5", "G5_B5_C6", "A5_C6_D6", "B5_D6_E6",
    // "C3_E3_G3", "C4_E4_G4", "C5_E5_G5", "D3_F3_A3", "D4_F4_A4", "D5_F5_A5",
    // "E3_G3_B3", "E4_G4_B4", "E5_G5_B5", "F3_A3_C4", "F4_A4_C5", "F5_A5_C6",
    // "G3_B3_D4", "G4_B4_D5", "G5_B5_D6", "A3_C4_E4", "A4_C5_E5", "A5_C6_E6",
    // "B3_D4_F#4", "B4_D5_F#5", "B5_D6_F#6"
];

function generateNotesForTraining(audioContext, analyser, dataArray) {
    const notes = allLabels.slice(0, 48).map(label => label.split(" ")[0]);

    const playSequentially = async () => {
        for (const note of notes) {
            await new Promise(resolve => {
                const frequency = getFrequencyByNote(note);
                playGeneratedNote(audioContext, analyser, dataArray, frequency, 1, () => {
                    analyser.getByteFrequencyData(dataArray);
                    const input = Array.from(dataArray).map(v => v / 255);
                    const label = new Array(48).fill(0);
                    const index = notes.indexOf(note);
                    label[index] = 1;
                    trainingData.push(input);
                    labels.push(label);
                    resolve();
                });
            });
            await new Promise(r => setTimeout(r, 200));
        }
    };

    return playSequentially();
}

function getFrequencyByNote(note) {
    const noteMap = {"C": 0,"C#": 1,"D": 2,"D#": 3,"E": 4,"F": 5,"F#": 6,"G": 7,"G#": 8,"A": 9,"A#": 10,"B": 11};
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 0;
    const [, key, octave] = match;
    const semitoneOffset = noteMap[key] + (parseInt(octave) - 4) * 12;
    const frequency = 440 * Math.pow(2, semitoneOffset / 12);

    // Обмеження діапазону (наприклад, від 65 Гц до 2100 Гц)
    if (frequency < 130 || frequency > 2100) return 0;

    return frequency;
}

function playGeneratedNote(audioContext, analyser, dataArray, frequency, duration = 1, callback = null) {
    if (frequency <= 0) {
        console.warn("Пропущено недійсну частоту:", frequency);
        callback && callback();
        return;
    }
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.connect(audioContext.destination);
    osc.start();

    // Збираємо спектр лише з потрібного частотного діапазону
    const sampleRate = audioContext.sampleRate;
    const fftSize = analyser.fftSize;
    const binSize = sampleRate / fftSize;
    const startBin = Math.floor(65 / binSize);
    const endBin = Math.ceil(2100 / binSize);

    osc.stop(audioContext.currentTime + duration);
    osc.onended = async () => {
        while (getTrainingPauseState()) {
            await new Promise(r => setTimeout(r, 1000));
        }
        analyser.getByteFrequencyData(dataArray);
        const trimmed = Array.from(dataArray).slice(startBin, endBin).map(v => v / 255);
        if (callback) callback(trimmed);
    };
}

function createModel(inputSize = 4096, outputSize = 48) {
    model = tf.sequential();
    model.add(tf.layers.dense({ units: outputSize, activation: 'softmax', inputShape: [4096] }));
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    console.log("Модель створено:");
    model.summary();
}

async function trainModel(epochs = 10, batchSize = 16) {
    if (!trainingData.length || !labels.length) {
        console.error("Немає даних для тренування");
        return;
    }

    const xs = tf.tensor2d(trainingData, [trainingData.length, 4096]);
    const ys = tf.tensor2d(labels);

    console.log("Починається тренування...");
    await model.fit(xs, ys, {
        epochs,
        batchSize,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Епоха ${epoch + 1}: точність = ${logs.acc.toFixed(4)}`);
            }
        }
    });
    xs.dispose();
    ys.dispose();

    console.log("Тренування завершено.");
}

function predictNote(inputArray) {
    const input = tf.tensor2d([inputArray]);
    const prediction = model.predict(input);
    const index = prediction.argMax(-1).dataSync()[0];
    input.dispose();
    prediction.dispose();
    return index;
}

function correctPrediction(trimmedInput, correctLabel) {
    const index = allLabels.findIndex(label => label.startsWith(correctLabel));
    if (index === -1) {
        console.warn("Невідома мітка:", correctLabel);
        return;
    }
    const labelVector = new Array(allLabels.length).fill(0);
    labelVector[index] = 1;
    trainingData.push(trimmedInput);
    labels.push(labelVector);
    console.log(`➕ Додано до тренування як: ${correctLabel}`);
}

function indexToNote(index) {
    if (index >= 0 && index < allLabels.length) {
        return allLabels[index];
    }
    return "Unknown";
}

function getValidNotes(noteList) {
    return noteList.filter(note => {
        const f = getFrequencyByNote(note);
        return f >= 65 && f <= 2100;
    });
}

// --- Пауза/продовження самотренування ---
let isPaused = false;

function pauseTraining() {
    isPaused = true;
    console.log("⏸️ Тренування призупинено");
}

function resumeTraining() {
    isPaused = false;
    console.log("▶️ Тренування продовжено");
}

function getTrainingPauseState() {
    return isPaused;
}

async function saveModel() {
    if (!model) {
        console.warn("Модель ще не створено.");
        return;
    }
    await model.save('localstorage://note-model');
    console.log("Модель збережено в localStorage");
}

async function loadModel() {
    try {
        model = await tf.loadLayersModel('localstorage://note-model');
        console.log("Модель завантажено з localStorage");
        model.summary();
    } catch (err) {
        console.error("Не вдалося завантажити модель:", err);
    }
};
