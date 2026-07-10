(function () {
  "use strict";

  var STORAGE_KEY = "anna-wyr-votes-v1";
  var OPTIONS = window.ANNA_WYR_OPTIONS || [];

  var choiceABtn = document.getElementById("choiceA");
  var choiceBBtn = document.getElementById("choiceB");
  var resultsEl = document.getElementById("results");
  var labelA = document.getElementById("labelA");
  var labelB = document.getElementById("labelB");
  var barA = document.getElementById("barA");
  var barB = document.getElementById("barB");
  var percentA = document.getElementById("percentA");
  var percentB = document.getElementById("percentB");
  var nextBtn = document.getElementById("nextBtn");
  var soundBtn = document.getElementById("soundBtn");
  var confettiLayer = document.getElementById("confetti");
  var flashEl = document.getElementById("flash");

  var audioCtx = null;
  var masterGain = null;
  var bgGain = null;
  var soundOn = true;
  var currentPair = null;
  var answered = false;
  var bgTimer = null;
  var bgStep = 0;
  var lastClickSoundAt = 0;

  var C_MAJOR = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  var BG_PATTERN = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 261.63, 392.0];

  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioCtx.destination);
      bgGain = audioCtx.createGain();
      bgGain.gain.value = soundOn ? 0.08 : 0;
      bgGain.connect(masterGain);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, start, duration, type, gainValue, destination) {
    var ctx = ensureAudio();
    if (!ctx) {
      return;
    }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var dest = destination || masterGain;
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.18, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.02);
  }

  function playNoiseBurst(start, duration, gainValue) {
    var ctx = ensureAudio();
    if (!ctx) {
      return;
    }
    var frames = Math.floor(ctx.sampleRate * duration);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i;
    for (i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.08, ctx.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(ctx.currentTime + start);
    source.stop(ctx.currentTime + start + duration + 0.02);
  }

  function playAnywhereClick() {
    if (!soundOn) {
      return;
    }
    var now = Date.now();
    if (now - lastClickSoundAt < 40) {
      return;
    }
    lastClickSoundAt = now;
    ensureAudio();
    playTone(1046.5, 0, 0.06, "square", 0.05);
    playTone(1318.51, 0.03, 0.07, "sine", 0.06);
    playNoiseBurst(0.01, 0.05, 0.035);
  }

  function playTapBlip() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    playTone(523.25, 0, 0.1, "sine", 0.12);
    playTone(659.25, 0.04, 0.1, "triangle", 0.1);
    playTone(783.99, 0.08, 0.12, "sine", 0.08);
  }

  function playChoiceSound(pickedA) {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    if (pickedA) {
      playTone(392.0, 0, 0.12, "triangle", 0.14);
      playTone(523.25, 0.08, 0.14, "triangle", 0.14);
      playTone(659.25, 0.16, 0.18, "sine", 0.12);
    } else {
      playTone(329.63, 0, 0.12, "triangle", 0.14);
      playTone(392.0, 0.08, 0.14, "triangle", 0.14);
      playTone(523.25, 0.16, 0.18, "sine", 0.12);
    }
    playNoiseBurst(0.05, 0.08, 0.04);
  }

  function playRoundStartSound() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    playTone(261.63, 0, 0.16, "triangle", 0.1);
    playTone(329.63, 0.1, 0.16, "triangle", 0.1);
    playTone(392.0, 0.2, 0.18, "triangle", 0.11);
    playTone(523.25, 0.3, 0.22, "sine", 0.12);
  }

  function playRevealSparkle() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    playTone(783.99, 0, 0.12, "sine", 0.08);
    playTone(1046.5, 0.08, 0.14, "sine", 0.09);
    playTone(1318.51, 0.16, 0.18, "triangle", 0.08);
    playNoiseBurst(0.1, 0.1, 0.03);
  }

  function playJackpotChime() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    var notes = C_MAJOR;
    var i;
    for (i = 0; i < notes.length; i += 1) {
      playTone(notes[i], i * 0.07, 0.3, "triangle", 0.17);
      playTone(notes[i] * 2, i * 0.07 + 0.02, 0.2, "sine", 0.09);
      playNoiseBurst(i * 0.07, 0.06, 0.03);
    }
    playTone(523.25, 0.55, 0.6, "square", 0.08);
    playTone(659.25, 0.57, 0.6, "square", 0.08);
    playTone(783.99, 0.59, 0.6, "square", 0.08);
    playTone(1046.5, 0.61, 0.75, "triangle", 0.16);
    playTone(1318.51, 0.7, 0.45, "sine", 0.1);
    playNoiseBurst(0.62, 0.2, 0.05);
  }

  function playSoundOnConfirm() {
    ensureAudio();
    playTone(523.25, 0, 0.12, "triangle", 0.14);
    playTone(659.25, 0.08, 0.14, "triangle", 0.14);
    playTone(783.99, 0.16, 0.18, "sine", 0.14);
    playTone(1046.5, 0.24, 0.25, "sine", 0.12);
  }

  function playBgStep() {
    if (!soundOn || !audioCtx || !bgGain) {
      return;
    }
    var note = BG_PATTERN[bgStep % BG_PATTERN.length];
    var harmony = BG_PATTERN[(bgStep + 2) % BG_PATTERN.length];
    playTone(note / 2, 0, 0.55, "sine", 0.55, bgGain);
    playTone(note, 0.02, 0.4, "triangle", 0.35, bgGain);
    playTone(harmony, 0.08, 0.35, "sine", 0.22, bgGain);
    if (bgStep % 4 === 0) {
      playTone(note * 2, 0.05, 0.2, "sine", 0.18, bgGain);
      playNoiseBurst(0, 0.04, 0.015);
    }
    bgStep += 1;
  }

  function startBackgroundMusic() {
    ensureAudio();
    if (bgTimer) {
      return;
    }
    playBgStep();
    bgTimer = window.setInterval(playBgStep, 420);
  }

  function stopBackgroundMusic() {
    if (bgTimer) {
      window.clearInterval(bgTimer);
      bgTimer = null;
    }
    if (bgGain && audioCtx) {
      bgGain.gain.cancelScheduledValues(audioCtx.currentTime);
      bgGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    }
  }

  function setBackgroundLevel() {
    if (!bgGain || !audioCtx) {
      return;
    }
    bgGain.gain.cancelScheduledValues(audioCtx.currentTime);
    bgGain.gain.setTargetAtTime(soundOn ? 0.08 : 0, audioCtx.currentTime, 0.08);
  }

  function loadVotes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (err) {
      return {};
    }
    return {};
  }

  function saveVotes(votes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
    } catch (err) {
      // Ignore storage failures and keep playing.
    }
  }

  function pairKey(a, b) {
    return a < b ? a + "||" + b : b + "||" + a;
  }

  function seededCounts(key) {
    var hash = 0;
    var i;
    for (i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    var total = 40 + (hash % 80);
    var aShare = 0.22 + ((hash % 57) / 100);
    var aCount = Math.max(1, Math.round(total * aShare));
    var bCount = Math.max(1, total - aCount);
    return { a: aCount, b: bCount };
  }

  function getPairVotes(aText, bText) {
    var votes = loadVotes();
    var key = pairKey(aText, bText);
    var aIsFirst = aText < bText;
    if (!votes[key]) {
      var seed = seededCounts(key);
      votes[key] = { left: seed.a, right: seed.b };
      saveVotes(votes);
    }
    if (aIsFirst) {
      return { a: votes[key].left, b: votes[key].right, key: key, aIsFirst: true };
    }
    return { a: votes[key].right, b: votes[key].left, key: key, aIsFirst: false };
  }

  function recordVote(aText, bText, pickedA) {
    var votes = loadVotes();
    var key = pairKey(aText, bText);
    var aIsFirst = aText < bText;
    if (!votes[key]) {
      var seed = seededCounts(key);
      votes[key] = { left: seed.a, right: seed.b };
    }
    if (pickedA) {
      if (aIsFirst) {
        votes[key].left += 1;
      } else {
        votes[key].right += 1;
      }
    } else if (aIsFirst) {
      votes[key].right += 1;
    } else {
      votes[key].left += 1;
    }
    saveVotes(votes);
    return getPairVotes(aText, bText);
  }

  function randomIndex(max, avoid) {
    if (max <= 1) {
      return 0;
    }
    var idx = Math.floor(Math.random() * max);
    if (typeof avoid === "number") {
      var guard = 0;
      while (idx === avoid && guard < 20) {
        idx = Math.floor(Math.random() * max);
        guard += 1;
      }
    }
    return idx;
  }

  function pickPair() {
    if (OPTIONS.length < 2) {
      return { a: "dance in rainbow confetti", b: "sing a jackpot victory song" };
    }
    var i = randomIndex(OPTIONS.length);
    var j = randomIndex(OPTIONS.length, i);
    return { a: OPTIONS[i], b: OPTIONS[j] };
  }

  function resetChoiceStyles() {
    choiceABtn.classList.remove("is-picked", "is-not-picked");
    choiceBBtn.classList.remove("is-picked", "is-not-picked");
    choiceABtn.disabled = false;
    choiceBBtn.disabled = false;
  }

  function showRound() {
    answered = false;
    currentPair = pickPair();
    resetChoiceStyles();
    choiceABtn.textContent = currentPair.a;
    choiceBBtn.textContent = currentPair.b;
    resultsEl.classList.remove("is-visible");
    barA.style.width = "0%";
    barB.style.width = "0%";
    playRoundStartSound();
  }

  function burstConfetti() {
    var colors = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#457b9d", "#9b5de5", "#f72585", "#ffd93d"];
    var count = 48;
    var i;
    for (i = 0; i < count; i += 1) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 1.4 + Math.random() * 1.4 + "s";
      piece.style.animationDelay = Math.random() * 0.2 + "s";
      piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      confettiLayer.appendChild(piece);
      window.setTimeout(
        function (node) {
          if (node && node.parentNode) {
            node.parentNode.removeChild(node);
          }
        },
        3200,
        piece
      );
    }
  }

  function celebrate() {
    flashEl.classList.remove("is-on");
    void flashEl.offsetWidth;
    flashEl.classList.add("is-on");
    burstConfetti();
    playJackpotChime();
  }

  function revealStats(pickedA) {
    var tallies = recordVote(currentPair.a, currentPair.b, pickedA);
    var total = tallies.a + tallies.b;
    var pctA = Math.round((tallies.a / total) * 100);
    var pctB = 100 - pctA;

    labelA.textContent = "A: " + currentPair.a;
    labelB.textContent = "B: " + currentPair.b;
    percentA.textContent = pctA + "% chose this";
    percentB.textContent = pctB + "% chose this";
    resultsEl.classList.add("is-visible");
    playRevealSparkle();

    window.requestAnimationFrame(function () {
      barA.style.width = pctA + "%";
      barB.style.width = pctB + "%";
    });
  }

  function onChoose(pickedA) {
    if (answered || !currentPair) {
      return;
    }
    answered = true;
    playChoiceSound(pickedA);
    choiceABtn.disabled = true;
    choiceBBtn.disabled = true;
    if (pickedA) {
      choiceABtn.classList.add("is-picked");
      choiceBBtn.classList.add("is-not-picked");
    } else {
      choiceBBtn.classList.add("is-picked");
      choiceABtn.classList.add("is-not-picked");
    }
    celebrate();
    revealStats(pickedA);
  }

  function updateSoundButton() {
    soundBtn.textContent = soundOn ? "Sound is on" : "Sound is off";
  }

  function applySoundState() {
    updateSoundButton();
    ensureAudio();
    setBackgroundLevel();
    if (soundOn) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
  }

  choiceABtn.addEventListener("click", function () {
    onChoose(true);
  });

  choiceBBtn.addEventListener("click", function () {
    onChoose(false);
  });

  nextBtn.addEventListener("click", function () {
    playTapBlip();
    showRound();
  });

  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    applySoundState();
    if (soundOn) {
      playSoundOnConfirm();
    }
  });

  document.addEventListener("pointerdown", function () {
    ensureAudio();
    if (soundOn) {
      startBackgroundMusic();
      setBackgroundLevel();
      playAnywhereClick();
    }
  });

  updateSoundButton();
  showRound();
})();
