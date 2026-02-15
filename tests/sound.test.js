/**
 * Unit tests for SoundManager class
 * Tests audio initialization, sound playback, mute functionality, and debouncing
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Store original AudioContext
const originalAudioContext = global.AudioContext;

// Helper to create a mock AudioContext
function createMockAudioContext() {
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    createOscillator: jest.fn(() => ({
      type: 'sine',
      frequency: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    })),
    createGain: jest.fn(() => ({
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      },
      connect: jest.fn()
    })),
    resume: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve())
  };
}

// Setup mock before importing SoundManager
beforeAll(() => {
  global.AudioContext = jest.fn(() => createMockAudioContext());
});

afterAll(() => {
  global.AudioContext = originalAudioContext;
});

// Import SoundManager after mocks are set up
const { SoundManager } = await import('../src/sound.js');

describe('SoundManager', () => {
  let game;
  let soundManager;
  let performanceNowSpy;

  beforeEach(() => {
    // Reset mock AudioContext for each test
    global.AudioContext = jest.fn(() => createMockAudioContext());

    // Create mock game object
    game = {
      canvas: document.createElement('canvas')
    };

    // Create SoundManager instance
    soundManager = new SoundManager(game);

    // Mock performance.now for debounce testing - default to 1000 to avoid debounce issues
    performanceNowSpy = jest.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store game reference', () => {
      expect(soundManager.game).toBe(game);
    });

    it('should initialize with null context', () => {
      expect(soundManager.context).toBeNull();
    });

    it('should initialize with null masterGain', () => {
      expect(soundManager.masterGain).toBeNull();
    });

    it('should initialize as not muted', () => {
      expect(soundManager.muted).toBe(false);
    });

    it('should initialize as not initialized', () => {
      expect(soundManager.initialized).toBe(false);
    });

    it('should initialize activeSounds to 0', () => {
      expect(soundManager.activeSounds).toBe(0);
    });

    it('should initialize lastPlayTime as empty object', () => {
      expect(soundManager.lastPlayTime).toEqual({});
    });

    it('should detect Web Audio API support', () => {
      expect(soundManager.supported).toBe(true);
    });

    it('should detect unsupported environment when AudioContext is undefined', () => {
      const original = global.AudioContext;
      delete global.AudioContext;

      const unsupportedSoundManager = new SoundManager(game);
      expect(unsupportedSoundManager.supported).toBe(false);

      global.AudioContext = original;
    });
  });

  describe('init', () => {
    it('should create audio context on init', () => {
      const result = soundManager.init();
      expect(result).toBe(true);
      expect(soundManager.context).toBeDefined();
      expect(soundManager.initialized).toBe(true);
    });

    it('should create master gain node', () => {
      soundManager.init();
      expect(soundManager.masterGain).toBeDefined();
    });

    it('should return true if already initialized', () => {
      soundManager.init();
      const result = soundManager.init();
      expect(result).toBe(true);
    });

    it('should return false if not supported', () => {
      soundManager.supported = false;
      const result = soundManager.init();
      expect(result).toBe(false);
    });

    it('should handle AudioContext creation failure gracefully', () => {
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext not allowed');
      });

      const failingSoundManager = new SoundManager(game);
      const result = failingSoundManager.init();

      expect(result).toBe(false);
      expect(failingSoundManager.supported).toBe(false);
    });
  });

  describe('resumeContext', () => {
    it('should return false if not supported', async () => {
      soundManager.supported = false;
      const result = await soundManager.resumeContext();
      expect(result).toBe(false);
    });

    it('should initialize context if not already done', async () => {
      await soundManager.resumeContext();
      expect(soundManager.initialized).toBe(true);
    });

    it('should resume suspended context', async () => {
      soundManager.init();
      soundManager.context.state = 'suspended';
      soundManager.context.resume = jest.fn(() => {
        soundManager.context.state = 'running';
        return Promise.resolve();
      });

      const result = await soundManager.resumeContext();
      expect(soundManager.context.resume).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if context is already running', async () => {
      soundManager.init();
      soundManager.context.state = 'running';
      const result = await soundManager.resumeContext();
      expect(result).toBe(true);
    });

    it('should handle resume failure gracefully', async () => {
      soundManager.init();
      soundManager.context.state = 'suspended';
      soundManager.context.resume = jest.fn(() => Promise.reject(new Error('Resume failed')));

      const result = await soundManager.resumeContext();
      expect(result).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear lastPlayTime', () => {
      soundManager.lastPlayTime = { merge: 1000, attack: 2000 };
      soundManager.reset();
      expect(soundManager.lastPlayTime).toEqual({});
    });

    it('should reset activeSounds to 0', () => {
      soundManager.activeSounds = 5;
      soundManager.reset();
      expect(soundManager.activeSounds).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should close audio context', () => {
      soundManager.init();
      const closeMock = soundManager.context.close;
      soundManager.destroy();
      expect(closeMock).toHaveBeenCalled();
    });

    it('should set context to null', () => {
      soundManager.init();
      soundManager.destroy();
      expect(soundManager.context).toBeNull();
    });

    it('should set masterGain to null', () => {
      soundManager.init();
      soundManager.destroy();
      expect(soundManager.masterGain).toBeNull();
    });

    it('should set initialized to false', () => {
      soundManager.init();
      soundManager.destroy();
      expect(soundManager.initialized).toBe(false);
    });

    it('should clear lastPlayTime', () => {
      soundManager.lastPlayTime = { merge: 1000 };
      soundManager.destroy();
      expect(soundManager.lastPlayTime).toEqual({});
    });

    it('should reset activeSounds to 0', () => {
      soundManager.activeSounds = 3;
      soundManager.destroy();
      expect(soundManager.activeSounds).toBe(0);
    });

    it('should handle destroy when context is null', () => {
      soundManager.context = null;
      expect(() => soundManager.destroy()).not.toThrow();
    });
  });

  describe('setMuted', () => {
    it('should set muted state to true', () => {
      soundManager.setMuted(true);
      expect(soundManager.muted).toBe(true);
    });

    it('should set muted state to false', () => {
      soundManager.muted = true;
      soundManager.setMuted(false);
      expect(soundManager.muted).toBe(false);
    });

    it('should update master gain to 0 when muted', () => {
      soundManager.init();
      const setValueMock = soundManager.masterGain.gain.setValueAtTime;
      soundManager.setMuted(true);
      expect(setValueMock).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it('should update master gain to MASTER_VOLUME when unmuted', () => {
      soundManager.init();
      soundManager.muted = true;
      const setValueMock = soundManager.masterGain.gain.setValueAtTime;
      soundManager.setMuted(false);
      expect(setValueMock).toHaveBeenCalledWith(0.3, expect.any(Number));
    });
  });

  describe('toggleMute', () => {
    it('should toggle from unmuted to muted', () => {
      soundManager.muted = false;
      const result = soundManager.toggleMute();
      expect(result).toBe(true);
      expect(soundManager.muted).toBe(true);
    });

    it('should toggle from muted to unmuted', () => {
      soundManager.muted = true;
      const result = soundManager.toggleMute();
      expect(result).toBe(false);
      expect(soundManager.muted).toBe(false);
    });

    it('should return the new muted state', () => {
      const result = soundManager.toggleMute();
      expect(result).toBe(soundManager.muted);
    });
  });

  describe('isMuted', () => {
    it('should return true when muted', () => {
      soundManager.muted = true;
      expect(soundManager.isMuted()).toBe(true);
    });

    it('should return false when not muted', () => {
      soundManager.muted = false;
      expect(soundManager.isMuted()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(soundManager.isReady()).toBe(false);
    });

    it('should return false when context is null after manual override', () => {
      soundManager.init();
      soundManager.context = null;
      expect(soundManager.isReady()).toBeFalsy();
    });

    it('should return false when context is not running', () => {
      soundManager.init();
      soundManager.context.state = 'suspended';
      expect(soundManager.isReady()).toBe(false);
    });

    it('should return false when muted', () => {
      soundManager.init();
      soundManager.context.state = 'running';
      soundManager.muted = true;
      expect(soundManager.isReady()).toBe(false);
    });

    it('should return true when initialized, running, and not muted', () => {
      soundManager.init();
      soundManager.context.state = 'running';
      soundManager.muted = false;
      expect(soundManager.isReady()).toBe(true);
    });
  });

  describe('canPlay', () => {
    it('should return false when at max concurrent sounds', () => {
      soundManager.activeSounds = 8;
      expect(soundManager.canPlay('merge')).toBe(false);
    });

    it('should return false during debounce period', () => {
      performanceNowSpy.mockReturnValue(100);
      soundManager.lastPlayTime['merge'] = 90; // 10ms ago
      expect(soundManager.canPlay('merge')).toBe(false);
    });

    it('should return true after debounce period', () => {
      performanceNowSpy.mockReturnValue(100);
      soundManager.lastPlayTime['merge'] = 50; // 50ms ago (> 30ms debounce)
      expect(soundManager.canPlay('merge')).toBe(true);
    });

    it('should return true for first play of sound type', () => {
      // lastPlayTime is empty, so should be able to play
      expect(soundManager.canPlay('merge')).toBe(true);
    });

    it('should allow different sound types simultaneously', () => {
      performanceNowSpy.mockReturnValue(100);
      soundManager.lastPlayTime['merge'] = 90; // 10ms ago
      expect(soundManager.canPlay('attack')).toBe(true);
    });
  });

  describe('markPlayed', () => {
    it('should record play time for sound type', () => {
      performanceNowSpy.mockReturnValue(1000);
      soundManager.markPlayed('merge');
      expect(soundManager.lastPlayTime['merge']).toBe(1000);
    });

    it('should increment activeSounds', () => {
      soundManager.activeSounds = 2;
      soundManager.markPlayed('attack');
      expect(soundManager.activeSounds).toBe(3);
    });
  });

  describe('markFinished', () => {
    it('should decrement activeSounds', () => {
      soundManager.activeSounds = 3;
      soundManager.markFinished();
      expect(soundManager.activeSounds).toBe(2);
    });

    it('should not go below 0', () => {
      soundManager.activeSounds = 0;
      soundManager.markFinished();
      expect(soundManager.activeSounds).toBe(0);
    });
  });

  describe('createOscillator', () => {
    it('should return null when context is null', () => {
      soundManager.context = null;
      expect(soundManager.createOscillator('sine', 440)).toBeNull();
    });

    it('should create oscillator with correct type', () => {
      soundManager.init();
      const osc = soundManager.createOscillator('square', 440);
      expect(osc).not.toBeNull();
      expect(soundManager.context.createOscillator).toHaveBeenCalled();
    });

    it('should set frequency on oscillator', () => {
      soundManager.init();
      const osc = soundManager.createOscillator('sine', 880);
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, expect.any(Number));
    });
  });

  describe('createGain', () => {
    it('should return null when context is null', () => {
      soundManager.context = null;
      expect(soundManager.createGain(0.5)).toBeNull();
    });

    it('should create gain node', () => {
      soundManager.init();
      const gain = soundManager.createGain(0.5);
      expect(gain).not.toBeNull();
      expect(soundManager.context.createGain).toHaveBeenCalled();
    });

    it('should set initial gain value', () => {
      soundManager.init();
      const gain = soundManager.createGain(0.5);
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });
  });

  describe('scheduleCleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should call markFinished after duration', () => {
      soundManager.activeSounds = 1;
      const markFinishedSpy = jest.spyOn(soundManager, 'markFinished');

      soundManager.scheduleCleanup(null, 0.1); // 100ms

      expect(markFinishedSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(markFinishedSpy).toHaveBeenCalled();
    });
  });

  describe('sound playback methods', () => {
    beforeEach(() => {
      // Initialize sound manager and ensure it's ready
      soundManager.init();
      soundManager.context.state = 'running';
      soundManager.muted = false;
      // Clear any previous play times to avoid debounce
      soundManager.lastPlayTime = {};
      soundManager.activeSounds = 0;
    });

    describe('playMerge', () => {
      it('should not play when muted', () => {
        soundManager.muted = true;
        const initialActiveSounds = soundManager.activeSounds;
        soundManager.playMerge();
        expect(soundManager.activeSounds).toBe(initialActiveSounds);
      });

      it('should not play during debounce', () => {
        performanceNowSpy.mockReturnValue(100);
        soundManager.lastPlayTime['merge'] = 90; // 10ms ago, within debounce
        const initialActiveSounds = soundManager.activeSounds;
        soundManager.playMerge();
        expect(soundManager.activeSounds).toBe(initialActiveSounds);
      });

      it('should create oscillators when ready', () => {
        soundManager.playMerge();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playMerge();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playAttack', () => {
      it('should create oscillator when ready', () => {
        soundManager.playAttack();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playAttack();
        expect(soundManager.activeSounds).toBe(1);
      });

      it('should not play when muted', () => {
        soundManager.muted = true;
        soundManager.playAttack();
        expect(soundManager.activeSounds).toBe(0);
      });
    });

    describe('playHit', () => {
      it('should create oscillator when ready', () => {
        soundManager.playHit();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playHit();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playDeath', () => {
      it('should create oscillators when ready', () => {
        soundManager.playDeath();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playDeath();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playPickup', () => {
      it('should create oscillator when ready', () => {
        soundManager.playPickup();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playPickup();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playPlace', () => {
      it('should create oscillator when ready', () => {
        soundManager.playPlace();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playPlace();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playUIClick', () => {
      it('should create oscillator when ready', () => {
        soundManager.playUIClick();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playUIClick();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playGameStart', () => {
      it('should create oscillators for arpeggio notes', () => {
        soundManager.playGameStart();
        // Should create multiple oscillators for the 4 notes
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playGameStart();
        expect(soundManager.activeSounds).toBe(1);
      });
    });

    describe('playGameOver', () => {
      it('should create oscillators for descending notes', () => {
        soundManager.playGameOver();
        expect(soundManager.context.createOscillator).toHaveBeenCalled();
      });

      it('should increment activeSounds when playing', () => {
        soundManager.playGameOver();
        expect(soundManager.activeSounds).toBe(1);
      });
    });
  });

  describe('graceful degradation', () => {
    it('should work silently when Web Audio API is not supported', () => {
      const originalAC = global.AudioContext;
      delete global.AudioContext;

      const noAudioManager = new SoundManager(game);
      expect(noAudioManager.supported).toBe(false);

      // All sound methods should not throw
      expect(() => noAudioManager.playMerge()).not.toThrow();
      expect(() => noAudioManager.playAttack()).not.toThrow();
      expect(() => noAudioManager.playHit()).not.toThrow();
      expect(() => noAudioManager.playDeath()).not.toThrow();
      expect(() => noAudioManager.playPickup()).not.toThrow();
      expect(() => noAudioManager.playPlace()).not.toThrow();
      expect(() => noAudioManager.playUIClick()).not.toThrow();
      expect(() => noAudioManager.playGameStart()).not.toThrow();
      expect(() => noAudioManager.playGameOver()).not.toThrow();

      global.AudioContext = originalAC;
    });

    it('should handle init failure gracefully', () => {
      global.AudioContext = jest.fn(() => {
        throw new Error('Not allowed');
      });

      const failingManager = new SoundManager(game);
      failingManager.init();

      // Should not throw when playing sounds
      expect(() => failingManager.playMerge()).not.toThrow();
    });
  });

  describe('concurrent sound limiting', () => {
    beforeEach(() => {
      soundManager.init();
      soundManager.context.state = 'running';
      soundManager.muted = false;
      soundManager.lastPlayTime = {};
    });

    it('should prevent sounds when at max concurrent', () => {
      soundManager.activeSounds = 8;
      const initialActiveSounds = soundManager.activeSounds;
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(initialActiveSounds);
    });

    it('should allow sounds below max concurrent', () => {
      soundManager.activeSounds = 7;
      soundManager.playMerge();
      expect(soundManager.context.createOscillator).toHaveBeenCalled();
      expect(soundManager.activeSounds).toBe(8);
    });
  });

  describe('debouncing', () => {
    beforeEach(() => {
      soundManager.init();
      soundManager.context.state = 'running';
      soundManager.muted = false;
      soundManager.lastPlayTime = {};
      soundManager.activeSounds = 0;
    });

    it('should debounce same sound type within debounce period', () => {
      // First play at time 100 (after initial debounce period from time 0)
      performanceNowSpy.mockReturnValue(100);
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(1);

      // Second play at 110ms (10ms later, within 30ms debounce)
      performanceNowSpy.mockReturnValue(110);
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(1); // Still 1, second play was debounced
    });

    it('should allow same sound after debounce period', () => {
      // First play at time 100
      performanceNowSpy.mockReturnValue(100);
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(1);

      // Simulate first sound finishing
      soundManager.activeSounds = 0;

      // Play after debounce period (150ms is 50ms after first play, > 30ms debounce)
      performanceNowSpy.mockReturnValue(150);
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(1);
    });

    it('should allow different sound types during debounce', () => {
      // First play merge at time 100
      performanceNowSpy.mockReturnValue(100);
      soundManager.playMerge();
      expect(soundManager.activeSounds).toBe(1);

      // Play attack at 110ms (within merge debounce, but different sound type)
      performanceNowSpy.mockReturnValue(110);
      soundManager.playAttack();
      expect(soundManager.activeSounds).toBe(2);
    });
  });
});
