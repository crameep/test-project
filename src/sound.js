/**
 * Micro Tower Defense - Merge Madness
 * Sound system - procedural sound effects using Web Audio API
 */

// Sound configuration constants
const MASTER_VOLUME = 0.3;        // Master volume level (0-1)
const MAX_CONCURRENT_SOUNDS = 8;  // Maximum concurrent sounds to prevent audio overload
const SOUND_DEBOUNCE_MS = 30;     // Minimum time between same sound types (ms)

/**
 * SoundManager class - manages procedural sound generation using Web Audio API
 * Handles audio context lifecycle, mute state, and sound debouncing
 */
export class SoundManager {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;

        // Audio context - created lazily on first user interaction
        this.context = null;
        this.masterGain = null;

        // State tracking
        this.muted = false;
        this.initialized = false;
        this.activeSounds = 0;

        // Debouncing - track last play time for each sound type
        this.lastPlayTime = {};

        // Check for Web Audio API support
        this.supported = typeof AudioContext !== 'undefined' ||
                         typeof webkitAudioContext !== 'undefined';
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     * @returns {boolean} True if initialization succeeded
     */
    init() {
        if (this.initialized) return true;
        if (!this.supported) return false;

        try {
            // Create audio context (with webkit fallback for older browsers)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContextClass();

            // Create master gain node for volume control
            this.masterGain = this.context.createGain();
            this.masterGain.gain.setValueAtTime(MASTER_VOLUME, this.context.currentTime);
            this.masterGain.connect(this.context.destination);

            this.initialized = true;
            return true;
        } catch (e) {
            // Audio initialization failed - degrade gracefully
            this.supported = false;
            return false;
        }
    }

    /**
     * Resume the audio context (required after user interaction in some browsers)
     * @returns {Promise<boolean>} True if context is running
     */
    async resumeContext() {
        if (!this.supported) return false;

        // Initialize if not already done
        if (!this.initialized) {
            this.init();
        }

        if (!this.context) return false;

        // Resume suspended context
        if (this.context.state === 'suspended') {
            try {
                await this.context.resume();
            } catch (e) {
                return false;
            }
        }

        return this.context.state === 'running';
    }

    /**
     * Reset sound manager state (called on game restart)
     */
    reset() {
        // Clear debounce timers
        this.lastPlayTime = {};
        this.activeSounds = 0;
    }

    /**
     * Clean up audio resources
     */
    destroy() {
        if (this.context && this.context.state !== 'closed') {
            try {
                this.context.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        this.context = null;
        this.masterGain = null;
        this.initialized = false;
        this.lastPlayTime = {};
        this.activeSounds = 0;
    }

    /**
     * Set muted state
     * @param {boolean} muted - True to mute all sounds
     */
    setMuted(muted) {
        this.muted = muted;

        // Update master gain if available
        if (this.masterGain && this.context) {
            this.masterGain.gain.setValueAtTime(
                muted ? 0 : MASTER_VOLUME,
                this.context.currentTime
            );
        }
    }

    /**
     * Toggle muted state
     * @returns {boolean} New muted state
     */
    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /**
     * Get current muted state
     * @returns {boolean} True if muted
     */
    isMuted() {
        return this.muted;
    }

    /**
     * Check if audio is ready to play
     * @returns {boolean} True if audio can be played
     */
    isReady() {
        return this.initialized &&
               this.context &&
               this.context.state === 'running' &&
               !this.muted;
    }

    /**
     * Check if a sound type can be played (debouncing)
     * @param {string} soundType - Type of sound to check
     * @returns {boolean} True if sound can be played
     */
    canPlay(soundType) {
        // Check concurrent sound limit
        if (this.activeSounds >= MAX_CONCURRENT_SOUNDS) {
            return false;
        }

        // Check debounce timing
        const now = performance.now();
        const lastPlay = this.lastPlayTime[soundType] || 0;
        if (now - lastPlay < SOUND_DEBOUNCE_MS) {
            return false;
        }

        return true;
    }

    /**
     * Mark a sound type as played (for debouncing)
     * @param {string} soundType - Type of sound played
     */
    markPlayed(soundType) {
        this.lastPlayTime[soundType] = performance.now();
        this.activeSounds++;
    }

    /**
     * Mark a sound as finished (for concurrent sound tracking)
     */
    markFinished() {
        this.activeSounds = Math.max(0, this.activeSounds - 1);
    }

    /**
     * Create an oscillator node configured with given parameters
     * @param {string} type - Oscillator type ('sine', 'square', 'sawtooth', 'triangle')
     * @param {number} frequency - Starting frequency in Hz
     * @returns {OscillatorNode|null} Configured oscillator or null if not ready
     */
    createOscillator(type, frequency) {
        if (!this.context) return null;

        const oscillator = this.context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
        return oscillator;
    }

    /**
     * Create a gain node with initial value
     * @param {number} initialGain - Initial gain value (0-1)
     * @returns {GainNode|null} Configured gain node or null if not ready
     */
    createGain(initialGain) {
        if (!this.context) return null;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(initialGain, this.context.currentTime);
        return gainNode;
    }

    /**
     * Schedule oscillator cleanup after it finishes
     * @param {OscillatorNode} oscillator - Oscillator to clean up
     * @param {number} duration - Duration until cleanup (seconds)
     */
    scheduleCleanup(oscillator, duration) {
        const durationMs = duration * 1000;
        setTimeout(() => {
            this.markFinished();
        }, durationMs);
    }

    /**
     * Play merge sound - satisfying "ding" with rising pitch
     * Creates a layered bell-like tone when towers merge
     */
    playMerge() {
        if (!this.isReady() || !this.canPlay('merge')) return;
        this.markPlayed('merge');

        const now = this.context.currentTime;
        const duration = 0.3;

        // Create main oscillator - sine wave for clean tone
        const osc1 = this.createOscillator('sine', 880);
        const gain1 = this.createGain(0.3);

        if (!osc1 || !gain1) return;

        // Rising pitch for satisfying effect
        osc1.frequency.setValueAtTime(660, now);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.1);

        // Quick attack, moderate decay
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

        // Create harmonic overtone for richness
        const osc2 = this.createOscillator('sine', 1320);
        const gain2 = this.createGain(0.15);

        if (osc2 && gain2) {
            osc2.frequency.setValueAtTime(990, now);
            osc2.frequency.exponentialRampToValueAtTime(1980, now + 0.1);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.15, now + 0.02);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.8);

            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(now);
            osc2.stop(now + duration);
        }

        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start(now);
        osc1.stop(now + duration);

        this.scheduleCleanup(osc1, duration);
    }

    /**
     * Play attack sound - quick "pew" laser sound
     * Creates a descending pitch zap effect for tower attacks
     */
    playAttack() {
        if (!this.isReady() || !this.canPlay('attack')) return;
        this.markPlayed('attack');

        const now = this.context.currentTime;
        const duration = 0.1;

        // Square wave for sharp attack sound
        const osc = this.createOscillator('square', 800);
        const gain = this.createGain(0.15);

        if (!osc || !gain) return;

        // Descending pitch for "pew" effect
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + duration);

        // Quick attack and decay
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);

        this.scheduleCleanup(osc, duration);
    }

    /**
     * Play hit sound - short impact thud
     * Creates a low-frequency thump when projectiles hit enemies
     */
    playHit() {
        if (!this.isReady() || !this.canPlay('hit')) return;
        this.markPlayed('hit');

        const now = this.context.currentTime;
        const duration = 0.08;

        // Triangle wave for softer impact
        const osc = this.createOscillator('triangle', 150);
        const gain = this.createGain(0.25);

        if (!osc || !gain) return;

        // Descending pitch for impact feel
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);

        // Quick envelope
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);

        this.scheduleCleanup(osc, duration);
    }

    /**
     * Play death sound - enemy destruction explosion
     * Creates a noise burst with descending pitch for explosions
     */
    playDeath() {
        if (!this.isReady() || !this.canPlay('death')) return;
        this.markPlayed('death');

        const now = this.context.currentTime;
        const duration = 0.2;

        // Low frequency base for explosion
        const osc1 = this.createOscillator('sawtooth', 100);
        const gain1 = this.createGain(0.2);

        if (!osc1 || !gain1) return;

        // Descending rumble
        osc1.frequency.setValueAtTime(100, now);
        osc1.frequency.exponentialRampToValueAtTime(30, now + duration);

        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start(now);
        osc1.stop(now + duration);

        // Add noise-like texture with square wave at higher frequency
        const osc2 = this.createOscillator('square', 200);
        const gain2 = this.createGain(0.1);

        if (osc2 && gain2) {
            osc2.frequency.setValueAtTime(200, now);
            osc2.frequency.exponentialRampToValueAtTime(60, now + duration * 0.5);

            gain2.gain.setValueAtTime(0.1, now);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.5);

            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(now);
            osc2.stop(now + duration);
        }

        this.scheduleCleanup(osc1, duration);
    }

    /**
     * Play UI click sound - subtle button click
     * Creates a short, crisp click for UI interactions
     */
    playUIClick() {
        if (!this.isReady() || !this.canPlay('uiclick')) return;
        this.markPlayed('uiclick');

        const now = this.context.currentTime;
        const duration = 0.05;

        // High frequency sine for clean click
        const osc = this.createOscillator('sine', 1000);
        const gain = this.createGain(0.1);

        if (!osc || !gain) return;

        // Quick pitch drop for click feel
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + duration);

        // Very quick envelope
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);

        this.scheduleCleanup(osc, duration);
    }

    /**
     * Play game start sound - triumphant fanfare
     * Creates an ascending arpeggio to signal game beginning
     */
    playGameStart() {
        if (!this.isReady() || !this.canPlay('gamestart')) return;
        this.markPlayed('gamestart');

        const now = this.context.currentTime;
        const duration = 0.5;

        // Ascending notes for fanfare effect
        const notes = [440, 554, 659, 880]; // A4, C#5, E5, A5
        const noteLength = 0.12;

        notes.forEach((freq, i) => {
            const startTime = now + i * noteLength * 0.8;

            const osc = this.createOscillator('triangle', freq);
            const gain = this.createGain(0.2);

            if (!osc || !gain) return;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(startTime);
            osc.stop(startTime + noteLength);
        });

        this.scheduleCleanup(null, duration);
    }

    /**
     * Play game over sound - descending sad tones
     * Creates a descending pattern to signal game end
     */
    playGameOver() {
        if (!this.isReady() || !this.canPlay('gameover')) return;
        this.markPlayed('gameover');

        const now = this.context.currentTime;
        const duration = 0.8;

        // Descending minor notes for sad effect
        const notes = [440, 392, 349, 294]; // A4, G4, F4, D4
        const noteLength = 0.18;

        notes.forEach((freq, i) => {
            const startTime = now + i * noteLength;

            const osc = this.createOscillator('sine', freq);
            const gain = this.createGain(0.25);

            if (!osc || !gain) return;

            // Slight vibrato for emotional effect
            const lfo = this.createOscillator('sine', 5);
            const lfoGain = this.createGain(3);

            if (lfo && lfoGain) {
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(startTime);
                lfo.stop(startTime + noteLength * 1.2);
            }

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.setValueAtTime(0.25, startTime + noteLength * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteLength * 1.2);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(startTime);
            osc.stop(startTime + noteLength * 1.2);
        });

        this.scheduleCleanup(null, duration);
    }
}
