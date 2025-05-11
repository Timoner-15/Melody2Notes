// --- TensorFlow model logic ---
let model;

// --- Дані для тренування ---
const trainingData = [];
const labels = [];
const labelNames = []; // <--- ДОДАНО
window.expectedMelody = []; // масив реальних міток
window.canPredict = true;

// --- Список міток для нот і акордів ---
const notes = [
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3",
    "G3", "G#3", "A3", "A#3", "B3",
    "D3_F3_A3", "C3_E3_G3", "E3_G3_B3", "E3_G#3_B3", "C3_F3_A3", "D3_G3_B3", "C3_D#3_G3", "C3_G3_B3", "C3_F3_B3"
  ];

const allLabels = notes.map(note => {
const freq = getFrequencyByNote(note);
return `${note} (${freq.toFixed(2)}Hz)`;
});

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
        const label = new Array(allLabels.length).fill(0);
        const index = allLabels.findIndex(l => l.startsWith(note));
        if (index !== -1) {
          label[index] = 1;
          trainingData.push(input);
          labels.push(label);
          labelNames.push(note);
          console.log(`🎼 Додано: ${note}`);
        }
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
        const label = new Array(allLabels.length).fill(0);
        const index = allLabels.findIndex(l => l.startsWith(chordName));
        if (index !== -1) {
          label[index] = 1;
          trainingData.push(input);
          labels.push(label);
          labelNames.push(chordName);
          console.log(`🎹 Додано: ${chordName}`);
        }
      }
    }
  };

  return playSequentially();
}



function splitDataset(data, labels, trainRatio = 0.8) {
  const indices = [...data.keys()];
  tf.util.shuffle(indices);

  const trainSize = Math.floor(data.length * trainRatio);

  const trainData = indices.slice(0, trainSize).map(i => data[i]);
  const trainLabels = indices.slice(0, trainSize).map(i => labels[i]);

  const testData = indices.slice(trainSize).map(i => data[i]);
  const testLabels = indices.slice(trainSize).map(i => labels[i]);

  return {
    trainData,
    trainLabels,
    testData,
    testLabels
  };
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
    // console.log(`Нота: ${key}${octave}, семітон: ${semitoneOffset}, частота: ${frequency.toFixed(2)} Hz`);

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
  gainNode.gain.value = 0.7 + Math.random() * 0.3;
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

          const fullTrimmed = Array.from(dataArray).slice(startBin, endBin).map(v => v / 255);

          const downsampled = [];
          const step = fullTrimmed.length / 64;
          for (let i = 0; i < 64; i++) {
            const idx = Math.floor(i * step);
            downsampled.push(fullTrimmed[idx]);
          }

          const trimmed = downsampled;
          const noisyTrimmed = trimmed.map(val => val + (Math.random() * 0.01)); // легкий шум
          const hasEnergy = noisyTrimmed.some(val => val > 0.01);
          if (!hasEnergy) {
              console.warn("Пропущено порожній спектр");
              resolve(null);
              return;
          }

          resolve(trimmed);
      };
  });
}

function createModel(inputSize = null, outputSize = notes.length) {
  if (!inputSize) inputSize = trainingData[0]?.length || 64;

  model = tf.sequential();

  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    inputShape: [inputSize]
  }));

  // 🧠 Латентний шар
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    name: 'latentSpace'
  }));

  model.add(tf.layers.dense({
    units: outputSize,
    activation: 'softmax'
  }));

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log("🧠 Модель з латентним простором створено:");
  model.summary();
}

async function trainModel(epochs = 200, batchSize = 20) {
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
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Епоха ${epoch + 1}: точність = ${logs.acc.toFixed(4)}, втрата = ${logs.loss.toFixed(4)}`);
          updateCharts(epoch + 1, logs.acc, logs.val_acc);
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
    createModel(64); // створює нову модель з правильним inputSize, якщо є trainingData[0]
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

canvasAcc.style.display = "none";
canvasLoss.style.display = "none";

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
        label: 'Train Accuracy',
        borderColor: '#00C49F',
        data: [],
        fill: false
      },
      {
        label: 'Validation Accuracy',
        borderColor: '#FFBB28',
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

function updateCharts(epoch, trainAcc, valAcc) {
  accuracyChart.data.labels.push(epoch);
  accuracyChart.data.datasets[0].data.push(trainAcc);
  accuracyChart.data.datasets[1].data.push(valAcc); // нова лінія
  accuracyChart.update();

  // loss без змін
  lossChart.data.labels.push(epoch);
  lossChart.data.datasets[0].data.push(valAcc); // або logs.loss
  lossChart.update();
}


async function trainModelWithCharts(model, _, __, epochs = 30, batchSize = 20) {
  initializeCharts();

  // Автоматична перевірка розміру вхідних даних
  const correctSize = model.inputs[0].shape[1];
  const cleanData = trainingData.filter(d => d.length === correctSize);
  const cleanLabels = labels.slice(-cleanData.length);

  const { trainData, trainLabels, testData, testLabels } = splitDataset(trainingData, labels);

  const xs = tf.tensor2d(trainData);
  const ys = tf.tensor2d(trainLabels);

  await model.fit(xs, ys, {
    epochs,
    batchSize,
    shuffle: true,
    validationSplit: 0.2, // <--- додай це!
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        updateCharts(epoch + 1, logs.acc, logs.val_acc);
        console.log(`Епоха ${epoch + 1}: точність = ${logs.acc.toFixed(4)}, втрата = ${logs.loss.toFixed(4)}, валідація = ${logs.val_acc.toFixed(4)}`);
      }
    }
  });

  // 🧠 Після тренування — вивід латентного простору
  const latentVectors = extractLatentVectors(model, cleanData);
  const reduced = reduceTo2D(latentVectors);

  // використовуємо labelNames, які відповідають усім trainingData
  exportLatentToCSV(reduced, labelNames.slice(-cleanData.length)); // <--- ВАЖЛИВО

  // 📊 Оцінка моделі на невідомих даних
  const xTest = tf.tensor2d(testData);
  const yTest = tf.tensor2d(testLabels);

  const evalResult = model.evaluate(xTest, yTest);

  evalResult.forEach((metric, i) => {
    metric.data().then(data => {
      console.log(`📊 Тестова метрика #${i}: ${data}`);
    });
  });
}

// ГЕНЕРАЦІЯ МЕЛОДІЇ із ДЕКІЛЬКОХ НОТ ТА АКОРДІВ

function playGeneratedMelody(audioContext, analyser, dataArray, count = 8, interval = 1000) {
  const labels = allLabels.map(label => label.split(" ")[0]);
  const sequence = [];

  window.expectedMelody = [];

  for (let i = 0; i < count; i++) {
    const randomLabel = labels[Math.floor(Math.random() * labels.length)];
    sequence.push(randomLabel);
    window.expectedMelody.push(randomLabel);
  }

  console.log("🎼 Згенерована мелодія:", sequence);

  let index = 0;

  const intervalId = setInterval(() => {
    if (index >= sequence.length) {
      clearInterval(intervalId);
      console.log("🏁 Мелодія завершена");
      return;
    }

    const label = sequence[index];
    const notes = label.includes("_") ? label.split("_") : [label];

    console.log(`🎵 Граємо (${index + 1}/${sequence.length}): ${label}`);

    window.canPredict = true; // 🔹 дозволяємо передбачити цю ноту

    playSoundAndCapture({
      audioContext, analyser, dataArray,
      notes,
      duration: 0.9
    });

    index++;
  }, interval);
}





// розпізнавання декількох нот та акордів у таймлапсі
let melodyRecognitionInterval = null;
let melodyTimeline = [];

function startMelodyRecognition(audioContext, analyser, dataArray, intervalMs = 500) {
  if (melodyRecognitionInterval !== null) {
    console.warn("⏱ Розпізнавання вже запущено.");
    return;
  }

  melodyTimeline = [];
  window.predictedMelody = [];
  window.canPredict = true;

  melodyRecognitionInterval = setInterval(() => {
    if (!window.canPredict) return;

    analyser.getByteFrequencyData(dataArray);

    const sampleRate = audioContext.sampleRate;
    const fftSize = analyser.fftSize;
    const binSize = sampleRate / fftSize;
    const startBin = Math.floor(65 / binSize);
    const endBin = Math.ceil(2100 / binSize);

    const fullTrimmed = Array.from(dataArray).slice(startBin, endBin).map(v => v / 255);

    const downsampled = [];
    const step = fullTrimmed.length / 64;
    for (let i = 0; i < 64; i++) {
      const idx = Math.floor(i * step);
      downsampled.push(fullTrimmed[idx]);
    }

    const trimmed = downsampled;
    const hasEnergy = trimmed.some(val => val > 0.01);
    if (!hasEnergy) return;

    const input = tf.tensor2d([trimmed]);
    const prediction = model.predict(input);
    const predictedIndex = prediction.argMax(-1).dataSync()[0];
    const confidence = prediction.dataSync()[predictedIndex];
    const predictedLabel = indexToNote(predictedIndex);
    input.dispose();
    prediction.dispose();

    const timestamp = performance.now() / 1000;
    melodyTimeline.push({ time: timestamp.toFixed(2), label: predictedLabel });

    console.log(`🎵 ${timestamp.toFixed(2)}s → ${predictedLabel} (${(confidence * 100).toFixed(1)}%)`);
    logPredictionToText(timestamp, predictedLabel, confidence);

    const labelOnly = predictedLabel.split(" ")[0];
    window.predictedMelody.push(labelOnly);
    window.canPredict = false;

    const notes = labelOnly.includes("_") ? labelOnly.split("_") : [labelOnly];
    if (typeof highlightKey === "function") {
      highlightKey(notes);
    }

    // ⏱ Розблокування наступного передбачення
    setTimeout(() => {
      window.canPredict = true;
    }, intervalMs);

  }, intervalMs);

  console.log("▶️ Запущено розпізнавання мелодії...");
}





function stopMelodyRecognition() {
  if (melodyRecognitionInterval !== null) {
    clearInterval(melodyRecognitionInterval);
    melodyRecognitionInterval = null;
    window._melodyStarted = false;
    console.log("⏹ Розпізнавання зупинено.");
    console.log("📄 Результат:", melodyTimeline);
  } else {
    console.warn("❗ Розпізнавання ще не було запущено.");
  }
}

function evaluateMelodyAccuracy() {
  if (!expectedMelody || !predictedMelody) {
    console.warn("Мелодія ще не згенерована або не передбачена.");
    return;
  }

  if (expectedMelody.length !== predictedMelody.length) {
    console.warn("⚠️ Довжини не збігаються:", expectedMelody.length, "vs", predictedMelody.length);
  }

  let correct = 0;
  const len = Math.min(expectedMelody.length, predictedMelody.length);
  for (let i = 0; i < len; i++) {
    if (expectedMelody[i] === predictedMelody[i]) {
      correct++;
    } else {
      console.log(`❌ ${i + 1}. Очікувалось: ${expectedMelody[i]} → Отримано: ${predictedMelody[i]}`);
    }
  }

  const accuracy = ((correct / len) * 100).toFixed(2);
  console.log(`🎯 Точність: ${correct} з ${len} (${accuracy}%)`);
}

function showConfusionMatrix(expected, predicted) {
  const matrix = {};

  expected.forEach((trueLabel, i) => {
    const predictedLabel = predicted[i];
    if (!matrix[trueLabel]) matrix[trueLabel] = {};
    if (!matrix[trueLabel][predictedLabel]) matrix[trueLabel][predictedLabel] = 0;
    matrix[trueLabel][predictedLabel]++;
  });

  console.log("📊 Confusion Matrix:");
  Object.entries(matrix).forEach(([trueLabel, preds]) => {
    console.log(`🟦 ${trueLabel}:`, preds);
  });
}

function extractLatentVectors(model, inputData) {
  const latentLayer = model.getLayer('latentSpace');
  const latentModel = tf.model({ inputs: model.inputs, outputs: latentLayer.output });

  const xs = tf.tensor2d(inputData);
  const latentVectors = latentModel.predict(xs);

  return latentVectors.arraySync(); // масив 16-елементних векторів
}

function reduceTo2D(vectors) {
  const centered = vectors.map(row => {
    const mean = row.reduce((sum, val) => sum + val, 0) / row.length;
    return row.map(val => val - mean);
  });

  // Просто виберемо перші дві координати — "штучне зниження"
  return centered.map(row => [row[0], row[1]]);
}

function exportLatentToCSV(points, labels) {
  let csv = "X,Y,Label\n";
  points.forEach((point, i) => {
    csv += `${point[0]},${point[1]},${labels[i]}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "latent_space.csv";
  a.click();
}

function saveToLocal() {
  localStorage.setItem("trainingData", JSON.stringify(trainingData));
  localStorage.setItem("labels", JSON.stringify(labels));
  localStorage.setItem("labelNames", JSON.stringify(labelNames));
}

function loadFromLocal() {
  const dataRaw = localStorage.getItem("trainingData");
  const labelsRaw = localStorage.getItem("labels");
  const namesRaw = localStorage.getItem("labelNames"); // <-- нова змінна

  if (dataRaw && labelsRaw) {
    const loadedData = JSON.parse(dataRaw);
    const loadedLabels = JSON.parse(labelsRaw);

    trainingData.length = 0;
    labels.length = 0;
    trainingData.push(...loadedData);
    labels.push(...loadedLabels);

    // завантажуємо назви лейблів, якщо є
    if (namesRaw) {
      const loadedNames = JSON.parse(namesRaw);
      labelNames.length = 0;
      labelNames.push(...loadedNames);
    } else {
      console.warn("⚠️ Не знайдено labelNames у localStorage. CSV може бути неповним.");
    }

    console.log("📦 Дані завантажено з localStorage:", trainingData.length);
  } else {
    console.log("📭 У localStorage поки немає збережених тренувальних даних.");
  }
}

function playMyMelody(audioContext, analyser, dataArray, interval = 1000) {
  const melody = [
    "D3_F3_A3",   "F3",      "C3_D#3_G3",  "G3",
    "C3",         "C3_F3_A3","A#3",        "C3_E3_G3",
    "E3",         "E3_G#3_B3", "B3",       "C3_F3_B3",
    "D#3",        "D3_G3_B3", "G3",        "C3_G3_B3",
    "C3_D#3_G3",  "F3",      "C3",         "C3_F3_A3"
  ];

  let index = 0;

  const intervalId = setInterval(() => {
    if (index >= melody.length) {
      clearInterval(intervalId);
      console.log("🏁 Мелодія завершена");
      return;
    }

    const item = melody[index];
    const notes = item.includes("_") ? item.split("_") : [item];

    console.log(`🎵 ${index + 1}/${melody.length}:`, item);
    playSoundAndCapture({
      audioContext, analyser, dataArray,
      notes,
      duration: 0.9
    });

    index++;
  }, interval);
}

// для створення власних файлів мелодій 
async function recordAndPlayMelody(audioContext, melody, duration = 1, interval = 1000) {
  const dest = audioContext.createMediaStreamDestination();
  const recorder = new MediaRecorder(dest.stream);
  const chunks = [];

  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'melody.webm';
    a.click();
    console.log("💾 Файл збережено як melody.webm");
  };

  recorder.start();
  console.log("🔴 Запис почато...");

  // генерація послідовно з записом
  let index = 0;

  const playNext = () => {
    if (index >= melody.length) {
      recorder.stop();
      console.log("🏁 Мелодія завершена, запис зупинено");
      return;
    }

    const item = melody[index];
    const notes = item.includes("_") ? item.split("_") : [item];

    // генерація через oscillator
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.7;
    gainNode.connect(audioContext.destination);
    gainNode.connect(dest);

    const oscillators = notes.map(note => {
      const osc = audioContext.createOscillator();
      osc.type = "sine";
      osc.frequency.value = getFrequencyByNote(note);
      osc.connect(gainNode);
      return osc;
    });

    oscillators.forEach(osc => osc.start());
    oscillators.forEach(osc => osc.stop(audioContext.currentTime + duration));

    setTimeout(playNext, interval);
    index++;
  };

  playNext();
}