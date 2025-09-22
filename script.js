const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const FLOOR_HEIGHT = 60;

let renderScale = 1;
let renderOffsetX = 0;
let renderOffsetY = 0;
let deviceScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

const nightSkySparks = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.5,
    radius: 0.8 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2
}));

const woodlandFireflies = Array.from({ length: 18 }, () => ({
    x: Math.random(),
    y: 0.55 + Math.random() * 0.4,
    drift: Math.random() * 0.6 + 0.2,
    offset: Math.random() * Math.PI * 2
}));

const GameStates = {
    LOADING: 'loading',
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_TRANSITION: 'level-transition',
    GAME_OVER: 'game-over',
    VICTORY: 'victory'
};
let gameState = GameStates.LOADING;
let lastFrameTime = performance.now();
let accumulatedTime = 0;
const frameDuration = 1000 / 60; // Fixed timestep for core updates

function resizeCanvas() {
    if (typeof window === 'undefined') {
        return;
    }

    deviceScale = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.floor(window.innerWidth * deviceScale));
    const targetHeight = Math.max(1, Math.floor(window.innerHeight * deviceScale));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
    }

    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    const scaleX = canvas.width / WORLD_WIDTH;
    const scaleY = canvas.height / WORLD_HEIGHT;

    renderScale = Math.min(scaleX, scaleY);
    renderOffsetX = (canvas.width - WORLD_WIDTH * renderScale) / 2;
    renderOffsetY = (canvas.height - WORLD_HEIGHT * renderScale) / 2;
}

if (typeof window !== 'undefined') {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
}

// Image loading
let badgerImg = new Image();
let enemyImg = new Image();
let imagesLoaded = 0;
const totalImages = 2; // Update this if you add more images

badgerImg.onload = imageLoaded;
enemyImg.onload = imageLoaded;

badgerImg.src = 'badger_sprite.png';
enemyImg.src = 'enemy_sprite.png';

function imageLoaded() {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        initializeGame();
    }
}

// Game variables
let bubbles = [];
let enemies = []; // Will populate this later

// Enemy properties
const enemyWidth = 32;
const enemyHeight = 32;
const enemySpeed = 1;
const trapDuration = 300; // Frames (approx 5 seconds at 60fps)

const EnemyTypes = {
    WALKER: 'walker',
    HOPPER: 'hopper',
    SWOOPER: 'swooper'
};

const platforms = [
    // Ground floor rendered separately by drawGround()
    // Add some platforms
    { x: 100, y: 500, width: 150, height: 20 },
    { x: 550, y: 500, width: 150, height: 20 },
    { x: 300, y: 400, width: 200, height: 20 },
    { x: 50, y: 300, width: 150, height: 20 },
    { x: 600, y: 300, width: 150, height: 20 },
    { x: 250, y: 200, width: 300, height: 20 },
];
let score = 0;
let lives = 3;
let currentLevel = 0; // Start at 0, will be set to 1 by startLevel
const maxLevels = 20;
let pendingLevel = null;
let levelTransitionTimer = 0;
let currentLevelName = '';

function resetGameVariables() {
    score = 0;
    lives = 3;
    currentLevel = 0;
    pendingLevel = null;
    levelTransitionTimer = 0;
    bubbles = [];
    enemies = [];
    powerUps = [];
    particles = [];
    screenShake = 0;
    speedBoostTimer = 0;
    bubbleBoostTimer = 0;
    fireBubbleTimer = 0;
    nextPrizeTimer = 0;
    resetBadgerPosition();
    isInvincible = false;
    invincibilityTimer = 0;
    canShoot = true;
    shootTimer = 0;
    shootCooldown = baseShootCooldown;
    badgerSpeed = baseBadgerSpeed;
    currentBubbleSpeed = baseBubbleSpeed;
    refreshAbilityStats();
    keys = {};
    comboCounter = 0;
    comboTimer = 0;
    currentLevelName = '';
    bestCombo = 0;
    scheduleNextPrize();
}

// Level configurations mix handcrafted setups with procedural generation
const levelConfigs = buildLevelConfigs();

function buildLevelConfigs() {
    const presets = [
        {
            name: 'Training Grounds',
            enemies: [
                { x: 150, y: 450, type: EnemyTypes.WALKER },
                { x: 600, y: 450, type: EnemyTypes.WALKER }
            ]
        },
        {
            name: 'Timber Bounce',
            enemies: [
                { x: 100, y: 450, type: EnemyTypes.WALKER },
                { x: 650, y: 450, type: EnemyTypes.HOPPER },
                { x: 350, y: 220, type: EnemyTypes.WALKER }
            ]
        },
        {
            name: 'Sky Swarm',
            enemies: [
                { x: 80, y: 240, type: EnemyTypes.SWOOPER },
                { x: 650, y: 240, type: EnemyTypes.SWOOPER },
                { x: 150, y: 450, type: EnemyTypes.HOPPER },
                { x: 550, y: 450, type: EnemyTypes.WALKER },
                { x: 400, y: 140, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Split Platforms',
            enemies: [
                { x: 120, y: 500, type: EnemyTypes.HOPPER },
                { x: 620, y: 500, type: EnemyTypes.HOPPER },
                { x: 310, y: 400, type: EnemyTypes.WALKER },
                { x: 500, y: 300, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Cliffside Clash',
            enemies: [
                { x: 90, y: 500, type: EnemyTypes.WALKER },
                { x: 710, y: 500, type: EnemyTypes.WALKER },
                { x: 320, y: 370, type: EnemyTypes.HOPPER },
                { x: 520, y: 370, type: EnemyTypes.HOPPER }
            ]
        },
        {
            name: 'Swoop School',
            enemies: [
                { x: 120, y: 260, type: EnemyTypes.SWOOPER },
                { x: 680, y: 260, type: EnemyTypes.SWOOPER },
                { x: 400, y: 180, type: EnemyTypes.SWOOPER },
                { x: 250, y: 470, type: EnemyTypes.HOPPER }
            ]
        },
        {
            name: 'Platform Parade',
            enemies: [
                { x: 130, y: 500, type: EnemyTypes.HOPPER },
                { x: 650, y: 500, type: EnemyTypes.WALKER },
                { x: 280, y: 400, type: EnemyTypes.WALKER },
                { x: 380, y: 400, type: EnemyTypes.HOPPER },
                { x: 620, y: 300, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Ledge Lurkers',
            enemies: [
                { x: 80, y: 300, type: EnemyTypes.WALKER },
                { x: 650, y: 300, type: EnemyTypes.WALKER },
                { x: 280, y: 200, type: EnemyTypes.HOPPER },
                { x: 520, y: 200, type: EnemyTypes.HOPPER },
                { x: 400, y: 110, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Spiral Skies',
            enemies: [
                { x: 200, y: 460, type: EnemyTypes.HOPPER },
                { x: 600, y: 460, type: EnemyTypes.HOPPER },
                { x: 150, y: 340, type: EnemyTypes.SWOOPER },
                { x: 650, y: 340, type: EnemyTypes.SWOOPER },
                { x: 400, y: 220, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Cascade Cavern',
            enemies: [
                { x: 120, y: 500, type: EnemyTypes.WALKER },
                { x: 640, y: 500, type: EnemyTypes.WALKER },
                { x: 250, y: 400, type: EnemyTypes.HOPPER },
                { x: 530, y: 400, type: EnemyTypes.HOPPER },
                { x: 360, y: 300, type: EnemyTypes.WALKER },
                { x: 460, y: 300, type: EnemyTypes.SWOOPER }
            ]
        },
        {
            name: 'Badger Blitz',
            enemies: [
                { x: 120, y: 500, type: EnemyTypes.WALKER },
                { x: 680, y: 500, type: EnemyTypes.WALKER },
                { x: 300, y: 400, type: EnemyTypes.HOPPER },
                { x: 520, y: 400, type: EnemyTypes.HOPPER },
                { x: 400, y: 300, type: EnemyTypes.SWOOPER },
                { x: 200, y: 200, type: EnemyTypes.SWOOPER },
                { x: 600, y: 200, type: EnemyTypes.SWOOPER }
            ]
        }
    ];

    while (presets.length < maxLevels) {
        const levelNumber = presets.length + 1;
        presets.push(createProceduralLevel(levelNumber));
    }

    return presets;
}

function createProceduralLevel(levelNumber) {
    const enemyCount = Math.min(4 + Math.floor(levelNumber / 2), 10);
    const enemies = [];
    for (let i = 0; i < enemyCount; i++) {
        const typeCycle = [EnemyTypes.WALKER, EnemyTypes.HOPPER, EnemyTypes.SWOOPER];
        const type = typeCycle[(levelNumber + i) % typeCycle.length];
        let x;
        let y;

        if (type === EnemyTypes.SWOOPER) {
            const lane = i % 3;
            x = 80 + lane * 240 + ((levelNumber + i) % 2 === 0 ? 0 : 40);
            y = 120 + lane * 60;
        } else {
            const platform = platforms[(i + levelNumber) % platforms.length];
            x = platform.x + 12 + ((i + levelNumber) % 2) * (platform.width - enemyWidth - 24);
            y = platform.y - enemyHeight;
        }

        enemies.push({
            x: clamp(x, 20, WORLD_WIDTH - enemyWidth - 20),
            y: clamp(y, 60, WORLD_HEIGHT - enemyHeight - 40),
            type
        });
    }

    return {
        name: `Challenge ${levelNumber}`,
        enemies
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


// Badger properties
const badgerWidth = 32;
const badgerHeight = 32;
const baseBadgerSpeed = 5;
let badgerX = WORLD_WIDTH / 2 - badgerWidth / 2;
let badgerY = WORLD_HEIGHT - badgerHeight - 10; // Start near the bottom
let badgerSpeed = baseBadgerSpeed;
let isJumping = false;
let jumpHeight = 10;
let gravity = 0.5;
let velocityY = 0;
let facingRight = true;
let isInvincible = false;
let invincibilityTimer = 0;
const invincibilityDuration = 120; // Frames (e.g., 2 seconds at 60fps)

// Bubble properties
const bubbleWidth = 20;
const bubbleHeight = 20;
const baseBubbleSpeed = 4; // Horizontal speed
let currentBubbleSpeed = baseBubbleSpeed;
const bubbleFloatSpeed = 0.5; // Vertical speed (upwards)
const bubbleLifetime = 300; // Frames before popping automatically (approx 5 seconds at 60fps)
const trappedEnemyFloatSpeed = 0.3; // How fast trapped enemies float up
let canShoot = true; // Cooldown mechanism
const baseShootCooldown = 30; // Frames (0.5 seconds at 60fps)
let shootCooldown = baseShootCooldown;
let shootTimer = 0;

const PowerUpTypes = {
    BERRY: 'berry',
    HEART: 'heart',
    CHERRY: 'cherry',
    SPEED: 'speed',
    BUBBLE: 'bubble',
    FIRE: 'fire'
};

let powerUps = [];
const maxLives = 5;
let comboCounter = 0;
let comboTimer = 0;
const comboTimeout = 120;
let bestCombo = 0;
let particles = [];
let audioContext = null;
let audioUnlocked = false;
let backgroundMusic = null;
let screenShake = 0;
let speedBoostTimer = 0;
let bubbleBoostTimer = 0;
let fireBubbleTimer = 0;
let nextPrizeTimer = 0;

// Input handling
let keys = {};

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }

    if (!keys[e.code]) {
        handleDiscreteKeyPress(e.code);
    }

    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function handlePrimaryAction() {
    if (gameState === GameStates.LOADING) {
        return false;
    }

    switch (gameState) {
        case GameStates.TITLE:
            startNewGame();
            playSound('level');
            return true;
        case GameStates.PAUSED:
            setGameState(GameStates.PLAYING);
            return true;
        case GameStates.LEVEL_TRANSITION:
            if (pendingLevel !== null) {
                startLevel(pendingLevel);
                pendingLevel = null;
                levelTransitionTimer = 0;
                setGameState(GameStates.PLAYING);
                playSound('level');
                return true;
            }
            break;
        case GameStates.GAME_OVER:
        case GameStates.VICTORY:
            setGameState(GameStates.TITLE);
            resetGameVariables();
            return true;
        default:
            break;
    }

    return false;
}

function setupTouchControls() {
    const leftJoystick = document.getElementById('left-joystick');
    const jumpButton = document.getElementById('jump-button');
    const fireButton = document.getElementById('fire-button');

    const initJoystick = (element, onMove) => {
        const knob = element.querySelector('.joystick-knob');
        if (!knob) {
            return;
        }

        const state = {
            active: false,
            identifier: null
        };

        const resetKnob = () => {
            knob.style.transition = 'transform 0.12s ease-out';
            knob.style.transform = 'translate3d(0, 0, 0)';
            onMove(0, 0, false);
        };

        const updateFromTouch = (touch) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const deltaX = touch.clientX - centerX;
            const deltaY = touch.clientY - centerY;
            const maxDistance = Math.min(rect.width, rect.height) / 2;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX);
            const clampedDistance = Math.min(distance, maxDistance);
            const clampedX = Math.cos(angle) * clampedDistance;
            const clampedY = Math.sin(angle) * clampedDistance;

            knob.style.transition = 'none';
            knob.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
            onMove(deltaX, deltaY, true);
        };

        const handleStart = (event) => {
            if (state.active) {
                return;
            }
            const touch = event.changedTouches[0];
            if (!touch) {
                return;
            }
            state.active = true;
            state.identifier = touch.identifier;
            primeAudio();
            handlePrimaryAction();
            updateFromTouch(touch);
            event.preventDefault();
        };

        const handleMove = (event) => {
            if (!state.active) {
                return;
            }
            const touch = Array.from(event.changedTouches).find(t => t.identifier === state.identifier);
            if (!touch) {
                return;
            }
            updateFromTouch(touch);
            event.preventDefault();
        };

        const handleEnd = (event) => {
            if (!state.active) {
                return;
            }
            const touch = Array.from(event.changedTouches).find(t => t.identifier === state.identifier);
            if (!touch) {
                return;
            }
            state.active = false;
            state.identifier = null;
            resetKnob();
            event.preventDefault();
        };

        element.addEventListener('touchstart', handleStart, { passive: false });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);

        resetKnob();
    };

    const movementThreshold = 16;
    if (leftJoystick) {
        initJoystick(leftJoystick, (deltaX, deltaY, isActive) => {
            if (!isActive) {
                keys['ArrowLeft'] = false;
                keys['ArrowRight'] = false;
                keys['ArrowUp'] = false;
                return;
            }

            if (Math.abs(deltaX) > movementThreshold) {
                const movingRight = deltaX > 0;
                keys['ArrowRight'] = movingRight;
                keys['ArrowLeft'] = !movingRight;
                facingRight = movingRight;
            } else {
                keys['ArrowLeft'] = false;
                keys['ArrowRight'] = false;
            }

            if (deltaY < -movementThreshold) {
                keys['ArrowUp'] = true;
            } else if (deltaY > -movementThreshold / 2) {
                keys['ArrowUp'] = false;
            }
        });
    }

    const bindActionButton = (button, key, activeClass) => {
        if (!button) {
            return;
        }

        const setActive = (isPressed) => {
            keys[key] = isPressed;
            if (activeClass) {
                button.classList.toggle(activeClass, isPressed);
            }
        };

        const press = (event) => {
            primeAudio();
            handlePrimaryAction();
            setActive(true);
            event.preventDefault();
            event.stopPropagation();
        };

        const release = () => {
            setActive(false);
        };

        const cancel = (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            release();
        };

        if (window.PointerEvent) {
            button.addEventListener('pointerdown', press);
            button.addEventListener('pointerup', cancel);
            button.addEventListener('pointercancel', cancel);
            button.addEventListener('pointerleave', cancel);
            window.addEventListener('pointerup', release);
            window.addEventListener('pointercancel', release);
        } else {
            button.addEventListener('touchstart', press, { passive: false });
            button.addEventListener('touchend', cancel);
            button.addEventListener('touchcancel', cancel);
            button.addEventListener('mousedown', press);
            window.addEventListener('mouseup', release);
            window.addEventListener('touchend', release);
            window.addEventListener('touchcancel', release);
        }
    };

    bindActionButton(jumpButton, 'ArrowUp', 'is-active');
    bindActionButton(fireButton, 'KeyZ', 'is-active');
}

if ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)) {
    setupTouchControls();
}

function handleDiscreteKeyPress(code) {
    if (gameState === GameStates.LOADING) {
        return;
    }

    primeAudio();

    if (code === 'Enter' || code === 'Space') {
        if (handlePrimaryAction()) {
            return;
        }
    }

    if (code === 'Escape' || code === 'KeyP') {
        if (gameState === GameStates.PLAYING) {
            setGameState(GameStates.PAUSED);
            return;
        }
        if (gameState === GameStates.PAUSED) {
            setGameState(GameStates.PLAYING);
            return;
        }
    }

    switch (gameState) {
        case GameStates.PAUSED:
            if (code === 'KeyR') {
                startNewGame();
                playSound('level');
            }
            break;
        default:
            break;
    }
}

const handlePrimaryPointer = (event) => {
    primeAudio();
    if (handlePrimaryAction()) {
        event.preventDefault();
    }
};

if (typeof window !== 'undefined') {
    if (window.PointerEvent) {
        canvas.addEventListener('pointerdown', handlePrimaryPointer);
    } else {
        canvas.addEventListener('touchstart', handlePrimaryPointer, { passive: false });
        canvas.addEventListener('mousedown', handlePrimaryPointer);
    }
}

const backgroundChordProgression = [
    [196.0, 246.94, 293.66], // G major warmth
    [174.61, 220.0, 261.63], // F major hush
    [220.0, 261.63, 329.63], // A minor drift
    [196.0, 233.08, 293.66], // Gsus shimmer
    [174.61, 220.0, 293.66], // D minor return
];
const backgroundMusicTargetGain = 0.16;
const backgroundChordDurationMs = 16000;
const backgroundArpeggioPatternDegrees = [0, 2, 4, 7, 4, 2, 5, 9];
const backgroundArpeggioStepMs = 420;
const backgroundArpeggioLevel = 0.12;
const backgroundPercussionIntervalMs = 3600;
const backgroundPercussionLevel = 0.08;

function setBackgroundChord(index, rampTime = 10) {
    if (!backgroundMusic) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }

    const chord = backgroundChordProgression[index % backgroundChordProgression.length];
    const now = ctx.currentTime;
    backgroundMusic.voices.forEach((voice, voiceIndex) => {
        const destination = chord[voiceIndex % chord.length];
        const frequencyParam = voice.osc.frequency;
        frequencyParam.cancelScheduledValues(now);
        frequencyParam.setValueAtTime(frequencyParam.value, now);
        frequencyParam.linearRampToValueAtTime(destination, now + rampTime);
    });
    if (backgroundMusic.arpeggio && backgroundMusic.arpeggio.filter) {
        const arpFilter = backgroundMusic.arpeggio.filter.frequency;
        arpFilter.cancelScheduledValues(now);
        arpFilter.setValueAtTime(arpFilter.value, now);
        arpFilter.linearRampToValueAtTime(Math.max(700, chord[0] * 4), now + rampTime);
        backgroundMusic.arpeggio.stepIndex = 0;
    }
    if (backgroundMusic.percussion && backgroundMusic.percussion.filter) {
        const percFilter = backgroundMusic.percussion.filter.frequency;
        percFilter.cancelScheduledValues(now);
        percFilter.setValueAtTime(percFilter.value, now);
        percFilter.linearRampToValueAtTime(Math.min(2600, chord[0] * 6), now + rampTime);
    }
}

function startBackgroundMusic() {
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }

    if (backgroundMusic) {
        const now = ctx.currentTime;
        backgroundMusic.masterGain.gain.cancelScheduledValues(now);
        backgroundMusic.masterGain.gain.setValueAtTime(backgroundMusic.masterGain.gain.value, now);
        backgroundMusic.masterGain.gain.linearRampToValueAtTime(backgroundMusicTargetGain, now + 2);
        if (backgroundMusic.arpeggio) {
            const arpGain = backgroundMusic.arpeggio.gain.gain;
            arpGain.cancelScheduledValues(now);
            arpGain.setValueAtTime(arpGain.value || 0.0001, now);
            arpGain.linearRampToValueAtTime(backgroundMusic.arpeggio.level, now + 2);
        }
        if (backgroundMusic.percussion) {
            const percGain = backgroundMusic.percussion.gain.gain;
            percGain.cancelScheduledValues(now);
            percGain.setValueAtTime(percGain.value || 0.0001, now);
            percGain.linearRampToValueAtTime(backgroundPercussionLevel, now + 2.5);
        }
        return;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const voices = backgroundChordProgression[0].map((frequency, index) => {
        const osc = ctx.createOscillator();
        osc.type = index === 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, ctx.currentTime);
        filter.Q.value = 0.6;

        const voiceGain = ctx.createGain();
        const baseGain = index === 0 ? 0.28 : index === 1 ? 0.24 : 0.18;
        voiceGain.gain.setValueAtTime(baseGain, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.05 + index * 0.02, ctx.currentTime);

        const lfoDepth = ctx.createGain();
        lfoDepth.gain.setValueAtTime(baseGain * 0.45, ctx.currentTime);
        lfo.connect(lfoDepth).connect(voiceGain.gain);

        osc.connect(filter).connect(voiceGain).connect(masterGain);

        osc.start();
        lfo.start();

        return { osc, voiceGain, lfo };
    });

    const arpeggioOsc = ctx.createOscillator();
    arpeggioOsc.type = 'sawtooth';
    arpeggioOsc.frequency.setValueAtTime(backgroundChordProgression[0][0], ctx.currentTime);

    const arpeggioFilter = ctx.createBiquadFilter();
    arpeggioFilter.type = 'bandpass';
    arpeggioFilter.frequency.setValueAtTime(1400, ctx.currentTime);
    arpeggioFilter.Q.value = 4;

    const arpeggioGain = ctx.createGain();
    arpeggioGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    arpeggioOsc.connect(arpeggioFilter).connect(arpeggioGain).connect(masterGain);
    arpeggioOsc.start();

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(700, ctx.currentTime);
    noiseFilter.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.02, ctx.currentTime);

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noiseSource.start();

    const percussionBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
    const percussionData = percussionBuffer.getChannelData(0);
    for (let i = 0; i < percussionData.length; i++) {
        const progress = i / percussionData.length;
        const envelope = Math.pow(1 - progress, 2.4);
        const sparkle = Math.sin(progress * Math.PI * 16) * 0.3;
        percussionData[i] = ((Math.random() * 2 - 1) * 0.7 + sparkle) * envelope;
    }

    const percussionFilter = ctx.createBiquadFilter();
    percussionFilter.type = 'highpass';
    percussionFilter.frequency.setValueAtTime(900, ctx.currentTime);
    percussionFilter.Q.value = 0.8;

    const percussionGain = ctx.createGain();
    percussionGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    percussionFilter.connect(percussionGain).connect(masterGain);

    backgroundMusic = {
        masterGain,
        voices,
        noiseSource,
        chordIndex: 0,
        intervalId: null,
        arpeggio: {
            osc: arpeggioOsc,
            gain: arpeggioGain,
            filter: arpeggioFilter,
            level: backgroundArpeggioLevel,
            stepIndex: 0,
            intervalId: null,
        },
        percussion: {
            buffer: percussionBuffer,
            filter: percussionFilter,
            gain: percussionGain,
            intervalId: null,
        },
    };

    const now = ctx.currentTime;
    masterGain.gain.linearRampToValueAtTime(backgroundMusicTargetGain, now + 8);
    arpeggioGain.gain.linearRampToValueAtTime(backgroundArpeggioLevel, now + 4);
    percussionGain.gain.linearRampToValueAtTime(backgroundPercussionLevel, now + 6);

    backgroundMusic.intervalId = setInterval(() => {
        if (!backgroundMusic) {
            return;
        }
        backgroundMusic.chordIndex = (backgroundMusic.chordIndex + 1) % backgroundChordProgression.length;
        setBackgroundChord(backgroundMusic.chordIndex);
    }, backgroundChordDurationMs);

    scheduleArpeggioStep();
    backgroundMusic.arpeggio.intervalId = setInterval(scheduleArpeggioStep, backgroundArpeggioStepMs);
    triggerPercussionAccent();
    backgroundMusic.percussion.intervalId = setInterval(triggerPercussionAccent, backgroundPercussionIntervalMs);
}

function transposeFrequency(baseFrequency, semitoneOffset) {
    return baseFrequency * Math.pow(2, semitoneOffset / 12);
}

function chordUsesMinorThird(chord) {
    const ratio = chord[1] / chord[0];
    return ratio < 1.24;
}

function arpeggioFrequencyForStep(chord, stepIndex) {
    const majorScale = [0, 2, 4, 5, 7, 9, 11];
    const minorScale = [0, 2, 3, 5, 7, 8, 10];
    const scale = chordUsesMinorThird(chord) ? minorScale : majorScale;
    const degree = backgroundArpeggioPatternDegrees[stepIndex % backgroundArpeggioPatternDegrees.length];
    const octave = Math.floor(degree / scale.length);
    const scaleIndex = degree % scale.length;
    const semitoneOffset = scale[scaleIndex] + octave * 12;
    return transposeFrequency(chord[0], semitoneOffset);
}

function scheduleArpeggioStep() {
    if (!backgroundMusic || !backgroundMusic.arpeggio) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }
    const chord = backgroundChordProgression[backgroundMusic.chordIndex];
    const now = ctx.currentTime + 0.05;
    const arpeggio = backgroundMusic.arpeggio;
    const freq = arpeggioFrequencyForStep(chord, arpeggio.stepIndex);
    arpeggio.osc.frequency.setValueAtTime(freq, now);

    const gainParam = arpeggio.gain.gain;
    gainParam.cancelScheduledValues(now - 0.1);
    gainParam.setValueAtTime(0.0001, now);
    gainParam.linearRampToValueAtTime(arpeggio.level, now + 0.04);
    gainParam.exponentialRampToValueAtTime(0.0001, now + 0.36);

    arpeggio.stepIndex = (arpeggio.stepIndex + 1) % backgroundArpeggioPatternDegrees.length;
}

function triggerPercussionAccent() {
    if (!backgroundMusic || !backgroundMusic.percussion) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }
    const now = ctx.currentTime + 0.05;
    const percussion = backgroundMusic.percussion;

    const source = ctx.createBufferSource();
    source.buffer = percussion.buffer;
    source.playbackRate.setValueAtTime(0.9 + Math.random() * 0.2, now);

    const accentGain = ctx.createGain();
    accentGain.gain.setValueAtTime(0.0001, now);
    accentGain.linearRampToValueAtTime(1, now + 0.02);
    accentGain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    source.connect(accentGain).connect(percussion.filter);

    source.start(now);
    source.stop(now + 0.6);
}

function ensureAudioContext() {
    if (typeof window === 'undefined') {
        return null;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        return null;
    }
    if (!audioContext) {
        audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function primeAudio() {
    if (audioUnlocked) {
        ensureAudioContext();
        startBackgroundMusic();
        return;
    }
    const ctx = ensureAudioContext();
    if (ctx) {
        audioUnlocked = true;
        startBackgroundMusic();
    }
}

function playSound(name) {
    if (!audioUnlocked) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }
    const now = ctx.currentTime;

    switch (name) {
        case 'shoot':
            playTone(ctx, { start: now, frequency: 680, duration: 0.12, volume: 0.18, type: 'square', sweep: 0.6 });
            break;
        case 'pop':
            playTone(ctx, { start: now, frequency: 420, duration: 0.18, volume: 0.22, type: 'triangle', sweep: 0.5 });
            break;
        case 'powerup':
            playTone(ctx, { start: now, frequency: 540, duration: 0.18, volume: 0.18, type: 'sine' });
            playTone(ctx, { start: now + 0.18, frequency: 810, duration: 0.22, volume: 0.16, type: 'sine' });
            break;
        case 'hurt':
            playTone(ctx, { start: now, frequency: 220, duration: 0.35, volume: 0.24, type: 'sawtooth', sweep: 0.4 });
            break;
        case 'combo':
            playTone(ctx, { start: now, frequency: 520, duration: 0.1, volume: 0.2, type: 'square' });
            playTone(ctx, { start: now + 0.1, frequency: 760, duration: 0.1, volume: 0.15, type: 'square' });
            break;
        case 'level':
            playTone(ctx, { start: now, frequency: 320, duration: 0.16, volume: 0.18, type: 'sine' });
            playTone(ctx, { start: now + 0.16, frequency: 420, duration: 0.18, volume: 0.16, type: 'sine' });
            break;
        default:
            break;
    }
}

function playTone(ctx, { start, frequency, duration, volume = 0.2, type = 'sine', sweep }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (sweep && sweep > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * sweep), start + duration);
    }
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
}

function refreshAbilityStats() {
    badgerSpeed = baseBadgerSpeed * (speedBoostTimer > 0 ? 1.6 : 1);
    currentBubbleSpeed = baseBubbleSpeed * (bubbleBoostTimer > 0 ? 1.75 : 1);
    shootCooldown = bubbleBoostTimer > 0 ? Math.max(12, Math.round(baseShootCooldown * 0.6)) : baseShootCooldown;
}

function updateAbilityTimers() {
    let needsRefresh = false;

    if (speedBoostTimer > 0) {
        speedBoostTimer--;
        if (speedBoostTimer === 0) {
            needsRefresh = true;
        }
    }

    if (bubbleBoostTimer > 0) {
        bubbleBoostTimer--;
        if (bubbleBoostTimer === 0) {
            needsRefresh = true;
        }
    }

    if (fireBubbleTimer > 0) {
        fireBubbleTimer--;
    }

    if (needsRefresh) {
        refreshAbilityStats();
    }
}

function scheduleNextPrize() {
    const minSeconds = 10;
    const maxSeconds = 18;
    const delaySeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
    nextPrizeTimer = Math.round(delaySeconds * 60);
}

function updatePrizeTimer() {
    if (nextPrizeTimer <= 0) {
        return;
    }

    nextPrizeTimer--;
    if (nextPrizeTimer <= 0) {
        spawnRandomPrize();
    }
}

function spawnRandomPrize() {
    const maxPrizes = 2;
    const currentPrizes = powerUps.filter(item => item.isPrize).length;
    if (currentPrizes >= maxPrizes) {
        scheduleNextPrize();
        return;
    }

    const prizeTypes = [PowerUpTypes.CHERRY, PowerUpTypes.SPEED, PowerUpTypes.BUBBLE, PowerUpTypes.FIRE];
    const type = prizeTypes[Math.floor(Math.random() * prizeTypes.length)];

    const groundTop = WORLD_HEIGHT - FLOOR_HEIGHT;
    const groundSpot = { x: 20, y: groundTop, width: WORLD_WIDTH - 40, height: FLOOR_HEIGHT };
    const spawnSpots = [...platforms, groundSpot];
    const spot = spawnSpots[Math.floor(Math.random() * spawnSpots.length)];
    const minX = spot.x + 30;
    const maxX = spot.x + Math.max(spot.width - 30, 60);
    const spawnX = clamp(minX + Math.random() * (maxX - minX), 30, WORLD_WIDTH - 30);
    const spawnY = spot === groundSpot ? groundTop - 40 : spot.y - 26;

    powerUps.push(new PowerUp(spawnX, spawnY, type, { isPrize: true, life: 60 * 12 }));
    scheduleNextPrize();
}

function drawGround() {
    const groundTop = WORLD_HEIGHT - FLOOR_HEIGHT;

    const groundGradient = ctx.createLinearGradient(0, groundTop, 0, WORLD_HEIGHT);
    groundGradient.addColorStop(0, '#3b2a1a');
    groundGradient.addColorStop(0.45, '#5e3c1f');
    groundGradient.addColorStop(1, '#27160b');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, groundTop, WORLD_WIDTH, FLOOR_HEIGHT);

    const highlightGradient = ctx.createLinearGradient(0, groundTop, 0, groundTop + 12);
    highlightGradient.addColorStop(0, 'rgba(255, 245, 215, 0.35)');
    highlightGradient.addColorStop(1, 'rgba(255, 245, 215, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(0, groundTop, WORLD_WIDTH, 12);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, WORLD_HEIGHT - 6, WORLD_WIDTH, 6);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < WORLD_WIDTH; x += 48) {
        ctx.fillRect(x + 12, WORLD_HEIGHT - 18, 26, 6);
    }
}

function drawBadger() {
    drawBadgerSprite({
        x: badgerX,
        y: badgerY,
        width: badgerWidth,
        height: badgerHeight,
        facingRight,
        isInvincible
    });
}

// Enemy class
class Enemy {
    constructor(x, y, type = EnemyTypes.WALKER) {
        this.x = x;
        this.y = y;
        this.width = enemyWidth;
        this.height = enemyHeight;
        this.type = type;
        this.speedX = enemySpeed * (Math.random() < 0.5 ? 1 : -1);
        this.speedY = 0;
        this.gravity = type === EnemyTypes.SWOOPER ? 0 : 0.5;
        this.state = 'moving';
        this.onPlatform = false;
        this.trapTimer = 0;
        this.behaviorTimer = Math.floor(Math.random() * 180) + 60;
        this.oscillationPhase = Math.random() * Math.PI * 2;
        this.baseY = y;
        this.facing = this.speedX >= 0 ? 1 : -1;

        if (this.type === EnemyTypes.HOPPER) {
            this.speedX *= 1.4;
            this.facing = this.speedX >= 0 ? 1 : -1;
        } else if (this.type === EnemyTypes.SWOOPER) {
            this.speedX *= 2;
            this.facing = this.speedX >= 0 ? 1 : -1;
        }
    }

    update() {
        if (this.state === 'trapped') {
            this.updateTrapped();
            return;
        }

        if (this.type === EnemyTypes.SWOOPER) {
            this.updateSwooperMovement();
        } else {
            this.updateGroundMovement();
            if (this.type === EnemyTypes.HOPPER) {
                this.updateHopperMovement();
            }
        }
    }

    updateTrapped() {
        this.y -= trappedEnemyFloatSpeed;
        this.speedX = 0;
        this.speedY = 0;
        if (this.y <= 0) {
            this.y = 0;
        }
        this.trapTimer--;
        if (this.trapTimer <= 0) {
            this.escape();
        }
    }

    updateGroundMovement() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.onPlatform = false;

        if (this.y + this.height >= WORLD_HEIGHT) {
            this.y = WORLD_HEIGHT - this.height;
            this.speedY = 0;
            this.onPlatform = true;
        }

        for (const platform of platforms) {
            if (
                this.speedY > 0 &&
                this.x + this.width > platform.x &&
                this.x < platform.x + platform.width &&
                this.y + this.height >= platform.y &&
                this.y + this.height - this.speedY <= platform.y
            ) {
                this.y = platform.y - this.height;
                this.speedY = 0;
                this.onPlatform = true;
            }
        }

        if (this.x <= 0 && this.speedX < 0) {
            this.x = 0;
            this.speedX *= -1;
            this.updateFacingFromSpeed();
        } else if (this.x + this.width >= WORLD_WIDTH && this.speedX > 0) {
            this.x = WORLD_WIDTH - this.width;
            this.speedX *= -1;
            this.updateFacingFromSpeed();
        }

        if (this.onPlatform && this.y < WORLD_HEIGHT - this.height) {
            let standingPlatform = null;
            for (const platform of platforms) {
                if (
                    Math.abs(this.y + this.height - platform.y) < 1 &&
                    this.x + this.width > platform.x &&
                    this.x < platform.x + platform.width
                ) {
                    standingPlatform = platform;
                    break;
                }
            }

            if (standingPlatform) {
                if (this.speedX > 0 && this.x + this.width + this.speedX > standingPlatform.x + standingPlatform.width) {
                    this.x = standingPlatform.x + standingPlatform.width - this.width;
                    this.speedX *= -1;
                    this.updateFacingFromSpeed();
                } else if (this.speedX < 0 && this.x + this.speedX < standingPlatform.x) {
                    this.x = standingPlatform.x;
                    this.speedX *= -1;
                    this.updateFacingFromSpeed();
                }
            }
        }
    }

    updateHopperMovement() {
        this.behaviorTimer--;
        if (this.behaviorTimer <= 0 && this.onPlatform) {
            this.speedY = -11;
            this.speedX = clamp(this.speedX * 1.3, -2.5, 2.5);
            this.updateFacingFromSpeed();
            this.behaviorTimer = Math.floor(Math.random() * 150) + 90;
        }
    }

    updateSwooperMovement() {
        const targetX = badgerX + badgerWidth / 2;
        const centerX = this.x + this.width / 2;
        const direction = targetX > centerX ? 1 : -1;
        this.speedX += 0.05 * direction;
        this.speedX = clamp(this.speedX, -3, 3);
        this.x += this.speedX * 1.5;
        if (Math.abs(this.speedX) > 0.1) {
            this.facing = this.speedX > 0 ? 1 : -1;
        }

        this.oscillationPhase += 0.05;
        const amplitude = 60;
        const desiredY = this.baseY + Math.sin(this.oscillationPhase) * amplitude;
        this.y += (desiredY - this.y) * 0.12;

        this.behaviorTimer--;
        if (this.behaviorTimer <= 0) {
            this.speedY = 6;
            this.behaviorTimer = Math.floor(Math.random() * 180) + 120;
        }

        if (this.speedY !== 0) {
            this.y += this.speedY;
            this.speedY *= 0.9;
            if (Math.abs(this.speedY) < 0.3) {
                this.speedY = 0;
                this.baseY = clamp(this.y, 80, WORLD_HEIGHT - this.height - 120);
            }
        }

        if (this.x <= 0) {
            this.x = 0;
            this.speedX = Math.abs(this.speedX);
            this.facing = 1;
        } else if (this.x + this.width >= WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.speedX = -Math.abs(this.speedX);
            this.facing = -1;
        }

        this.y = clamp(this.y, 60, WORLD_HEIGHT - this.height - 120);
    }

    trap() {
        this.state = 'trapped';
        this.speedX = 0;
        this.speedY = 0;
        this.trapTimer = trapDuration;
    }

    escape() {
        this.state = 'moving';
        this.speedY = 0;
        this.speedX = enemySpeed * (Math.random() < 0.5 ? 1 : -1);
        this.updateFacingFromSpeed();
        this.behaviorTimer = Math.floor(Math.random() * 120) + 60;
        if (this.type === EnemyTypes.SWOOPER) {
            this.baseY = clamp(this.y, 80, WORLD_HEIGHT - this.height - 120);
        }
    }

    draw() {
        drawEnemySprite(this);
    }

    updateFacingFromSpeed() {
        if (this.speedX > 0) {
            this.facing = 1;
        } else if (this.speedX < 0) {
            this.facing = -1;
        }
    }
}


// Bubble class/structure
class Bubble {
    constructor(x, y, direction, options = {}) {
        this.x = x;
        this.y = y;
        this.width = bubbleWidth;
        this.height = bubbleHeight;
        const speed = options.speed ?? currentBubbleSpeed;
        this.speedX = direction * speed; // direction is 1 for right, -1 for left
        this.speedY = -bubbleFloatSpeed; // Bubbles float upwards
        this.life = bubbleLifetime;
        this.state = 'moving'; // 'moving', 'trapping', 'popping' (future use)
        this.isFire = options.isFire ?? false;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;

        // Basic wall bouncing (optional, can be refined)
        if (this.x <= 0 || this.x + this.width >= WORLD_WIDTH) {
            this.speedX *= -1;
        }
        // Stop floating up at the top
        if (this.y <= 0) {
             this.y = 0;
             this.speedY = 0; // Stop vertical movement
             // Optionally change state or behavior here
        }
    }

    draw() {
        if (this.isFire) {
            ctx.fillStyle = 'rgba(255, 140, 0, 0.8)';
            ctx.strokeStyle = '#ff7043';
        } else {
            ctx.fillStyle = 'rgba(173, 216, 230, 0.7)'; // Light blue, semi-transparent
            ctx.strokeStyle = 'blue';
        }
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

class PowerUp {
    constructor(x, y, type, options = {}) {
        this.type = type;
        this.width = 24;
        this.height = 24;
        this.x = x - this.width / 2;
        this.y = y - this.height / 2;
        this.baseY = this.y;
        this.life = options.life ?? 60 * 10; // ~10 seconds
        this.floatPhase = Math.random() * Math.PI * 2;
        this.floatMagnitude = options.floatMagnitude ?? (options.isPrize ? 8 : 5);
        this.isPrize = options.isPrize ?? false;
    }

    update() {
        this.floatPhase += 0.08;
        this.y = this.baseY + Math.sin(this.floatPhase) * this.floatMagnitude;
        this.life--;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 6;

        switch (this.type) {
            case PowerUpTypes.HEART:
                ctx.fillStyle = '#ff5c7a';
                ctx.beginPath();
                ctx.moveTo(0, 6);
                ctx.bezierCurveTo(12, -8, 20, 6, 0, 20);
                ctx.bezierCurveTo(-20, 6, -12, -8, 0, 6);
                ctx.fill();
                break;
            case PowerUpTypes.BERRY:
                ctx.fillStyle = '#7b61ff';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#cdbbff';
                ctx.beginPath();
                ctx.arc(-3, -3, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            case PowerUpTypes.CHERRY:
                drawCherryIcon(ctx);
                break;
            case PowerUpTypes.SPEED:
                drawSpeedIcon(ctx);
                break;
            case PowerUpTypes.BUBBLE:
                drawBubbleBoostIcon(ctx);
                break;
            case PowerUpTypes.FIRE:
                drawFireIcon(ctx);
                break;
            default:
                ctx.fillStyle = '#7b61ff';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        ctx.restore();
    }
}

function drawCherryIcon(ctx) {
    ctx.fillStyle = '#ff4c6d';
    ctx.beginPath();
    ctx.arc(-6, 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2d9f52';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(0, -18, 8, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-10, -16, -10, -2);
    ctx.stroke();
}

function drawSpeedIcon(ctx) {
    ctx.fillStyle = '#00b8ff';
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.lineTo(4, -10);
    ctx.lineTo(4, -2);
    ctx.lineTo(12, -2);
    ctx.lineTo(-4, 10);
    ctx.lineTo(-4, 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(2, -6);
    ctx.lineTo(2, 0);
    ctx.stroke();
}

function drawBubbleBoostIcon(ctx) {
    const gradient = ctx.createRadialGradient(-2, -2, 2, 0, 0, 12);
    gradient.addColorStop(0, 'rgba(173, 216, 230, 0.95)');
    gradient.addColorStop(1, 'rgba(110, 160, 255, 0.95)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4f7cff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, Math.PI * 0.15, Math.PI * 1.15);
    ctx.stroke();

    ctx.strokeStyle = '#d9ecff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(0, 8, 4, 4);
    ctx.stroke();
}

function drawFireIcon(ctx) {
    const gradient = ctx.createLinearGradient(0, -12, 0, 12);
    gradient.addColorStop(0, '#ffe082');
    gradient.addColorStop(0.4, '#ffab40');
    gradient.addColorStop(1, '#ff5722');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(10, -4, 4, 12);
    ctx.quadraticCurveTo(0, 6, -4, 12);
    ctx.quadraticCurveTo(-10, -2, 0, -12);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(4, -2, 2, 6);
    ctx.quadraticCurveTo(0, 2, -2, 6);
    ctx.quadraticCurveTo(-4, 0, 0, -8);
    ctx.fill();
}

class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx ?? (Math.random() - 0.5) * 3;
        this.vy = options.vy ?? (Math.random() - 0.5) * 3;
        this.size = options.size ?? 4;
        this.life = options.life ?? 40;
        this.maxLife = this.life;
        this.color = options.color ?? 'rgba(255, 255, 255, 0.9)';
        this.gravity = options.gravity ?? 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life--;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function shootBubble() {
    const direction = facingRight ? 1 : -1;
    // Start bubble slightly in front of the badger
    const bubbleStartX = facingRight ? badgerX + badgerWidth : badgerX - bubbleWidth;
    const bubbleStartY = badgerY + badgerHeight / 2 - bubbleHeight / 2;
    const bubbleOptions = {
        speed: currentBubbleSpeed,
        isFire: fireBubbleTimer > 0
    };
    bubbles.push(new Bubble(bubbleStartX, bubbleStartY, direction, bubbleOptions));

    const particleColor = bubbleOptions.isFire ? 'rgba(255, 140, 0, 0.8)' : 'rgba(173, 216, 230, 0.7)';
    for (let i = 0; i < 4; i++) {
        particles.push(new Particle(bubbleStartX, bubbleStartY + bubbleHeight / 2, {
            vx: direction * (1.2 + Math.random() * 0.6),
            vy: (Math.random() - 0.5) * 1.2,
            size: 1.6,
            life: 22,
            color: particleColor
        }));
    }
}


function handleInput() {
    if (gameState !== GameStates.PLAYING) {
        return;
    }

    // Move left
    if (keys['ArrowLeft'] || keys['KeyA']) {
        badgerX -= badgerSpeed;
        facingRight = false;
    }
    // Move right
    if (keys['ArrowRight'] || keys['KeyD']) {
        badgerX += badgerSpeed;
        facingRight = true;
    }
    // Jump
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && !isJumping) {
        isJumping = true;
        velocityY = -jumpHeight;
    }
    // Shoot bubble
    if ((keys['KeyZ'] || keys['KeyJ']) && canShoot) {
        shootBubble();
        canShoot = false;
        shootTimer = shootCooldown;
        playSound('shoot');
        // shootTimer is reset in updateGame
    }

    // Keep badger within canvas bounds
    if (badgerX < 0) {
        badgerX = 0;
    }
    if (badgerX + badgerWidth > WORLD_WIDTH) {
        badgerX = WORLD_WIDTH - badgerWidth;
    }
}

function updateGame() {
    let onPlatform = false;

    badgerY += velocityY;
    velocityY += gravity;

    if (badgerY + badgerHeight >= WORLD_HEIGHT) {
        badgerY = WORLD_HEIGHT - badgerHeight;
        isJumping = false;
        velocityY = 0;
        onPlatform = true;
    }

    for (const platform of platforms) {
        if (
            velocityY > 0 &&
            badgerX + badgerWidth > platform.x &&
            badgerX < platform.x + platform.width &&
            badgerY + badgerHeight >= platform.y &&
            badgerY + badgerHeight - velocityY <= platform.y
        ) {
            badgerY = platform.y - badgerHeight;
            isJumping = false;
            velocityY = 0;
            onPlatform = true;
        }

        if (
            velocityY < 0 &&
            badgerX + badgerWidth > platform.x &&
            badgerX < platform.x + platform.width &&
            badgerY <= platform.y + platform.height &&
            badgerY - velocityY >= platform.y + platform.height
        ) {
            velocityY = 0;
            badgerY = platform.y + platform.height;
        }
    }

    if (!onPlatform && badgerY + badgerHeight < WORLD_HEIGHT) {
        isJumping = true;
    }

    updateAbilityTimers();
    updatePrizeTimer();

    if (isInvincible) {
        invincibilityTimer--;
        if (invincibilityTimer <= 0) {
            isInvincible = false;
        }
    }

    if (!canShoot) {
        shootTimer--;
        if (shootTimer <= 0) {
            canShoot = true;
        }
    }

    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0) {
            comboCounter = 0;
        }
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.update();
        if (bubble.life <= 0) {
            bubbles.splice(i, 1);
        }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
        const item = powerUps[i];
        item.update();

        if (item.life <= 0) {
            powerUps.splice(i, 1);
            continue;
        }

        if (rectsOverlap(badgerX, badgerY, badgerWidth, badgerHeight, item.x, item.y, item.width, item.height)) {
            spawnParticles(item.x + item.width / 2, item.y + item.height / 2, 'power');
            applyPowerUp(item.type);
            powerUps.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }

    let badgerHit = false;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();

        if (enemy.state === 'moving') {
            let enemyRemoved = false;
            for (let j = bubbles.length - 1; j >= 0; j--) {
                const bubble = bubbles[j];
                if (rectsOverlap(bubble.x, bubble.y, bubble.width, bubble.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
                    if (bubble.isFire) {
                        const centerX = enemy.x + enemy.width / 2;
                        const centerY = enemy.y + enemy.height / 2;
                        spawnParticles(centerX, centerY, 'fire');
                        bubbles.splice(j, 1);
                        enemies.splice(i, 1);
                        score += 150;
                        screenShake = Math.max(screenShake, 5);
                        playSound('pop');
                        enemyRemoved = true;
                    } else {
                        enemy.trap();
                        bubbles.splice(j, 1);
                    }
                    break;
                }
            }

            if (enemyRemoved) {
                continue;
            }
        }

        if (enemy.state === 'trapped') {
            if (rectsOverlap(badgerX, badgerY, badgerWidth, badgerHeight, enemy.x, enemy.y, enemy.width, enemy.height)) {
                enemies.splice(i, 1);
                comboCounter++;
                comboTimer = comboTimeout;
                bestCombo = Math.max(bestCombo, comboCounter);
                const comboBonus = (comboCounter - 1) * 50;
                score += 100 + comboBonus;
                if (comboCounter === 2) {
                    playSound('combo');
                }
                playSound('pop');
                screenShake = Math.max(screenShake, 4);
                spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'pop');
                maybeSpawnPowerUp(enemy.x, enemy.y);
                continue;
            }
        } else if (!isInvincible && enemy.state === 'moving') {
            if (rectsOverlap(badgerX, badgerY, badgerWidth, badgerHeight, enemy.x, enemy.y, enemy.width, enemy.height)) {
                badgerHit = true;
            }
        }
    }

    if (badgerHit) {
        spawnParticles(badgerX + badgerWidth / 2, badgerY + badgerHeight / 2, 'hit');
        handleBadgerHit();
    }

    if (enemies.length === 0 && currentLevel > 0 && pendingLevel === null && gameState === GameStates.PLAYING) {
        if (currentLevel >= maxLevels) {
            pendingLevel = null;
            levelTransitionTimer = 0;
            playSound('powerup');
            setGameState(GameStates.VICTORY);
        } else {
            queueNextLevel(currentLevel + 1);
        }
    }
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function handleBadgerHit() {
    comboCounter = 0;
    comboTimer = 0;
    screenShake = Math.max(screenShake, 12);
    lives--;
    if (lives <= 0) {
        pendingLevel = null;
        levelTransitionTimer = 0;
        resetBadgerPosition();
        playSound('hurt');
        setGameState(GameStates.GAME_OVER);
        return;
    }

    resetBadgerPosition();
    isInvincible = true;
    invincibilityTimer = invincibilityDuration;
    playSound('hurt');
}

function applyPowerUp(type) {
    switch (type) {
        case PowerUpTypes.HEART:
            if (lives < maxLives) {
                lives++;
            } else {
                score += 250;
            }
            isInvincible = true;
            invincibilityTimer = invincibilityDuration;
            playSound('powerup');
            return;
        case PowerUpTypes.BERRY:
            score += 200;
            comboCounter = Math.max(comboCounter, 1);
            comboTimer = comboTimeout;
            playSound('powerup');
            return;
        case PowerUpTypes.CHERRY:
            score += 500;
            comboCounter = Math.max(comboCounter, 2);
            comboTimer = comboTimeout;
            playSound('powerup');
            return;
        case PowerUpTypes.SPEED:
            score += 100;
            speedBoostTimer = 60 * 8;
            refreshAbilityStats();
            playSound('powerup');
            return;
        case PowerUpTypes.BUBBLE:
            score += 100;
            bubbleBoostTimer = 60 * 8;
            refreshAbilityStats();
            shootTimer = Math.min(shootTimer, shootCooldown);
            playSound('powerup');
            return;
        case PowerUpTypes.FIRE:
            score += 150;
            fireBubbleTimer = 60 * 6;
            playSound('powerup');
            return;
        default:
            score += 150;
            playSound('powerup');
            return;
    }
}

function resetBadgerPosition() {
    badgerX = WORLD_WIDTH / 2 - badgerWidth / 2;
    badgerY = WORLD_HEIGHT - badgerHeight - 10;
    velocityY = 0;
    isJumping = false;
    facingRight = true;
}

function queueNextLevel(levelNumber) {
    pendingLevel = levelNumber;
    levelTransitionTimer = Math.round(60 * 3);
    setGameState(GameStates.LEVEL_TRANSITION);
    playSound('level');
}

function maybeSpawnPowerUp(x, y) {
    if (Math.random() > 0.25) {
        return;
    }

    const roll = Math.random();
    let type;
    if (roll < 0.55) {
        type = PowerUpTypes.BERRY;
    } else if (roll < 0.75) {
        type = PowerUpTypes.HEART;
    } else {
        const abilityPool = [PowerUpTypes.SPEED, PowerUpTypes.BUBBLE, PowerUpTypes.FIRE];
        type = abilityPool[Math.floor(Math.random() * abilityPool.length)];
    }

    powerUps.push(new PowerUp(x + enemyWidth / 2, y + enemyHeight / 2, type));
}

function spawnParticles(x, y, type) {
    const counts = {
        pop: 12,
        power: 16,
        hit: 18,
        fire: 18
    };
    const count = counts[type] ?? 10;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 1.6 + 0.4) * (type === 'hit' ? 3 : 2);
        const options = {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: type === 'power' ? 3.5 : 2.5,
            life: type === 'hit' ? 50 : 35,
            gravity: type === 'hit' ? 0.25 : 0.05,
            color: 'rgba(173, 216, 230, 0.85)'
        };

        if (type === 'power') {
            options.color = 'rgba(255, 215, 0, 0.85)';
            options.gravity = -0.02;
        } else if (type === 'hit') {
            options.color = 'rgba(255, 82, 82, 0.85)';
        } else if (type === 'fire') {
            options.color = 'rgba(255, 140, 0, 0.9)';
            options.gravity = -0.01;
            options.size = 3.5;
        }

        particles.push(new Particle(x, y, options));
    }
}

function getActiveEffectTexts() {
    const texts = [];
    if (speedBoostTimer > 0) {
        texts.push(`Speed Boost ${formatEffectTimer(speedBoostTimer)}`);
    }
    if (bubbleBoostTimer > 0) {
        texts.push(`Bubble Boost ${formatEffectTimer(bubbleBoostTimer)}`);
    }
    if (fireBubbleTimer > 0) {
        texts.push(`Fire Bubbles ${formatEffectTimer(fireBubbleTimer)}`);
    }
    return texts;
}

function formatEffectTimer(timer) {
    return `${Math.ceil(timer / 60)}s`;
}

function updateLevelTransition() {
    if (pendingLevel === null) {
        return;
    }

    levelTransitionTimer--;
    if (levelTransitionTimer <= 0) {
        const nextLevel = pendingLevel;
        pendingLevel = null;
        startLevel(nextLevel);
        setGameState(GameStates.PLAYING);
        playSound('level');
    }
}

function setGameState(newState) {
    if (gameState === newState) {
        return;
    }

    gameState = newState;

    if (newState === GameStates.PLAYING) {
        lastFrameTime = performance.now();
        accumulatedTime = 0;
    }

    if (newState === GameStates.TITLE) {
        pendingLevel = null;
        levelTransitionTimer = 0;
    }
}

function startNewGame() {
    resetGameVariables();
    startLevel(1);
    setGameState(GameStates.PLAYING);
}

function initializeGame() {
    resizeCanvas();
    resetGameVariables();
    setGameState(GameStates.TITLE);
    lastFrameTime = performance.now();
    accumulatedTime = 0;
    requestAnimationFrame(gameLoop);
}

function drawGame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackdrop();

    ctx.save();
    ctx.translate(renderOffsetX, renderOffsetY);
    ctx.scale(renderScale, renderScale);

    ctx.save();
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
        screenShake *= 0.9;
        if (screenShake < 0.5) {
            screenShake = 0;
        }
    }

    drawGround();

    ctx.fillStyle = '#8B4513';
    for (const platform of platforms) {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }

    drawBadger();

    for (const bubble of bubbles) {
        bubble.draw();
    }

    for (const item of powerUps) {
        item.draw();
    }

    for (const particle of particles) {
        particle.draw();
    }

    for (const enemy of enemies) {
        enemy.draw();
    }

    ctx.restore();

    if (currentLevel > 0 || gameState === GameStates.PLAYING || gameState === GameStates.PAUSED || gameState === GameStates.LEVEL_TRANSITION) {
        const textScale = Math.max(0.85, Math.min(1.12, renderScale * 1.2));
        const fontSize = Math.round(20 * textScale);
        const topPadding = 16 * textScale;

        ctx.save();
        ctx.textBaseline = 'top';
        ctx.font = `${fontSize}px "Trebuchet MS", "Segoe UI", sans-serif`;
        ctx.fillStyle = '#f3fbff';
        ctx.shadowColor = 'rgba(2, 10, 18, 0.65)';
        ctx.shadowBlur = 12 * textScale;

        ctx.textAlign = 'left';
        ctx.fillText(`Score ${score}`, 16, topPadding);

        ctx.textAlign = 'center';
        const levelLabel = currentLevelName || `Level ${Math.max(currentLevel, 1)}`;
        ctx.fillText(levelLabel, WORLD_WIDTH / 2, topPadding);

        ctx.textAlign = 'right';
        ctx.fillText(`Lives ${lives}`, WORLD_WIDTH - 16, topPadding);
        ctx.restore();
    }

    switch (gameState) {
        case GameStates.TITLE:
            drawTitleScreen();
            break;
        case GameStates.PAUSED:
            drawOverlay([
                'Paused',
                'Tap the screen or press Enter/Escape/P to resume',
                'Press R on keyboard to restart',
                `Best Combo so far: x${bestCombo}`
            ]);
            break;
        case GameStates.LEVEL_TRANSITION:
            if (pendingLevel !== null) {
                const nextConfig = levelConfigs[pendingLevel - 1];
                const nextName = Array.isArray(nextConfig) ? `Level ${pendingLevel}` : nextConfig?.name ?? `Level ${pendingLevel}`;
                drawOverlay([
                    `${currentLevelName || `Level ${currentLevel}`} cleared!`,
                    `Next up: ${nextName}`,
                    `Starting in ${Math.ceil(levelTransitionTimer / 60)}...`,
                    'Tap or press Enter to skip countdown',
                    `Best Combo so far: x${bestCombo}`
                ]);
            }
            break;
        case GameStates.GAME_OVER:
            drawOverlay([
                'Game Over',
                `Final Score: ${score}`,
                `Best Combo: x${bestCombo}`,
                'Tap or press Enter to return to title'
            ], { background: 'rgba(120, 0, 0, 0.8)' });
            break;
        case GameStates.VICTORY:
            drawOverlay([
                'You win!',
                `Final Score: ${score}`,
                `Best Combo: x${bestCombo}`,
                'Tap or press Enter to celebrate again'
            ], { background: 'rgba(255, 215, 0, 0.85)', textColor: '#0a2450' });
            break;
        default:
            break;
    }

    ctx.restore();
}

function drawOverlay(lines, options = {}) {
    const {
        background = 'rgba(0, 0, 0, 0.7)',
        textColor = '#ffffff',
        font = '32px Arial',
        lineHeight = 44,
        padding = 24
    } = options;

    ctx.save();
    ctx.font = font;
    const widths = lines.map(line => ctx.measureText(line).width);
    const blockWidth = Math.max(260, Math.max(...widths) + padding * 2);
    const blockHeight = lineHeight * lines.length + padding * 2;
    const x = (WORLD_WIDTH - blockWidth) / 2;
    const y = WORLD_HEIGHT / 2 - blockHeight / 2;

    ctx.fillStyle = background;
    ctx.fillRect(x, y, blockWidth, blockHeight);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], WORLD_WIDTH / 2, y + padding + lineHeight * i + lineHeight / 2);
    }

    ctx.restore();
}

function drawBackdrop() {
    const progression = Math.min(currentLevel / maxLevels, 1);
    const skyTop = progression > 0.75 ? '#1f2c5a' : '#071428';
    const skyMid = progression > 0.5 ? '#143355' : '#0f2744';
    const skyBottom = '#122437';

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(0.55, skyMid);
    gradient.addColorStop(1, skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const now = performance.now() * 0.001;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    nightSkySparks.forEach(star => {
        const px = star.x * canvas.width;
        const py = star.y * canvas.height;
        const twinkle = (Math.sin(now * 2 + star.phase) + 1.4) * 0.35;
        const radius = star.radius + twinkle;
        const gradientSpark = ctx.createRadialGradient(px, py, 0, px, py, radius * 6);
        gradientSpark.addColorStop(0, `rgba(255, 255, 255, ${0.85 - twinkle * 0.3})`);
        gradientSpark.addColorStop(0.5, `rgba(173, 214, 255, ${0.35 - twinkle * 0.2})`);
        gradientSpark.addColorStop(1, 'rgba(10, 20, 35, 0)');
        ctx.fillStyle = gradientSpark;
        ctx.beginPath();
        ctx.arc(px, py, radius * 6, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // moon glow
    const moonX = canvas.width * 0.2;
    const moonY = canvas.height * 0.18;
    const moonRadius = canvas.height * 0.12;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius * 1.4);
    moonGlow.addColorStop(0, 'rgba(246, 250, 255, 0.95)');
    moonGlow.addColorStop(0.55, 'rgba(210, 225, 255, 0.45)');
    moonGlow.addColorStop(1, 'rgba(26, 43, 63, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5f8ff';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // distant ridges
    drawMountainLayer([{ x: 0, y: 0.62 }, { x: 0.12, y: 0.52 }, { x: 0.28, y: 0.6 }, { x: 0.46, y: 0.48 }, { x: 0.65, y: 0.66 }, { x: 0.86, y: 0.5 }, { x: 1, y: 0.6 }], '#0d1e31', 0.9);
    drawMountainLayer([{ x: 0, y: 0.72 }, { x: 0.16, y: 0.6 }, { x: 0.35, y: 0.68 }, { x: 0.56, y: 0.56 }, { x: 0.74, y: 0.72 }, { x: 0.92, y: 0.6 }, { x: 1, y: 0.7 }], '#13263a', 0.92);
    drawMountainLayer([{ x: 0, y: 0.84 }, { x: 0.2, y: 0.7 }, { x: 0.4, y: 0.8 }, { x: 0.65, y: 0.66 }, { x: 0.82, y: 0.78 }, { x: 1, y: 0.72 }], '#162d40', 0.95);

    // woodland haze
    const mistGradient = ctx.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height);
    mistGradient.addColorStop(0, 'rgba(34, 64, 82, 0.0)');
    mistGradient.addColorStop(1, 'rgba(18, 37, 48, 0.85)');
    ctx.fillStyle = mistGradient;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

    // fireflies shimmering near ground
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    woodlandFireflies.forEach(firefly => {
        const px = firefly.x * canvas.width;
        const py = firefly.y * canvas.height + Math.sin(now * firefly.drift + firefly.offset) * canvas.height * 0.02;
        const pulse = (Math.sin(now * 4 + firefly.offset) + 1) * 0.5;
        const size = 2 + pulse * 4;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 5);
        glow.addColorStop(0, `rgba(255, 240, 170, ${0.8})`);
        glow.addColorStop(0.4, `rgba(255, 191, 105, ${0.45})`);
        glow.addColorStop(1, 'rgba(20, 35, 40, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, size * 5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawMountainLayer(points, color, opacity = 1) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    points.forEach(point => {
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
    });
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawTitleScreen() {
    ctx.save();

    const textScale = Math.max(0.78, Math.min(1.08, renderScale * 1.15));
    const panelWidth = Math.min(640, WORLD_WIDTH - 80);
    const paddingX = 36 * textScale;
    const paddingY = 32 * textScale;
    const titleSize = 48 * textScale;
    const taglineSize = 22 * textScale;
    const bodySize = 18 * textScale;
    const controlsSize = 18 * textScale;
    const sectionGap = 24 * textScale;
    const storyLineHeight = 24 * textScale;
    const controlsLineHeight = 22 * textScale;

    const storyLines = [
        'When twilight settles over Mosswood Grove, a gentle badger',
        'named Bobble keeps watch over the moonlit berries that feed',
        'the woodland folk. Mischievous sprites have swept in to steal',
        'the harvest—unless Bobble can bubble them up first!',
        '',
        'Float across glimmering branches, rescue the grove\'s treasures,',
        'and uncover shimmering prizes that grant bursts of forest magic.'
    ];

    const controls = [
        'Keyboard: Move with Arrow Keys or A/D    Jump with W / Up / Space',
        'Keyboard: Shoot bubbles with Z or J    Pause with P or Escape',
        'Touch: Drag the on-screen joystick to move and tap Jump/Bubble to act'
    ];

    const storyBlockHeight = storyLines.reduce((height, line) => (
        height + (line.trim() ? storyLineHeight : storyLineHeight * 0.6)
    ), 0);
    const callToActionHeight = 22 * textScale;
    const controlsBlockHeight = controls.length * controlsLineHeight;

    const panelHeight = paddingY * 2 + titleSize + taglineSize + sectionGap + storyBlockHeight + sectionGap + callToActionHeight + sectionGap * 0.6 + controlsBlockHeight;
    const x = (WORLD_WIDTH - panelWidth) / 2;
    const y = WORLD_HEIGHT / 2 - panelHeight / 2;
    const borderRadius = 18;

    ctx.fillStyle = 'rgba(6, 22, 36, 0.85)';
    roundRect(ctx, x, y, panelWidth, panelHeight, borderRadius);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(188, 228, 255, 0.5)';
    roundRect(ctx, x, y, panelWidth, panelHeight, borderRadius);
    ctx.stroke();

    const innerGlow = ctx.createLinearGradient(0, y, 0, y + panelHeight);
    innerGlow.addColorStop(0, 'rgba(110, 180, 255, 0.28)');
    innerGlow.addColorStop(1, 'rgba(20, 40, 60, 0.35)');
    ctx.fillStyle = innerGlow;
    roundRect(ctx, x + 8, y + 8, panelWidth - 16, panelHeight - 16, borderRadius - 6);
    ctx.fill();

    let cursorY = y + paddingY;

    ctx.fillStyle = '#f2f9ff';
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(titleSize)}px "Trebuchet MS", "Segoe UI", sans-serif`;
    cursorY += titleSize;
    ctx.fillText('Badger Bobble', WORLD_WIDTH / 2, cursorY);

    ctx.font = `${Math.round(taglineSize)}px "Trebuchet MS", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#a8dcff';
    cursorY += taglineSize + 6 * textScale;
    ctx.fillText('Guardian of Mosswood Grove', WORLD_WIDTH / 2, cursorY);

    cursorY += sectionGap;
    ctx.textAlign = 'left';
    ctx.font = `${Math.round(bodySize)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#eaf6ff';
    const storyX = x + paddingX;
    storyLines.forEach(line => {
        const isBlank = !line.trim();
        cursorY += isBlank ? storyLineHeight * 0.6 : storyLineHeight;
        if (!isBlank) {
            ctx.fillText(line, storyX, cursorY);
        }
    });

    cursorY += sectionGap;
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(bodySize)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffe8a6';
    cursorY += callToActionHeight;
    ctx.fillText('Tap anywhere or press Enter to begin your vigil.', WORLD_WIDTH / 2, cursorY);

    cursorY += sectionGap * 0.6;
    ctx.fillStyle = '#bde3ff';
    ctx.font = `${Math.round(controlsSize)}px "Segoe UI", sans-serif`;
    controls.forEach(line => {
        cursorY += controlsLineHeight;
        ctx.fillText(line, WORLD_WIDTH / 2, cursorY);
    });

    ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
}

function drawHeart(x, y, size, color = '#ff5c7a') {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.6);
    ctx.bezierCurveTo(size, -size * 0.6, size * 2, size * 0.6, 0, size * 2);
    ctx.bezierCurveTo(-size * 2, size * 0.6, -size, -size * 0.6, 0, size * 0.6);
    ctx.fill();
    ctx.restore();
}

function roundedRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBadgerSprite({ x, y, width, height, facingRight, isInvincible }) {
    const time = performance.now() * 0.004;
    const tilt = Math.sin(time + x * 0.02) * 0.05;

    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.scale(facingRight ? 1 : -1, 1);
    ctx.rotate(tilt);
    ctx.translate(-width / 2, -height / 2);

    if (isInvincible) {
        const pulse = 0.4 + (Math.sin(time * 8) + 1) * 0.2;
        ctx.save();
        ctx.globalAlpha = 0.35 + pulse * 0.1;
        ctx.fillStyle = 'rgba(250, 255, 210, 0.8)';
        ctx.beginPath();
        ctx.ellipse(width * 0.5, height * 0.55, width * 0.65, height * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const furGradient = ctx.createLinearGradient(0, 0, 0, height);
    furGradient.addColorStop(0, '#4d3b2a');
    furGradient.addColorStop(0.5, '#322416');
    furGradient.addColorStop(1, '#2a1c12');

    ctx.fillStyle = furGradient;
    ctx.beginPath();
    ctx.ellipse(width * 0.48, height * 0.58, width * 0.45, height * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // belly
    const bellyGradient = ctx.createLinearGradient(0, height * 0.3, 0, height);
    bellyGradient.addColorStop(0, '#d9c7ab');
    bellyGradient.addColorStop(1, '#b39a77');
    ctx.fillStyle = bellyGradient;
    ctx.beginPath();
    ctx.ellipse(width * 0.62, height * 0.68, width * 0.25, height * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = furGradient;
    ctx.beginPath();
    ctx.ellipse(width * 0.62, height * 0.32, width * 0.32, height * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // facial mask stripes
    ctx.fillStyle = '#f5f1e6';
    ctx.beginPath();
    ctx.moveTo(width * 0.62, height * 0.08);
    ctx.quadraticCurveTo(width * 0.88, height * 0.2, width * 0.62, height * 0.32);
    ctx.quadraticCurveTo(width * 0.88, height * 0.42, width * 0.62, height * 0.56);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5f1e6';
    ctx.beginPath();
    ctx.moveTo(width * 0.62, height * 0.08);
    ctx.quadraticCurveTo(width * 0.36, height * 0.2, width * 0.62, height * 0.32);
    ctx.quadraticCurveTo(width * 0.36, height * 0.42, width * 0.62, height * 0.56);
    ctx.closePath();
    ctx.fill();

    // ears
    ctx.fillStyle = '#2f2115';
    ctx.beginPath();
    ctx.ellipse(width * 0.28, height * 0.14, width * 0.12, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.76, height * 0.14, width * 0.12, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(width * 0.48, height * 0.3, width * 0.07, height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.72, height * 0.3, width * 0.07, height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b1916';
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.3, width * 0.03, height * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.7, height * 0.3, width * 0.03, height * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // nose
    ctx.fillStyle = '#2c1b1b';
    ctx.beginPath();
    ctx.ellipse(width * 0.64, height * 0.43, width * 0.06, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // paws
    ctx.fillStyle = '#2f2115';
    ctx.fillRect(width * 0.12, height * 0.68, width * 0.12, height * 0.2);
    ctx.fillRect(width * 0.44, height * 0.74, width * 0.12, height * 0.18);
    ctx.fillRect(width * 0.72, height * 0.68, width * 0.12, height * 0.2);

    // tail
    ctx.beginPath();
    ctx.moveTo(width * 0.04, height * 0.6);
    ctx.quadraticCurveTo(-width * 0.1, height * 0.5, width * 0.04, height * 0.4);
    ctx.quadraticCurveTo(width * 0.16, height * 0.5, width * 0.04, height * 0.6);
    ctx.fillStyle = '#3a2a1c';
    ctx.fill();

    ctx.restore();
}

function drawEnemySprite(enemy) {
    const { width, height } = enemy;
    const time = performance.now() * 0.004;

    ctx.save();
    ctx.translate(enemy.x + width / 2, enemy.y + height / 2);
    ctx.scale(enemy.facing === -1 ? -1 : 1, 1);
    ctx.translate(-width / 2, -height / 2);

    if (enemy.state === 'trapped') {
        ctx.globalAlpha = 0.6;
    }

    switch (enemy.type) {
        case EnemyTypes.HOPPER:
            drawHopperSprite(width, height, time, enemy);
            break;
        case EnemyTypes.SWOOPER:
            drawSwooperSprite(width, height, time, enemy);
            break;
        case EnemyTypes.WALKER:
        default:
            drawWalkerSprite(width, height, time);
            break;
    }

    ctx.restore();

    if (enemy.state === 'trapped') {
        ctx.save();
        ctx.strokeStyle = 'rgba(173, 216, 230, 0.8)';
        ctx.lineWidth = 3;
        roundedRectPath(enemy.x - 4, enemy.y - 4, enemy.width + 8, enemy.height + 8, 12);
        ctx.stroke();
        ctx.restore();
    }
}

function drawWalkerSprite(width, height, time) {
    const bob = Math.sin(time * 1.2) * 2;
    const bodyGrad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    bodyGrad.addColorStop(0, '#7c4f2a');
    bodyGrad.addColorStop(1, '#4c2f18');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.55 + bob, width * 0.45, height * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9f7047';
    ctx.beginPath();
    ctx.ellipse(width * 0.6, height * 0.35 + bob, width * 0.32, height * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // spikes
    ctx.fillStyle = '#cfa86d';
    for (let i = 0; i < 5; i++) {
        const px = width * 0.18 + i * width * 0.14;
        ctx.beginPath();
        ctx.moveTo(px, height * 0.32 + bob);
        ctx.lineTo(px + width * 0.05, height * 0.08 + bob);
        ctx.lineTo(px + width * 0.1, height * 0.32 + bob);
        ctx.closePath();
        ctx.fill();
    }

    // eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(width * 0.62, height * 0.3 + bob, width * 0.08, height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a110d';
    ctx.beginPath();
    ctx.ellipse(width * 0.64, height * 0.3 + bob, width * 0.03, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.fillStyle = '#3b2411';
    ctx.fillRect(width * 0.18, height * 0.72 + bob, width * 0.12, height * 0.18);
    ctx.fillRect(width * 0.62, height * 0.72 + bob, width * 0.12, height * 0.18);
}

function drawHopperSprite(width, height, time, enemy) {
    const jumpPhase = Math.sin(time * 6 + enemy.x * 0.04);
    const bob = jumpPhase * 3;
    const bodyGrad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    bodyGrad.addColorStop(0, '#53c86b');
    bodyGrad.addColorStop(1, '#2b8d44');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.55 + bob, width * 0.42, height * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // head ridge
    ctx.fillStyle = '#2f9d4f';
    ctx.beginPath();
    ctx.ellipse(width * 0.6, height * 0.34 + bob, width * 0.32, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(width * 0.68, height * 0.32 + bob, width * 0.08, height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.52, height * 0.32 + bob, width * 0.08, height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12301b';
    ctx.beginPath();
    ctx.ellipse(width * 0.7, height * 0.32 + bob, width * 0.03, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.54, height * 0.32 + bob, width * 0.03, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#10391f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.65 + bob);
    ctx.quadraticCurveTo(width * 0.05, height * 0.9 + bob, width * 0.26, height * 0.96 + bob);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width * 0.7, height * 0.68 + bob);
    ctx.quadraticCurveTo(width * 0.92, height * 0.9 + bob, width * 0.58, height * 0.98 + bob);
    ctx.stroke();
}

function drawSwooperSprite(width, height, time, enemy) {
    const flap = Math.sin(time * 12 + enemy.x * 0.08);
    const wingSpan = width * 0.85;

    // body
    const bodyGrad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    bodyGrad.addColorStop(0, '#6d7cf0');
    bodyGrad.addColorStop(1, '#3946a6');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(width * 0.52, height * 0.5, width * 0.28, height * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // wings
    ctx.fillStyle = '#5564d6';
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.5);
    ctx.quadraticCurveTo(width * 0.5 - wingSpan * 0.45, height * 0.5 - flap * 18 - 14, width * 0.12, height * 0.78);
    ctx.quadraticCurveTo(width * 0.3, height * 0.58, width * 0.5, height * 0.5);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.5);
    ctx.quadraticCurveTo(width * 0.5 + wingSpan * 0.45, height * 0.5 - flap * 18 - 14, width * 0.88, height * 0.78);
    ctx.quadraticCurveTo(width * 0.7, height * 0.58, width * 0.5, height * 0.5);
    ctx.fill();

    // ears
    ctx.fillStyle = '#2e367c';
    ctx.beginPath();
    ctx.moveTo(width * 0.46, height * 0.24);
    ctx.lineTo(width * 0.38, height * 0.05);
    ctx.lineTo(width * 0.52, height * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(width * 0.58, height * 0.24);
    ctx.lineTo(width * 0.66, height * 0.05);
    ctx.lineTo(width * 0.54, height * 0.22);
    ctx.closePath();
    ctx.fill();

    // face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.45, width * 0.18, height * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b1d36';
    ctx.beginPath();
    ctx.ellipse(width * 0.46, height * 0.44, width * 0.04, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.54, height * 0.44, width * 0.04, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7854';
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.52);
    ctx.lineTo(width * 0.46, height * 0.6);
    ctx.lineTo(width * 0.54, height * 0.6);
    ctx.closePath();
    ctx.fill();
}

function gameLoop(timestamp) {
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    accumulatedTime += delta;

    while (accumulatedTime >= frameDuration) {
        if (gameState === GameStates.PLAYING) {
            handleInput();
            updateGame();
        } else if (gameState === GameStates.LEVEL_TRANSITION) {
            updateLevelTransition();
        }

        accumulatedTime -= frameDuration;
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}

function startLevel(levelNumber) {
    console.log(`Starting Level ${levelNumber}`);
    currentLevel = levelNumber;
    enemies = [];
    bubbles = [];
    powerUps = [];
    particles = [];
    resetBadgerPosition();
    isInvincible = false;
    invincibilityTimer = 0;
    canShoot = true;
    shootTimer = 0;
    keys = {};
    comboCounter = 0;
    comboTimer = 0;

    const configIndex = levelNumber - 1;
    if (configIndex < levelConfigs.length) {
        const levelConfig = levelConfigs[configIndex];
        const enemyDefs = Array.isArray(levelConfig) ? levelConfig : levelConfig?.enemies ?? [];
        currentLevelName = Array.isArray(levelConfig) ? `Level ${levelNumber}` : levelConfig?.name ?? `Level ${levelNumber}`;

        if (enemyDefs.length > 0) {
            enemyDefs.forEach(enemyPos => {
                enemies.push(new Enemy(enemyPos.x, enemyPos.y, enemyPos.type ?? EnemyTypes.WALKER));
            });
        } else {
            enemies.push(new Enemy(WORLD_WIDTH / 2 - enemyWidth / 2, 100, EnemyTypes.WALKER));
        }
    } else {
        console.error(`Configuration for level ${levelNumber} not found!`);
        currentLevelName = `Level ${levelNumber}`;
        enemies.push(new Enemy(WORLD_WIDTH / 2 - enemyWidth / 2, 100, EnemyTypes.WALKER));
    }

    scheduleNextPrize();
}

// Don't start the game immediately, wait for images via imageLoaded()
