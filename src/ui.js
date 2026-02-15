/**
 * Micro Tower Defense - Merge Madness
 * UI system - HUD rendering (timer, coins, tower panel)
 */

import { COLORS } from './renderer.js';
import { Tower, TowerType, TOWER_CONFIG, getAvailableTowerTypes } from './tower.js';

// UI Layout constants
const PANEL_HEIGHT = 80;          // Height of tower selection panel
const PANEL_PADDING = 10;         // Padding inside panel
const TOWER_SLOT_SIZE = 56;       // Size of each tower slot
const TOWER_SLOT_GAP = 12;        // Gap between tower slots
const HUD_HEIGHT = 50;            // Height of top HUD area

/**
 * TowerSlot class - represents a clickable tower slot in the panel
 */
class TowerSlot {
    /**
     * @param {string} towerType - Type of tower (fire, ice, earth)
     * @param {number} tier - Tower tier
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Slot size
     */
    constructor(towerType, tier, x, y, size) {
        this.towerType = towerType;
        this.tier = tier;
        this.x = x;
        this.y = y;
        this.size = size;

        // Create a tower instance for rendering and cloning
        this.tower = new Tower(towerType, tier);
    }

    /**
     * Check if a point is inside this slot
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @returns {boolean} True if point is inside
     */
    containsPoint(px, py) {
        return px >= this.x &&
               px <= this.x + this.size &&
               py >= this.y &&
               py <= this.y + this.size;
    }

    /**
     * Get a clone of this slot's tower for dragging
     * @returns {Tower} New tower instance
     */
    getTower() {
        return this.tower.clone();
    }

    /**
     * Render the tower slot
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        // Draw slot background
        renderer.drawRect(
            this.x,
            this.y,
            this.size,
            this.size,
            COLORS.gridCell
        );

        // Draw slot border
        renderer.drawRectOutline(
            this.x,
            this.y,
            this.size,
            this.size,
            COLORS.gridLine,
            2
        );

        // Draw tower in slot (smaller than slot)
        const config = TOWER_CONFIG[this.towerType];
        renderer.drawTower(
            centerX,
            centerY,
            this.size * 0.7,
            config.color,
            this.tier,
            config.shape
        );
    }
}

/**
 * UI class - manages HUD elements and tower selection panel
 */
export class UI {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;

        // Calculate panel position (bottom of canvas)
        this.panelY = this.canvas.height - PANEL_HEIGHT;
        this.panelWidth = this.canvas.width;
        this.panelHeight = PANEL_HEIGHT;

        // Initialize tower slots
        this.towerSlots = [];
        this.initTowerSlots();

        // Animation state
        this.timerFlash = 0; // Timer flash effect when low
        this.coinPopScale = 1; // Coin pop animation scale
        this.lastCoins = 0; // Track coin changes for animation
    }

    /**
     * Initialize tower slots in the panel
     */
    initTowerSlots() {
        const types = getAvailableTowerTypes();
        const slotCount = types.length;

        // Calculate total width of all slots
        const totalWidth = slotCount * TOWER_SLOT_SIZE + (slotCount - 1) * TOWER_SLOT_GAP;

        // Center slots horizontally in panel
        const startX = (this.canvas.width - totalWidth) / 2;
        const slotY = this.panelY + (this.panelHeight - TOWER_SLOT_SIZE) / 2;

        // Get starting tier from progression if available
        const startingTier = this.game.progression
            ? this.game.progression.getStartingTier()
            : 1;

        // Create slots for each tower type
        for (let i = 0; i < slotCount; i++) {
            const x = startX + i * (TOWER_SLOT_SIZE + TOWER_SLOT_GAP);
            const slot = new TowerSlot(types[i], startingTier, x, slotY, TOWER_SLOT_SIZE);
            this.towerSlots.push(slot);
        }
    }

    /**
     * Reset UI state
     */
    reset() {
        this.timerFlash = 0;
        this.coinPopScale = 1;
        this.lastCoins = 0;

        // Reinitialize slots (in case starting tier changed)
        this.towerSlots = [];
        this.initTowerSlots();
    }

    /**
     * Get a tower from the panel at a position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Tower|null} Tower if clicking on a slot, null otherwise
     */
    getTowerFromPanel(x, y) {
        for (const slot of this.towerSlots) {
            if (slot.containsPoint(x, y)) {
                return slot.getTower();
            }
        }
        return null;
    }

    /**
     * Check if a position is within the tower panel area
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {boolean} True if position is in panel
     */
    isInPanel(x, y) {
        return y >= this.panelY;
    }

    /**
     * Update UI state
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update timer flash effect
        if (this.game.timer <= 10 && this.game.timer > 0) {
            this.timerFlash += dt * 4; // Flash faster as time runs out
        } else {
            this.timerFlash = 0;
        }

        // Update coin pop animation
        if (this.game.runCoins !== this.lastCoins) {
            this.coinPopScale = 1.3; // Pop when coins change
            this.lastCoins = this.game.runCoins;
        }

        // Decay coin pop scale back to 1
        if (this.coinPopScale > 1) {
            this.coinPopScale = Math.max(1, this.coinPopScale - dt * 2);
        }
    }

    /**
     * Render the complete UI
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        this.renderHUD(renderer);
        this.renderTowerPanel(renderer);
    }

    /**
     * Render the top HUD (timer, coins)
     * @param {Object} renderer - Renderer instance
     */
    renderHUD(renderer) {
        // Draw timer at top center
        this.renderTimer(renderer);

        // Draw coin counter at top right
        this.renderCoins(renderer);
    }

    /**
     * Render the countdown timer
     * @param {Object} renderer - Renderer instance
     */
    renderTimer(renderer) {
        const timerText = Math.ceil(this.game.timer).toString();
        const isLowTime = this.game.timer <= 10;

        // Calculate flash alpha for low time warning
        let timerColor = COLORS.text;
        if (isLowTime) {
            // Flash between accent and text color
            const flash = Math.sin(this.timerFlash * Math.PI) * 0.5 + 0.5;
            timerColor = flash > 0.5 ? COLORS.accent : COLORS.text;
        }

        // Draw timer background circle
        const timerX = this.canvas.width / 2;
        const timerY = 28;
        const timerRadius = 22;

        renderer.save();
        renderer.setAlpha(0.3);
        renderer.drawCircle(timerX, timerY, timerRadius, COLORS.ui.panel);
        renderer.restore();

        // Draw timer text
        renderer.drawText(
            timerText,
            timerX,
            timerY,
            timerColor,
            'bold 24px sans-serif',
            'center',
            'middle'
        );

        // Draw "TIME" label below
        renderer.drawText(
            'TIME',
            timerX,
            timerY + 24,
            COLORS.textDim,
            '10px sans-serif',
            'center',
            'top'
        );
    }

    /**
     * Render the coin counter
     * @param {Object} renderer - Renderer instance
     */
    renderCoins(renderer) {
        const coinX = this.canvas.width - 20;
        const coinY = 20;

        // Draw coin icon (small gold circle)
        const iconRadius = 8 * this.coinPopScale;
        renderer.drawCircle(coinX - 50, coinY, iconRadius, COLORS.gold);

        // Draw inner circle for coin detail
        renderer.save();
        renderer.setAlpha(0.5);
        renderer.drawCircle(coinX - 50, coinY, iconRadius * 0.5, '#B8860B');
        renderer.restore();

        // Draw coin count
        const fontSize = Math.round(18 * this.coinPopScale);
        renderer.drawText(
            this.game.runCoins.toString(),
            coinX - 35,
            coinY,
            COLORS.gold,
            `bold ${fontSize}px sans-serif`,
            'left',
            'middle'
        );

        // Draw "COINS" label
        renderer.drawText(
            'COINS',
            coinX - 50,
            coinY + 16,
            COLORS.textDim,
            '10px sans-serif',
            'center',
            'top'
        );
    }

    /**
     * Render the tower selection panel at the bottom
     * @param {Object} renderer - Renderer instance
     */
    renderTowerPanel(renderer) {
        // Draw panel background
        renderer.drawRect(
            0,
            this.panelY,
            this.panelWidth,
            this.panelHeight,
            COLORS.ui.panel
        );

        // Draw top border of panel
        renderer.drawLine(
            0,
            this.panelY,
            this.panelWidth,
            this.panelY,
            COLORS.accent,
            2
        );

        // Draw tower slots
        for (const slot of this.towerSlots) {
            slot.render(renderer);
        }

        // Draw instruction text
        renderer.drawText(
            'Drag towers to grid • Merge same types!',
            this.canvas.width / 2,
            this.panelY + 8,
            COLORS.textDim,
            '11px sans-serif',
            'center',
            'top'
        );
    }

    /**
     * Get panel height (for layout calculations)
     * @returns {number} Panel height in pixels
     */
    getPanelHeight() {
        return this.panelHeight;
    }

    /**
     * Get the Y position of the panel top
     * @returns {number} Panel top Y position
     */
    getPanelY() {
        return this.panelY;
    }
}
