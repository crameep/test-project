/**
 * Micro Tower Defense - Merge Madness
 * Enemy spawning and path movement system
 */

import { COLORS } from './renderer.js';

// Enemy configuration constants
const ENEMY_SIZE = 24;                  // Enemy size in pixels
const ENEMY_BASE_HEALTH = 50;           // Base health for tier 1 enemies
const ENEMY_BASE_SPEED = 40;            // Base speed in pixels per second
const SPAWN_INTERVAL = 2.0;             // Seconds between spawns
const ENEMIES_PER_WAVE = 5;             // Enemies per wave
const WAVE_INTERVAL = 10.0;             // Seconds between waves
const MAX_ENEMIES = 20;                 // Maximum concurrent enemies

// Enemy types configuration
const ENEMY_TYPES = {
    basic: {
        color: '#aa4444',
        healthMultiplier: 1.0,
        speedMultiplier: 1.0,
        reward: 5
    },
    fast: {
        color: '#44aa44',
        healthMultiplier: 0.6,
        speedMultiplier: 1.8,
        reward: 8
    },
    tank: {
        color: '#4444aa',
        healthMultiplier: 2.5,
        speedMultiplier: 0.6,
        reward: 15
    }
};

/**
 * Enemy class - represents a single enemy unit
 */
class Enemy {
    /**
     * @param {string} type - Enemy type (basic, fast, tank)
     * @param {number} tier - Enemy tier (increases with waves)
     * @param {Array} path - Array of waypoints [{x, y}, ...]
     */
    constructor(type, tier, path) {
        // Validate enemy type
        if (!ENEMY_TYPES[type]) {
            type = 'basic';
        }

        // Core properties
        this.type = type;
        this.tier = tier;
        this.config = ENEMY_TYPES[type];

        // Path following
        this.path = path;
        this.pathIndex = 0;

        // Position (start at first waypoint)
        this.x = path[0].x;
        this.y = path[0].y;

        // Calculate tier-scaled stats
        const tierMultiplier = 1 + (tier - 1) * 0.5;
        this.maxHealth = Math.floor(ENEMY_BASE_HEALTH * this.config.healthMultiplier * tierMultiplier);
        this.health = this.maxHealth;
        this.speed = ENEMY_BASE_SPEED * this.config.speedMultiplier;
        this.reward = Math.floor(this.config.reward * tierMultiplier);

        // State
        this.isDead = false;
        this.reachedEnd = false;
    }

    /**
     * Update enemy position and state
     * @param {number} dt - Delta time in seconds
     * @returns {boolean} True if enemy is still active
     */
    update(dt) {
        if (this.isDead || this.reachedEnd) {
            return false;
        }

        // Get current target waypoint
        if (this.pathIndex >= this.path.length) {
            this.reachedEnd = true;
            return false;
        }

        const target = this.path[this.pathIndex];

        // Calculate direction to target
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if reached waypoint
        if (distance < 2) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.reachedEnd = true;
                return false;
            }
            return true;
        }

        // Move towards target
        const moveDistance = this.speed * dt;
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;

        this.x += moveX;
        this.y += moveY;

        return true;
    }

    /**
     * Apply damage to the enemy
     * @param {number} damage - Damage amount
     * @returns {boolean} True if enemy was killed
     */
    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            return true;
        }
        return false;
    }

    /**
     * Get health as percentage (0-1)
     * @returns {number} Health percentage
     */
    getHealthPercent() {
        return this.health / this.maxHealth;
    }

    /**
     * Render the enemy
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        if (this.isDead) return;

        renderer.drawEnemy(
            this.x,
            this.y,
            ENEMY_SIZE,
            this.config.color,
            this.getHealthPercent()
        );
    }
}

/**
 * EnemyManager class - handles enemy spawning, updating, and wave management
 */
export class EnemyManager {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;

        // Enemy collection
        this.enemies = [];

        // Wave management
        this.currentWave = 1;
        this.enemiesSpawnedThisWave = 0;
        this.waveTimer = 0;

        // Spawn timing
        this.spawnTimer = 0;
        this.isSpawning = true;

        // Statistics
        this.totalKills = 0;
        this.totalEscaped = 0;

        // Generate the path through the grid
        this.path = this.generatePath();
    }

    /**
     * Generate a simple linear path through the grid
     * Enemies enter from left, exit from right
     * @returns {Array} Array of waypoints [{x, y}, ...]
     */
    generatePath() {
        const grid = this.game.grid;
        const path = [];

        // Calculate vertical center of grid
        const middleRow = Math.floor(grid.rows / 2);

        // Start point: left of grid
        const startX = grid.offsetX - ENEMY_SIZE;
        const startY = grid.offsetY + (middleRow * grid.cellSize) + (grid.cellSize / 2);
        path.push({ x: startX, y: startY });

        // Create waypoints through the grid (horizontal path through middle)
        for (let col = 0; col <= grid.cols; col++) {
            const x = grid.offsetX + (col * grid.cellSize);
            path.push({ x, y: startY });
        }

        // End point: right of grid
        const endX = grid.offsetX + grid.width + ENEMY_SIZE;
        path.push({ x: endX, y: startY });

        return path;
    }

    /**
     * Reset the enemy manager to initial state
     */
    reset() {
        this.enemies = [];
        this.currentWave = 1;
        this.enemiesSpawnedThisWave = 0;
        this.waveTimer = 0;
        this.spawnTimer = SPAWN_INTERVAL * 0.5; // Start spawning sooner
        this.isSpawning = true;
        this.totalKills = 0;
        this.totalEscaped = 0;

        // Regenerate path in case grid changed
        this.path = this.generatePath();
    }

    /**
     * Spawn a new enemy
     */
    spawnEnemy() {
        if (this.enemies.length >= MAX_ENEMIES) {
            return;
        }

        // Determine enemy type based on wave
        let type = 'basic';
        const roll = Math.random();
        if (this.currentWave >= 3 && roll > 0.7) {
            type = 'tank';
        } else if (this.currentWave >= 2 && roll > 0.5) {
            type = 'fast';
        }

        // Create enemy with path copy
        const enemy = new Enemy(type, this.currentWave, [...this.path]);
        this.enemies.push(enemy);
        this.enemiesSpawnedThisWave++;
    }

    /**
     * Update all enemies and spawn logic
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update spawn timer
        this.spawnTimer -= dt;

        // Spawn new enemy if timer reached and still spawning this wave
        if (this.spawnTimer <= 0 && this.isSpawning) {
            if (this.enemiesSpawnedThisWave < ENEMIES_PER_WAVE) {
                this.spawnEnemy();
                this.spawnTimer = SPAWN_INTERVAL;
            } else {
                // Wave complete, wait for next wave
                this.isSpawning = false;
                this.waveTimer = WAVE_INTERVAL;
            }
        }

        // Wave timer for next wave
        if (!this.isSpawning) {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) {
                this.currentWave++;
                this.enemiesSpawnedThisWave = 0;
                this.isSpawning = true;
                this.spawnTimer = SPAWN_INTERVAL * 0.5;
            }
        }

        // Update all enemies
        const activeEnemies = [];
        for (const enemy of this.enemies) {
            const isActive = enemy.update(dt);

            if (enemy.isDead) {
                this.totalKills++;
                // Could trigger death effects here
            } else if (enemy.reachedEnd) {
                this.totalEscaped++;
                // Could trigger leak effects or damage player
            } else if (isActive) {
                activeEnemies.push(enemy);
            } else {
                // Enemy still active but update returned false
                activeEnemies.push(enemy);
            }
        }

        // Keep only active enemies
        this.enemies = activeEnemies.filter(e => !e.isDead && !e.reachedEnd);
    }

    /**
     * Get all active enemies (for tower targeting)
     * @returns {Array} Array of active enemy objects
     */
    getEnemies() {
        return this.enemies.filter(e => !e.isDead && !e.reachedEnd);
    }

    /**
     * Get enemy count
     * @returns {number} Number of active enemies
     */
    getEnemyCount() {
        return this.enemies.length;
    }

    /**
     * Get current wave number
     * @returns {number} Current wave
     */
    getCurrentWave() {
        return this.currentWave;
    }

    /**
     * Render all enemies
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        // Draw path indicator (subtle line showing enemy route)
        this.renderPath(renderer);

        // Draw all enemies
        for (const enemy of this.enemies) {
            enemy.render(renderer);
        }
    }

    /**
     * Render the enemy path (subtle indicator)
     * @param {Object} renderer - Renderer instance
     */
    renderPath(renderer) {
        if (this.path.length < 2) return;

        renderer.save();
        renderer.setAlpha(0.15);

        // Draw path line
        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];
            renderer.drawLine(p1.x, p1.y, p2.x, p2.y, COLORS.accent, 3);
        }

        renderer.restore();
    }
}
