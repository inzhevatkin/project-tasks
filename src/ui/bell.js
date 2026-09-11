let audioContext = null;

export function prepareAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.warn("Не удалось подготовить звуковой сигнал таймера", error);
  }
}

export function playTimerChime(completedPhase) {
  prepareAudio();
  if (!audioContext) return;
  const strikes = completedPhase === "focus"
    ? [{ frequency: 880, delay: 0 }, { frequency: 1175, delay: 0.34 }]
    : [{ frequency: 660, delay: 0 }, { frequency: 523, delay: 0.42 }];
  strikes.forEach(({ frequency, delay }) => strikeBell(frequency, audioContext.currentTime + delay));
}

function strikeBell(baseFrequency, start) {
  const partials = [
    { ratio: 1, level: 0.11, decay: 1.8 },
    { ratio: 2.01, level: 0.05, decay: 1.35 },
    { ratio: 3.9, level: 0.025, decay: 0.9 },
    { ratio: 5.4, level: 0.012, decay: 0.65 }
  ];
  partials.forEach(({ ratio, level, decay }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = baseFrequency * ratio;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + decay);
  });
}
