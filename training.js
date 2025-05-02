// --- TensorFlow model logic ---
let model;

// --- Дані для тренування ---
const trainingData = [];
const labels = [];

// --- Список міток для нот і акордів ---
const notes = [
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3",
    "G3", "G#3", "A3", "A#3", "B3",
    "D3_F3_A3", "C3_E3_G3", "E3_G3_B3", "E3_G#3_B3", "C3_F3_A3"
  ];

const allLabels = notes.map(note => {
const freq = getFrequencyByNote(note);
return `${note} (${freq.toFixed(2)}Hz)`;
});

  // const allLabels = [
//     // 48 нот (від C3 до B6, частоти в Гц)
//     "C3 (130.81Hz)","C#3 (138.59Hz)","D3 (146.83Hz)","D#3 (155.56Hz)","E3 (164.81Hz)","F3 (174.61Hz)","F#3 (185.00Hz)","G3 (196.00Hz)","G#3 (207.65Hz)","A3 (220.00Hz)","A#3 (233.08Hz)","B3 (246.94Hz)"
//     // "C4 (261.63Hz)","C#4 (277.18Hz)","D4 (293.66Hz)","D#4 (311.13Hz)","E4 (329.63Hz)","F4 (349.23Hz)","F#4 (369.99Hz)","G4 (392.00Hz)","G#4 (415.30Hz)","A4 (440.00Hz)","A#4 (466.16Hz)","B4 (493.88Hz)",
//     // "C5 (523.25Hz)","C#5 (554.37Hz)","D5 (587.33Hz)","D#5 (622.25Hz)","E5 (659.25Hz)","F5 (698.46Hz)","F#5 (739.99Hz)","G5 (783.99Hz)","G#5 (830.61Hz)","A5 (880.00Hz)","A#5 (932.33Hz)","B5 (987.77Hz)",
//     // "C6 (1046.50Hz)","C#6 (1108.73Hz)","D6 (1174.66Hz)","D#6 (1244.51Hz)","E6 (1318.51Hz)","F6 (1396.91Hz)","F#6 (1479.98Hz)","G6 (1567.98Hz)","G#6 (1661.22Hz)","A6 (1760.00Hz)","A#6 (1864.66Hz)","B6 (1975.53Hz)",
//     // "C7 (2093.00Hz)"

//     // 132 акорди, випадково вибрані (назви умовні, можуть бути будь-які комбінації)
//     // "C_E_G", "D_F_A", "E_G_B", "F_A_C5", "G_B_D5", "A_C5_E5", "B_D5_F#5", "C#4_E4_A4",
//     // "D#4_G4_B4", "F#4_A4_C5", "G#4_C5_E5", "A#4_D5_F5", "C5_E5_G5", "D5_F5_A5", "E5_G5_B5",
//     // "F5_A5_C6", "G5_B5_D6", "A5_C6_E6", "B5_D6_F#6", "C6_E6_G6", "D6_F6_A6", "E6_G6_B6",
//     // "C_E_G#", "D_F#_A#", "E_G#_B", "F#_A_C#5", "G#_B_D#5", "A#_C#5_E5", "B_D#5_F#5",
//     // "C4_E4_F#4", "D4_F#4_G4", "E4_G4_A4", "F4_A4_B4", "G4_B4_C5", "A4_C5_D5", "B4_D5_E5",
//     // "C5_E5_F#5", "D5_F#5_G5", "E5_G5_A5", "F5_A5_B5", "G5_B5_C6", "A5_C6_D6", "B5_D6_E6",
//     // "C3_E3_G3", "C4_E4_G4", "C5_E5_G5", "D3_F3_A3", "D4_F4_A4", "D5_F5_A5",
//     // "E3_G3_B3", "E4_G4_B4", "E5_G5_B5", "F3_A3_C4", "F4_A4_C5", "F5_A5_C6",
//     // "G3_B3_D4", "G4_B4_D5", "G5_B5_D6", "A3_C4_E4", "A4_C5_E5", "A5_C6_E6",
//     // "B3_D4_F#4", "B4_D5_F#5", "B5_D6_F#6"
// ];

function generateNotesForTraining(audioContext, analyser, dataArray) {
  const notes = allLabels.slice(0, 12).map(label => label.split(" ")[0]);

  const playSequentially = async () => {
      for (const note of notes) {
          const input = await playSoundAndCapture({
              audioContext, analyser, dataArray,
              notes: [note],
              duration: 1
          });

          if (input) {
              // 🔮 Передбачення
              const predictedIndex = predictNote(input);
              const predictedLabel = indexToNote(predictedIndex);

              console.log(`🎯 Очікувана нота: ${note}`);
              console.log(`🔮 Модель передбачила: ${predictedLabel}`);

              if (predictedLabel.startsWith(note)) {
                  // ✅ Якщо вгадано — додаємо до датасету
                  const label = new Array(allLabels.length).fill(0);
                  const index = allLabels.findIndex(l => l.startsWith(note));
                  if (index !== -1) {
                      label[index] = 1;
                      trainingData.push(input);
                      labels.push(label);
                      console.log(`✅ Додано правильне передбачення: ${note}`);
                  }
              } else {
                  // ❌ Якщо помилилась — зберігаємо для ручного виправлення
                  window._lastInput = input;
                  console.warn(`❌ Модель помилилась. Щоб виправити, введи:
correctPrediction(window._lastInput, "${note}")`);
              }
          }

          // ⏸️ Пауза перед наступною нотою
          pauseTraining();
          while (getTrainingPauseState()) {
              await new Promise(r => setTimeout(r, 100));
          }
      }
  };

  return playSequentially();
}


function generateChordsForTraining(audioContext, analyser, dataArray) {
  const chords = allLabels.slice(12).map(label => label.split(" ")[0]);

  const playSequentially = async () => {
      for (const chordName of chords) {
          const chordNotes = chordName.split("_");

          const input = await playSoundAndCapture({
              audioContext, analyser, dataArray,
              notes: chordNotes,
              duration: 1
          });

          if (input) {
              // 🔮 Передбачення
              const predictedIndex = predictNote(input);
              const predictedLabel = indexToNote(predictedIndex);

              console.log(`🎯 Очікуваний акорд: ${chordName}`);
              console.log(`🔮 Модель передбачила: ${predictedLabel}`);

              if (predictedLabel.startsWith(chordName)) {
                  // ✅ Якщо вгадано — додаємо
                  const label = new Array(allLabels.length).fill(0);
                  const index = allLabels.findIndex(l => l.startsWith(chordName));
                  if (index !== -1) {
                      label[index] = 1;
                      trainingData.push(input);
                      labels.push(label);
                      console.log(`✅ Додано правильне передбачення: ${chordName}`);
                  }
              } else {
                  // ❌ Якщо помилилась — зберігаємо для виправлення
                  window._lastInput = input;
                  console.warn(`❌ Модель помилилась. Щоб виправити, введи:
correctPrediction(window._lastInput, "${chordName}")`);
              }
          }

          // ⏸️ Пауза перед наступним акордом
          pauseTraining();
          while (getTrainingPauseState()) {
              await new Promise(r => setTimeout(r, 100));
          }
      }
  };

  return playSequentially();
}





function getFrequencyByNote(note) {
    const noteMap = { "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11 };
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 0;
    const [, key, octave] = match;

    // Обчислюємо порядковий номер ноти (MIDI-style)
    const noteIndex = noteMap[key] + (parseInt(octave) * 12);
    const a4Index = 9 + 4 * 12; // A4 = MIDI 57
    const semitoneOffset = noteIndex - a4Index;

    const frequency = 440 * Math.pow(2, semitoneOffset / 12);
    console.log(`Нота: ${key}${octave}, семітон: ${semitoneOffset}, частота: ${frequency.toFixed(2)} Hz`);

    // Обмеження діапазону
    if (frequency < 60 || frequency > 260) return 0;

    return frequency;
}

function playSoundAndCapture({ audioContext, analyser, dataArray, notes, duration = 1, onCaptured }) {
  if (!Array.isArray(notes) || notes.length === 0) {
      console.warn("Ноти не передані або порожні");
      return;
  }

  const gainNode = audioContext.createGain();
  gainNode.connect(analyser);
  gainNode.connect(audioContext.destination);

  const oscillators = notes.map(note => {
      const osc = audioContext.createOscillator();
      osc.type = "sine";
      osc.frequency.value = getFrequencyByNote(note);
      osc.connect(gainNode);
      return osc;
  });

  oscillators.forEach(osc => osc.start());
  oscillators.forEach(osc => osc.stop(audioContext.currentTime + duration));

  return new Promise((resolve) => {
      oscillators[0].onended = async () => {
          analyser.getByteFrequencyData(dataArray);

          const sampleRate = audioContext.sampleRate;
          const fftSize = analyser.fftSize;
          const binSize = sampleRate / fftSize;
          const startBin = Math.floor(65 / binSize);
          const endBin = Math.ceil(2100 / binSize);

          const trimmed = Array.from(dataArray).slice(startBin, endBin).map(v => v / 255);
          const hasEnergy = trimmed.some(val => val > 0.01);
          if (!hasEnergy) {
              console.warn("Пропущено порожній спектр");
              resolve(null);
              return;
          }

          resolve(trimmed);
      };
  });
}






// function playGeneratedNote(audioContext, analyser, dataArray, frequency, duration = 1, callback = null) {
//     if (frequency <= 0) {
//         console.warn("Пропущено недійсну частоту:", frequency);
//         callback && callback();
//         return;
//     }
//     const osc = audioContext.createOscillator();
//     const gainNode = audioContext.createGain();
//     osc.type = "sine";
//     osc.frequency.value = frequency;
//     osc.connect(gainNode);
//     gainNode.connect(analyser);
//     gainNode.connect(audioContext.destination);
//     osc.start();

//     // Збираємо спектр лише з потрібного частотного діапазону
//     const sampleRate = audioContext.sampleRate;
//     const fftSize = analyser.fftSize;
//     const binSize = sampleRate / fftSize;
//     const startBin = Math.floor(65 / binSize);
//     const endBin = Math.ceil(2100 / binSize);

//     osc.stop(audioContext.currentTime + duration);

//     osc.onended = async () => {
//         analyser.getByteFrequencyData(dataArray);
//         const trimmed = Array.from(dataArray).slice(startBin, endBin).map(v => v / 255);
    
//         // 🔮 Передбачення
//         const predictedIndex = predictNote(trimmed);
//         const predictedNote = indexToNote(predictedIndex);
//         console.log("🔮 Передбачено:", predictedNote);
    
//         // Зберігаємо дані
//         window._lastInput = trimmed;
//         window._lastPrediction = predictedNote;
    
//         // Поставити паузу ДО resolve()!
//         pauseTraining();
    
//         // дочекатися resume
//         while (getTrainingPauseState()) {
//             await new Promise(r => setTimeout(r, 100));
//         }
    
//         if (callback) callback(trimmed); // тільки після того, як користувач зняв паузу
//     };
// }

function createModel(inputSize = null, outputSize = notes.length) {
    if (!inputSize) inputSize = trainingData[0]?.length || 348;
    model = tf.sequential();
    model.add(tf.layers.dense({ units: outputSize, activation: 'softmax', inputShape: [inputSize] }));
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    console.log("Модель створено:");
    model.summary();
}

async function trainModel(epochs = 100, batchSize = 16) {
    if (!trainingData.length || !labels.length) {
      console.error("Немає даних для тренування");
      return;
    }
  
    initializeCharts();
  
    const correctSize = model.inputs[0].shape[1];
    const cleanData = trainingData.filter(d => d.length === correctSize);
    const cleanLabels = labels.slice(-cleanData.length);
  
    const xs = tf.tensor2d(cleanData, [cleanData.length, correctSize]);
    const ys = tf.tensor2d(cleanLabels);
  
    console.log("Починається тренування...");
    await model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Епоха ${epoch + 1}: точність = ${logs.acc.toFixed(4)}, втрата = ${logs.loss.toFixed(4)}`);
          updateCharts(epoch + 1, logs.acc, logs.loss);
        }
      }
    });
  
    xs.dispose();
    ys.dispose();
  
    console.log("Тренування завершено.");
  }

function predictNote(inputArray) {
    if (!model) {
        console.error("Модель ще не створено або не завантажено.");
        return -1;
    }
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

function resetTraining() {
    trainingData.length = 0;
    labels.length = 0;
    console.log("🧹 Дані очищено. Готово до нового тренування.");
    createModel(348); // створює нову модель з правильним inputSize, якщо є trainingData[0]
}

// JS з Chart.js

const canvasAcc = document.createElement('canvas');
canvasAcc.id = 'accuracyChart';
canvasAcc.width = 600;
canvasAcc.height = 300;
document.body.appendChild(canvasAcc);

const canvasLoss = document.createElement('canvas');
canvasLoss.id = 'lossChart';
canvasLoss.width = 600;
canvasLoss.height = 300;
document.body.appendChild(canvasLoss);

const accuracyData = [];
const lossData = [];

let accuracyChart, lossChart;

function initializeCharts() {
  // Знищення старих графіків, якщо вони існують
  if (accuracyChart) {
    accuracyChart.destroy();
    accuracyChart = null;
  }
  if (lossChart) {
    lossChart.destroy();
    lossChart = null;
  }

  // Створення нових графіків
  accuracyChart = new Chart(document.getElementById('accuracyChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Accuracy',
        borderColor: '#00C49F',
        data: [],
        fill: false
      }]
    },
    options: {
      responsive: false,
      scales: { y: { min: 0, max: 1 } }
    }
  });

  lossChart = new Chart(document.getElementById('lossChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Loss',
        borderColor: '#FF8042',
        data: [],
        fill: false
      }]
    },
    options: {
      responsive: false
    }
  });
}

function updateCharts(epoch, acc, loss) {
  accuracyChart.data.labels.push(epoch);
  accuracyChart.data.datasets[0].data.push(acc);
  accuracyChart.update();

  lossChart.data.labels.push(epoch);
  lossChart.data.datasets[0].data.push(loss);
  lossChart.update();
}

async function trainModelWithCharts(model, _, __, epochs = 30, batchSize = 16) {
    initializeCharts();
  
    // Автоматична перевірка розміру вхідних даних
    const correctSize = model.inputs[0].shape[1];
    const cleanData = trainingData.filter(d => d.length === correctSize);
    const cleanLabels = labels.slice(-cleanData.length);
  
    const xs = tf.tensor2d(cleanData, [cleanData.length, correctSize]);
    const ys = tf.tensor2d(cleanLabels);

  await model.fit(xs, ys, {
    epochs,
    batchSize,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        updateCharts(epoch + 1, logs.acc, logs.loss);
      }
    }
  });
}

// Додатково можна викликати trainModelWithCharts(...) із model, xs, ys після підготовки

/* Формули для пояснення:
Loss (Categorical Crossentropy): -∑(y * log(p))
Accuracy: Кількість правильних передбачень / Загальна кількість
*/
