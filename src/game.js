/**
 * Micro Tower Defense - Merge Madness
 * Core game loop and state management
 */

import { Renderer, COLORS } from './renderer.js';
import { Grid } from './grid.js';
import { Tower, TowerType } from './tower.js';
import { InputHandler } from './input.js';
import { EffectsManager } from './effects.js';
import { UI } from './ui.js';
import { EnemyManager } from './enemies.js';
import { Progression } from './progression.js';

// Canvas configuration
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 480;

// Game constants
const GAME_DURATION = 60; // 60-second runs

/**
 * Game states for state machine
 * @enum {string}
 */
export const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

/**
 * Main Game class - manages game loop and state
 */
export class Game {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas element to render to
     */
    constructor(canvas) {
        // Canvas setup
        this.canvas = canvas;
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        // Initialize renderer
        this.renderer = new Renderer(canvas);

        // Game state
        this.state = GameState.MENU;
        this.previousState = null;

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.timer = GAME_DURATION;
        this.isRunning = false;

        // Game data
        this.coins = 0;
        this.runCoins = 0; // Coins earned this run

        // Initialize game systems
        this.grid = new Grid(this);
        this.effects = new EffectsManager(this);
        this.input = new InputHandler(this);
        this.ui = new UI(this);
        this.enemies = new EnemyManager(this);

        // Initialize progression system with localStorage persistence
        this.progression = new Progression();

        // Load total coins from progression
        this.coins = this.progression.getTotalCoins();

        // Handle visibility change to pause when tab is hidden
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Bind loop method
        this.loop = this.loop.bind(this);
    }

    /**
     * Initialize the game and start the loop
     */
    init() {
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    /**
     * Main game loop - called every frame
     * @param {number} currentTime - Current timestamp from requestAnimationFrame
     */
    loop(currentTime) {
        // Calculate delta time in seconds
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap delta time to prevent large jumps after tab switch
        if (this.deltaTime > 0.1) {
            this.deltaTime = 0.016; // ~60fps
        }

        // Update game logic
        this.update(this.deltaTime);

        // Render
        this.render();

        // Continue loop if running
        if (this.isRunning) {
            requestAnimationFrame(this.loop);
        }
    }

    /**
     * Update game state based on delta time
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        switch (this.state) {
            case GameState.MENU:
                this.updateMenu(dt);
                break;
            case GameState.PLAYING:
                this.updatePlaying(dt);
                break;
            case GameState.PAUSED:
                // No updates while paused
                break;
            case GameState.GAME_OVER:
                this.updateGameOver(dt);
                break;
        }
    }

    /**
     * Update logic for menu state
     * @param {number} dt - Delta time in seconds
     */
    updateMenu(dt) {
        // Menu animations or input handling will be added later
    }

    /**
     * Update logic for playing state
     * @param {number} dt - Delta time in seconds
     */
    updatePlaying(dt) {
        // Update timer
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.endRun();
            return;
        }

        // Update effects (screen shake, particles)
        if (this.effects) {
            this.effects.update(dt);
        }

        // Update enemies
        if (this.enemies) {
            this.enemies.update(dt);
        }

        // Update towers (combat)
        this.updateTowers(dt);

        // Update UI
        if (this.ui) {
            this.ui.update(dt);
        }
    }

    /**
     * Update all towers (combat logic)
     * Towers attack enemies in range and deal damage
     * @param {number} dt - Delta time in seconds
     */
    updateTowers(dt) {
        if (!this.grid || !this.enemies) {
            return;
        }

        // Get all active enemies
        const activeEnemies = this.enemies.getEnemies();

        // Get all towers on the grid
        const towers = this.grid.getAllTowers();

        // Update each tower
        for (const { tower } of towers) {
            if (!tower || tower.isDragging) {
                continue;
            }

            // Update tower and check if it fired
            const projectile = tower.update(dt, activeEnemies);

            if (projectile && projectile.target) {
                // Apply damage to target
                this.handleTowerAttack(projectile);
            }
        }
    }

    /**
     * Handle a tower attack hitting an enemy
     * @param {Object} projectile - Projectile data from tower
     */
    handleTowerAttack(projectile) {
        const { target, damage, type } = projectile;

        if (!target || target.isDead) {
            return;
        }

        // Spawn hit effect at enemy position
        if (this.effects) {
            const hitColor = this.getTowerHitColor(type);
            this.effects.spawnHitEffect(target.x, target.y, hitColor);
        }

        // Apply damage to enemy
        const killed = target.takeDamage(damage);

        if (killed) {
            // Enemy was killed - award coins
            this.addCoins(target.reward);

            // Spawn death effect
            if (this.effects) {
                this.effects.spawnEnemyDeathEffect(
                    target.x,
                    target.y,
                    target.config.color
                );
            }
        }
    }

    /**
     * Get the hit effect color for a tower type
     * @param {string} type - Tower type
     * @returns {string} Color for hit effect
     */
    getTowerHitColor(type) {
        switch (type) {
            case TowerType.FIRE:
                return '#ff6644';
            case TowerType.ICE:
                return '#66ccff';
            case TowerType.EARTH:
                return '#88cc44';
            default:
                return '#ffffff';
        }
    }

    /**
     * Update logic for game over state
     * @param {number} dt - Delta time in seconds
     */
    updateGameOver(dt) {
        // Game over animations or input handling will be added later
    }

    /**
     * Render the current game state
     */
    render() {
        // Clear canvas
        this.renderer.clear(COLORS.background);

        // Apply screen shake if effects manager exists
        if (this.effects) {
            const shake = this.effects.getShakeOffset();
            this.renderer.setShakeOffset(shake.x, shake.y);
            this.renderer.applyShakeTransform();
        }

        switch (this.state) {
            case GameState.MENU:
                this.renderMenu();
                break;
            case GameState.PLAYING:
                this.renderPlaying();
                break;
            case GameState.PAUSED:
                this.renderPlaying();
                this.renderPauseOverlay();
                break;
            case GameState.GAME_OVER:
                this.renderGameOver();
                break;
        }

        // Reset transform after rendering
        this.renderer.resetTransform();
    }

    /**
     * Render menu state
     */
    renderMenu() {
        // Draw title
        this.renderer.drawText(
            'MICRO TD',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 3,
            COLORS.accent,
            'bold 36px sans-serif',
            'center',
            'middle'
        );

        // Draw subtitle
        this.renderer.drawText(
            'Merge Madness',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 3 + 40,
            COLORS.text,
            '20px sans-serif',
            'center',
            'middle'
        );

        // Draw instruction
        this.renderer.drawText(
            'Click to Start',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.6,
            COLORS.textDim,
            '16px sans-serif',
            'center',
            'middle'
        );

        // Draw total coins if progression exists
        if (this.progression) {
            this.renderer.drawText(
                `Total Coins: ${this.coins}`,
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT - 40,
                COLORS.gold,
                '14px sans-serif',
                'center',
                'middle'
            );
        }
    }

    /**
     * Render playing state
     */
    renderPlaying() {
        // Draw the grid
        this.grid.render(this.renderer);

        // Draw enemies
        if (this.enemies) {
            this.enemies.render(this.renderer);
        }

        // Draw effects (particles)
        if (this.effects) {
            this.effects.render(this.renderer);
        }

        // Draw dragged tower (on top of grid, below UI)
        if (this.input) {
            this.input.render(this.renderer);
        }

        // Draw UI (timer, coins, tower panel)
        if (this.ui) {
            this.ui.render(this.renderer);
        }
    }

    /**
     * Render pause overlay
     */
    renderPauseOverlay() {
        // Semi-transparent overlay
        this.renderer.save();
        this.renderer.setAlpha(0.7);
        this.renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#000000');
        this.renderer.restore();

        // Pause text
        this.renderer.drawText(
            'PAUSED',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2,
            COLORS.text,
            'bold 32px sans-serif',
            'center',
            'middle'
        );
    }

    /**
     * Render game over state
     */
    renderGameOver() {
        // Draw background
        this.renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLORS.background);

        // Draw game over text
        this.renderer.drawText(
            'GAME OVER',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 3,
            COLORS.accent,
            'bold 32px sans-serif',
            'center',
            'middle'
        );

        // Draw score
        this.renderer.drawText(
            `Coins Earned: ${this.runCoins}`,
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2,
            COLORS.gold,
            'bold 24px sans-serif',
            'center',
            'middle'
        );

        // Draw instruction
        this.renderer.drawText(
            'Click to Play Again',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.7,
            COLORS.textDim,
            '16px sans-serif',
            'center',
            'middle'
        );
    }

    /**
     * Start a new game run
     */
    startRun() {
        this.previousState = this.state;
        this.state = GameState.PLAYING;
        this.timer = GAME_DURATION;
        this.runCoins = 0;

        // Reset game systems
        if (this.grid) {
            this.grid.reset();
        }
        if (this.enemies) {
            this.enemies.reset();
        }
        if (this.effects) {
            this.effects.reset();
        }
        if (this.input) {
            this.input.clearDragState();
        }
        if (this.ui) {
            this.ui.reset();
        }

        // Add test towers to verify drag-drop functionality
        this.spawnTestTowers();
    }

    /**
     * Spawn test towers to verify rendering works correctly
     * This is temporary and will be removed once drag-drop is implemented
     */
    spawnTestTowers() {
        // Place one of each tower type at different tiers for testing
        // Fire tower (diamond shape, red) - Tier 1
        const fireTower = new Tower(TowerType.FIRE, 1);
        this.grid.placeTower(0, 0, fireTower);

        // Ice tower (circle shape, blue) - Tier 1
        const iceTower = new Tower(TowerType.ICE, 1);
        this.grid.placeTower(2, 0, iceTower);

        // Earth tower (square shape, green) - Tier 1
        const earthTower = new Tower(TowerType.EARTH, 1);
        this.grid.placeTower(4, 0, earthTower);

        // Higher tier examples (row 2)
        // Fire tower Tier 2
        const fireTower2 = new Tower(TowerType.FIRE, 2);
        this.grid.placeTower(0, 2, fireTower2);

        // Ice tower Tier 2
        const iceTower2 = new Tower(TowerType.ICE, 2);
        this.grid.placeTower(2, 2, iceTower2);

        // Earth tower Tier 3
        const earthTower3 = new Tower(TowerType.EARTH, 3);
        this.grid.placeTower(4, 2, earthTower3);
    }

    /**
     * End the current game run
     */
    endRun() {
        this.previousState = this.state;
        this.state = GameState.GAME_OVER;

        // Save run coins to progression (persists to localStorage)
        if (this.progression) {
            this.progression.addCoins(this.runCoins);
            // Update total coins from progression to ensure consistency
            this.coins = this.progression.getTotalCoins();
        } else {
            // Fallback if no progression (shouldn't happen)
            this.coins += this.runCoins;
        }
    }

    /**
     * Add coins to the current run
     * Applies coin bonus from progression upgrades
     * @param {number} amount - Base number of coins to add
     */
    addCoins(amount) {
        // Apply coin bonus from progression upgrades
        const bonus = this.progression ? this.progression.getCoinBonus() : 1;
        const finalAmount = Math.floor(amount * bonus);
        this.runCoins += finalAmount;
    }

    /**
     * Change game state
     * @param {GameState} newState - New state to transition to
     */
    setState(newState) {
        this.previousState = this.state;
        this.state = newState;
    }

    /**
     * Pause the game
     */
    pause() {
        if (this.state === GameState.PLAYING) {
            this.previousState = this.state;
            this.state = GameState.PAUSED;
        }
    }

    /**
     * Resume the game from pause
     */
    resume() {
        if (this.state === GameState.PAUSED) {
            this.state = this.previousState || GameState.PLAYING;
        }
    }

    /**
     * Handle visibility change (pause when tab is hidden)
     */
    handleVisibilityChange() {
        if (document.hidden && this.state === GameState.PLAYING) {
            this.pause();
        }
    }

    /**
     * Handle click/tap events (temporary - will be replaced by input.js)
     * @param {MouseEvent|Touch} event - Click or touch event
     */
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        switch (this.state) {
            case GameState.MENU:
                this.startRun();
                break;
            case GameState.PAUSED:
                this.resume();
                break;
            case GameState.GAME_OVER:
                this.setState(GameState.MENU);
                break;
        }
    }

    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // Clean up input handler
        if (this.input) {
            this.input.destroy();
        }
    }

    /**
     * Get the current game state
     * @returns {GameState}
     */
    getState() {
        return this.state;
    }

    /**
     * Check if game is in playing state
     * @returns {boolean}
     */
    isPlaying() {
        return this.state === GameState.PLAYING;
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');

    if (!canvas) {
        return;
    }

    // Create and initialize game
    const game = new Game(canvas);
    game.init();

    // InputHandler handles all input - no additional click handlers needed

    // Make game accessible globally for debugging
    window.game = game;
});
