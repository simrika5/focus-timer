
const hoursWheel = document.getElementById("hoursWheel");
const minutesWheel = document.getElementById("minutesWheel");
const secondsWheel = document.getElementById("secondsWheel");

const focusTab = document.getElementById("focusTab");
const breakTab = document.getElementById("breakTab");

const timerLabel = document.getElementById("timerLabel");
const timerDisplay = document.getElementById("timerDisplay");
const clockCaption = document.getElementById("clockCaption");
const clockSubtitle = document.getElementById("clockSubtitle");
const progressRing = document.getElementById("progressRing");

const startBtn = document.getElementById("startBtn");
const startIcon = document.getElementById("startIcon");
const startText = document.getElementById("startText");
const resetBtn = document.getElementById("resetBtn");

const message = document.getElementById("message");
const completedCount = document.getElementById("completedCount");

const ITEM_HEIGHT = 42;
const CIRCUMFERENCE = 2 * Math.PI * 128;

let mode = "focus";
let focusDuration = 25 * 60;
let breakDuration = 5 * 60;

let remaining = focusDuration;
let total = focusDuration;

let timerId = null;
let running = false;
let completed = 0;
let wheelTimeouts = new Map();


// ---------- SCROLLING TIME WHEELS ----------

function buildWheel(wheel, maxValue, initialValue) {
    wheel.replaceChildren();

    for (let value = 0; value <= maxValue; value++) {
        const item = document.createElement("div");

        item.className = "wheel-item";
        item.textContent = String(value).padStart(2, "0");
        item.dataset.value = value;

        wheel.appendChild(item);
    }

    setWheelValue(wheel, initialValue);
}

function getWheelValue(wheel) {
    return Math.max(
        0,
        Math.min(
            Math.round(wheel.scrollTop / ITEM_HEIGHT),
            wheel.children.length - 1
        )
    );
}

function setWheelValue(wheel, value) {
    const safeValue = Math.max(
        0,
        Math.min(value, wheel.children.length - 1)
    );

    wheel.scrollTop = safeValue * ITEM_HEIGHT;
    updateWheelHighlight(wheel, safeValue);
}

function updateWheelHighlight(wheel, selectedValue) {
    [...wheel.children].forEach((item, index) => {
        item.classList.toggle("selected", index === selectedValue);
    });
}

function getPickerSeconds() {
    return (
        getWheelValue(hoursWheel) * 3600 +
        getWheelValue(minutesWheel) * 60 +
        getWheelValue(secondsWheel)
    );
}

function setPickerFromSeconds(value) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = value % 60;

    setWheelValue(hoursWheel, hours);
    setWheelValue(minutesWheel, minutes);
    setWheelValue(secondsWheel, seconds);
}

function setWheelsEnabled(enabled) {
    [hoursWheel, minutesWheel, secondsWheel].forEach(wheel => {
        wheel.style.pointerEvents = enabled ? "auto" : "none";
        wheel.style.opacity = enabled ? "1" : ".65";
        wheel.setAttribute("aria-disabled", String(!enabled));
    });
}

function handleWheelScroll(wheel) {
    if (running) return;

    updateWheelHighlight(wheel, getWheelValue(wheel));

    clearTimeout(wheelTimeouts.get(wheel));

    const timeout = setTimeout(() => {
        const selectedValue = getWheelValue(wheel);

        // Snap directly to the nearest number without animation loops.
        setWheelValue(wheel, selectedValue);

        const selectedSeconds = getPickerSeconds();

        if (selectedSeconds <= 0) {
            remaining = 0;
            total = 0;
            render();
            message.textContent = "Choose at least one second.";
            return;
        }

        saveCurrentDuration(selectedSeconds);

        remaining = selectedSeconds;
        total = selectedSeconds;

        message.textContent = "";
        render();
    }, 120);

    wheelTimeouts.set(wheel, timeout);
}


// ---------- TIMER FORMATTING AND DISPLAY ----------

function formatTime(value) {
    const safeValue = Math.max(0, Math.floor(value));
    const hours = Math.floor(safeValue / 3600);
    const minutes = Math.floor((safeValue % 3600) / 60);
    const seconds = safeValue % 60;

    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
    }

    return `${mm}:${ss}`;
}

function saveCurrentDuration(value) {
    if (mode === "focus") {
        focusDuration = value;
    } else {
        breakDuration = value;
    }
}

function getCurrentDuration() {
    return mode === "focus" ? focusDuration : breakDuration;
}

function render() {
    timerDisplay.textContent = formatTime(remaining);
    completedCount.textContent = completed;

    const percentage = total > 0
        ? Math.max(0, Math.min(1, remaining / total))
        : 0;

    progressRing.style.strokeDasharray = String(CIRCUMFERENCE);
    progressRing.style.strokeDashoffset =
        String(CIRCUMFERENCE * (1 - percentage));

    timerLabel.textContent = running
        ? (mode === "focus" ? "FOCUS IN PROGRESS" : "BREAK IN PROGRESS")
        : (mode === "focus" ? "FOCUS TIME" : "BREAK TIME");

    clockCaption.textContent = mode === "focus"
        ? "TIME TO FOCUS"
        : "TIME TO RESET";

    clockSubtitle.textContent = mode === "focus"
        ? "Make this moment count."
        : "Take a breath. You deserve it.";

    startIcon.textContent = running ? "Ⅱ" : "▶";

    startText.textContent = running
        ? "Pause"
        : remaining < total && remaining > 0
            ? "Resume"
            : mode === "focus"
                ? "Start focus"
                : "Start break";

    document.title = `${formatTime(remaining)} · Focus Timer`;
}


// ---------- START, PAUSE, RESUME, RESET ----------

function stopTimer() {
    if (timerId !== null) {
        clearInterval(timerId);
    }

    timerId = null;
    running = false;
    setWheelsEnabled(true);
}

function finishTimer() {
    stopTimer();
    remaining = 0;

    if (mode === "focus") {
        completed++;
        message.textContent = "Focus complete ✨ Time for a little break.";
    } else {
        message.textContent = "Break finished. Ready to focus again?";
    }

    render();
    playCompletionFeedback();
}

function playCompletionFeedback() {
    // Small visual cue; no sound or browser permissions required.
    document.title = "Session complete ✨ Focus Timer";
}

function tick() {
    if (remaining > 0) {
        remaining--;
    }

    render();

    if (remaining <= 0) {
        finishTimer();
    }
}

function startOrPauseTimer() {
    if (running) {
        stopTimer();
        message.textContent = "Timer paused.";
        render();
        return;
    }

    // If the previous countdown ended, prepare the saved duration.
    if (remaining <= 0) {
        const duration = getCurrentDuration();

        if (duration <= 0) {
            message.textContent = "Choose a duration first.";
            return;
        }

        remaining = duration;
        total = duration;
        setPickerFromSeconds(duration);
    } else if (remaining === total) {
        // Read the wheel selection when starting a fresh countdown.
        const selectedSeconds = getPickerSeconds();

        if (selectedSeconds <= 0) {
            message.textContent = "Choose at least one second.";
            return;
        }

        saveCurrentDuration(selectedSeconds);
        remaining = selectedSeconds;
        total = selectedSeconds;
    }

    running = true;
    message.textContent = "";
    setWheelsEnabled(false);
    render();

    timerId = setInterval(tick, 1000);
}

function resetTimer() {
    stopTimer();

    remaining = getCurrentDuration();
    total = remaining;

    setPickerFromSeconds(remaining);

    message.textContent = "Timer reset.";
    render();
}


// ---------- FOCUS AND BREAK MODES ----------

function setMode(nextMode) {
    stopTimer();

    mode = nextMode;
    remaining = getCurrentDuration();
    total = remaining;

    focusTab.classList.toggle("active", mode === "focus");
    breakTab.classList.toggle("active", mode === "break");

    setPickerFromSeconds(remaining);

    message.textContent = "";
    render();
}


// ---------- EVENT LISTENERS ----------

[hoursWheel, minutesWheel, secondsWheel].forEach(wheel => {
    wheel.addEventListener("scroll", () => {
        handleWheelScroll(wheel);
    }, { passive: true });

    // Keyboard support for accessibility.
    wheel.addEventListener("keydown", event => {
        if (running) return;

        let nextValue = getWheelValue(wheel);

        if (event.key === "ArrowUp") {
            nextValue--;
        } else if (event.key === "ArrowDown") {
            nextValue++;
        } else {
            return;
        }

        event.preventDefault();

        nextValue = Math.max(
            0,
            Math.min(nextValue, wheel.children.length - 1)
        );

        setWheelValue(wheel, nextValue);

        const selectedSeconds = getPickerSeconds();

        if (selectedSeconds > 0) {
            saveCurrentDuration(selectedSeconds);
            remaining = selectedSeconds;
            total = selectedSeconds;
            message.textContent = "";
        }

        render();
    });
});

focusTab.addEventListener("click", () => setMode("focus"));
breakTab.addEventListener("click", () => setMode("break"));

startBtn.addEventListener("click", startOrPauseTimer);
resetBtn.addEventListener("click", resetTimer);


// ---------- INITIALIZE ----------

buildWheel(hoursWheel, 99, 0);
buildWheel(minutesWheel, 59, 25);
buildWheel(secondsWheel, 59, 0);

setPickerFromSeconds(focusDuration);
render();
