/**
 * Micro Tower Defense - Merge Madness
 * Effects system - screen shake, particles, and visual feedback
 */

import { COLORS } from './renderer.js';

// Effect configuration constants
const SHAKE_AMPLITUDE = 8;       // 8px screen shake
const SHAKE_DURATION = 0.15;     // 150ms shake duration
const PARTICLE_COUNT = 12;       // Number of particles per burst
const PARTICLE_SPEED = 200;      // Initial particle velocity (pixels/sec)
const PARTICLE_LIFE = 0.5;       // Particle lifetime in seconds
const PARTICLE_GRAVITY = 400;    // Gravity acceleration (pixels/sec²)
const PARTICLE_SIZE = 4;         // Base particle radius

/**
 * Particle class - represents a single particle effect
 */
class Particle {
    /**
     * @param {number} x - Starting X position
     * @param {number} y - Starting Y position
     * @param {number} vx - X velocity
     * @param {number} vy - Y velocity
     * @param {string} color - Particle color
     * @param {number} life - Lifetime in seconds
     * @param {number} size - Particle size (radius)
     */
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }

    /**
     * Update particle position and lifetime
     * @param {number} dt - Delta time in seconds
     * @returns {boolean} True if particle is still alive
     */
    update(dt) {
        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply gravity
        this.vy += PARTICLE_GRAVITY * dt;

        // Reduce lifetime
        this.life -= dt;

        return this.life > 0;
    }

    /**
     * Get the current alpha based on remaining life
     * @returns {number} Alpha value (0-1)
     */
    getAlpha() {
        return Math.max(0, this.life / this.maxLife);
    }
}

/**
 * EffectsManager class - manages screen shake and particle effects
 */
export class EffectsManager {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;

        // Particle system
        this.particles = [];

        // Screen shake state
        this.shakeAmount = 0;
        this.shakeDuration = 0;
    }

    /**
     * Reset all effects to initial state
     */
    reset() {
        this.particles = [];
        this.shakeAmount = 0;
        this.shakeDuration = 0;
    }

    /**
     * Spawn a merge burst effect at the specified grid cell
     * Creates screen shake and gold coin particles
     * @param {number} col - Column index
     * @param {number} row - Row index
     */
    spawnMergeBurst(col, row) {
        // Trigger screen shake
        this.shakeAmount = SHAKE_AMPLITUDE;
        this.shakeDuration = SHAKE_DURATION;

        // Calculate center position in pixels
        const grid = this.game.grid;
        const center = grid.getCellCenter(col, row);
        const x = center.x;
        const y = center.y;

        // Spawn particles in a radial burst pattern
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Calculate angle for even distribution
            const angle = (Math.PI * 2 / PARTICLE_COUNT) * i;

            // Add some randomness to velocity
            const speedVariation = 0.8 + Math.random() * 0.4; // 80-120% of base speed
            const speed = PARTICLE_SPEED * speedVariation;

            // Calculate velocity components
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            // Create gold coin particle
            const particle = new Particle(
                x,
                y,
                vx,
                vy,
                COLORS.gold,
                PARTICLE_LIFE,
                PARTICLE_SIZE
            );

            this.particles.push(particle);
        }
    }

    /**
     * Spawn particles for tower tier-up effect (additional sparkles)
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @param {number} tier - New tower tier (affects particle count)
     */
    spawnTierUpEffect(col, row, tier) {
        const grid = this.game.grid;
        const center = grid.getCellCenter(col, row);
        const x = center.x;
        const y = center.y;

        // More particles for higher tiers
        const count = 4 + tier * 2;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;

            const particle = new Particle(
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 100, // Bias upward
                '#ffffff', // White sparkles
                0.3 + Math.random() * 0.2,
                2 + Math.random() * 2
            );

            this.particles.push(particle);
        }
    }

    /**
     * Trigger screen shake effect
     * @param {number} [amount=SHAKE_AMPLITUDE] - Shake amplitude in pixels
     * @param {number} [duration=SHAKE_DURATION] - Shake duration in seconds
     */
    shake(amount = SHAKE_AMPLITUDE, duration = SHAKE_DURATION) {
        // Use the larger of current or new shake values
        this.shakeAmount = Math.max(this.shakeAmount, amount);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }

    /**
     * Update all effects
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update screen shake
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            if (this.shakeDuration <= 0) {
                this.shakeDuration = 0;
                this.shakeAmount = 0;
            }
        }

        // Update particles (filter out dead ones)
        this.particles = this.particles.filter(particle => particle.update(dt));
    }

    /**
     * Get the current screen shake offset
     * Returns random offset within shake amplitude
     * @returns {Object} {x, y} offset in pixels
     */
    getShakeOffset() {
        if (this.shakeDuration <= 0 || this.shakeAmount <= 0) {
            return { x: 0, y: 0 };
        }

        // Calculate decay factor (shake reduces over time)
        const decay = this.shakeDuration / SHAKE_DURATION;
        const currentAmount = this.shakeAmount * decay;

        return {
            x: (Math.random() - 0.5) * currentAmount * 2,
            y: (Math.random() - 0.5) * currentAmount * 2
        };
    }

    /**
     * Render all particles
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        for (const particle of this.particles) {
            const alpha = particle.getAlpha();
            renderer.drawParticle(
                particle.x,
                particle.y,
                particle.size,
                particle.color,
                alpha
            );
        }
    }

    /**
     * Get the current particle count (for debugging/stats)
     * @returns {number} Number of active particles
     */
    getParticleCount() {
        return this.particles.length;
    }

    /**
     * Check if any effects are currently active
     * @returns {boolean} True if effects are playing
     */
    isActive() {
        return this.shakeDuration > 0 || this.particles.length > 0;
    }

    /**
     * Spawn a hit effect at the specified position
     * Creates small particles at the impact point
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     * @param {string} color - Color of the hit effect
     */
    spawnHitEffect(x, y, color) {
        const count = 4;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 50;

            const particle = new Particle(
                x + (Math.random() - 0.5) * 10,
                y + (Math.random() - 0.5) * 10,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                0.2 + Math.random() * 0.1,
                2 + Math.random() * 2
            );

            this.particles.push(particle);
        }
    }

    /**
     * Spawn an enemy death effect at the specified position
     * Creates a burst of particles when an enemy dies
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     * @param {string} color - Color of the enemy
     */
    spawnEnemyDeathEffect(x, y, color) {
        // Small screen shake
        this.shake(4, 0.1);

        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const speedVariation = 0.7 + Math.random() * 0.6;
            const speed = 120 * speedVariation;

            const particle = new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                0.3 + Math.random() * 0.2,
                3 + Math.random() * 2
            );

            this.particles.push(particle);
        }
    }
}
