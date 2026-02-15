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
}
