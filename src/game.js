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
    UPGRADES: 'upgrades',
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
            case GameState.UPGRADES:
                this.updateUpgrades(dt);
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
     * Update logic for upgrades state
     * @param {number} dt - Delta time in seconds
     */
    updateUpgrades(dt) {
        // Upgrade menu animations handled by UI
        if (this.ui && this.ui.upgradeMenu) {
            this.ui.upgradeMenu.update(dt);
        }
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
            case GameState.UPGRADES:
                this.renderUpgrades();
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

        // Draw Play button
        const playButtonY = CANVAS_HEIGHT * 0.55;
        this.drawMenuButton('PLAY', CANVAS_WIDTH / 2, playButtonY, 'play');

        // Draw Upgrades button
        const upgradesButtonY = CANVAS_HEIGHT * 0.68;
        this.drawMenuButton('UPGRADES', CANVAS_WIDTH / 2, upgradesButtonY, 'upgrades');

        // Draw total coins if progression exists
        if (this.progression) {
            // Draw coin icon
            const coinY = CANVAS_HEIGHT - 35;
            this.renderer.drawCircle(CANVAS_WIDTH / 2 - 50, coinY, 8, COLORS.gold);
            this.renderer.save();
            this.renderer.setAlpha(0.5);
            this.renderer.drawCircle(CANVAS_WIDTH / 2 - 50, coinY, 4, '#B8860B');
            this.renderer.restore();

            this.renderer.drawText(
                `${this.coins}`,
                CANVAS_WIDTH / 2 - 35,
                coinY,
                COLORS.gold,
                'bold 16px sans-serif',
                'left',
                'middle'
            );
        }
    }

    /**
     * Draw a menu button
     * @param {string} text - Button text
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {string} id - Button identifier
     */
    drawMenuButton(text, x, y, id) {
        const buttonWidth = 150;
        const buttonHeight = 40;
        const buttonX = x - buttonWidth / 2;
        const buttonY = y - buttonHeight / 2;

        // Store button bounds for click detection
        if (!this.menuButtons) {
            this.menuButtons = {};
        }
        this.menuButtons[id] = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };

        // Draw button background
        this.renderer.drawRect(buttonX, buttonY, buttonWidth, buttonHeight, COLORS.ui.button);

        // Draw button border
        this.renderer.drawRectOutline(buttonX, buttonY, buttonWidth, buttonHeight, COLORS.accent, 2);

        // Draw button text
        this.renderer.drawText(
            text,
            x,
            y,
            COLORS.text,
            'bold 16px sans-serif',
            'center',
            'middle'
        );
    }

    /**
     * Get menu button at position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {string|null} Button ID or null
     */
    getMenuButtonAt(x, y) {
        if (!this.menuButtons) {
            return null;
        }

        for (const [id, bounds] of Object.entries(this.menuButtons)) {
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                return id;
            }
        }
        return null;
    }

    /**
     * Render upgrades state
     */
    renderUpgrades() {
        if (this.ui && this.ui.upgradeMenu) {
            this.ui.upgradeMenu.render(this.renderer);
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

        // Spawn starting towers based on progression upgrades
        this.spawnStartingTowers();
    }

    /**
     * Spawn starting towers based on progression upgrades
     * Places bonus towers on the grid at the starting tier
     */
    spawnStartingTowers() {
        // Get starting tier and tower count from progression
        const startingTier = this.progression
            ? this.progression.getStartingTier()
            : 1;
        const startingTowerCount = this.progression
            ? this.progression.getStartingTowerCount()
            : 0;

        // No starting towers to spawn if upgrade not purchased
        if (startingTowerCount <= 0) {
            return;
        }

        // Available tower types to randomly select from
        const towerTypes = [TowerType.FIRE, TowerType.ICE, TowerType.EARTH];

        // Predefined starting positions (spread across the grid)
        const startingPositions = [
            { col: 0, row: 0 },
            { col: 4, row: 0 }
        ];

        // Spawn the appropriate number of starting towers
        for (let i = 0; i < startingTowerCount && i < startingPositions.length; i++) {
            const pos = startingPositions[i];
            const type = towerTypes[i % towerTypes.length];

            // Create tower at the starting tier
            const tower = new Tower(type, startingTier);
            this.grid.placeTower(pos.col, pos.row, tower);
        }
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
