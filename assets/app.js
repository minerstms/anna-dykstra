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
  var soundOn = true;
  var currentPair = null;
  var answered = false;

  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, start, duration, type, gainValue) {
    var ctx = ensureAudio();
    if (!ctx) {
      return;
    }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.18, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.02);
  }

  function playJackpotChime() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    // C major jackpot cascade: C4 E4 G4 C5 E5 G5 C6
    var notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    var i;
    for (i = 0; i < notes.length; i += 1) {
      playTone(notes[i], i * 0.08, 0.28, "triangle", 0.16);
      playTone(notes[i] * 2, i * 0.08 + 0.02, 0.18, "sine", 0.08);
    }
    // Final casino sparkle chord
    playTone(523.25, 0.62, 0.55, "square", 0.07);
    playTone(659.25, 0.64, 0.55, "square", 0.07);
    playTone(783.99, 0.66, 0.55, "square", 0.07);
    playTone(1046.5, 0.68, 0.7, "triangle", 0.14);
  }

  function playTapBlip() {
    if (!soundOn) {
      return;
    }
    ensureAudio();
    playTone(523.25, 0, 0.12, "sine", 0.12);
    playTone(659.25, 0.05, 0.12, "triangle", 0.1);
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
    playTapBlip();
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
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
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
    updateSoundButton();
    if (soundOn) {
      playTapBlip();
    }
  });

  document.body.addEventListener(
    "pointerdown",
    function () {
      ensureAudio();
    },
    { once: true }
  );

  updateSoundButton();
  showRound();
})();
