/**
 * Micro Tower Defense - Merge Madness
 * UI system - HUD rendering (timer, coins, tower panel)
 */

import { COLORS } from './renderer.js';
import { Tower, TowerType, TOWER_CONFIG, getAvailableTowerTypes } from './tower.js';
import { UPGRADES } from './progression.js';

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

        // Initialize upgrade menu
        this.upgradeMenu = new UpgradeMenu(game);
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

// Upgrade menu layout constants
const UPGRADE_MENU_PADDING = 20;
const UPGRADE_ITEM_HEIGHT = 80;
const UPGRADE_ITEM_GAP = 12;
const BACK_BUTTON_HEIGHT = 40;

/**
 * UpgradeMenu class - handles the upgrade shop screen
 */
export class UpgradeMenu {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;

        // Animation state
        this.purchaseFlash = {};
        this.selectedUpgrade = null;

        // Button bounds for click detection
        this.upgradeButtons = [];
        this.backButton = null;
    }

    /**
     * Update upgrade menu state
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Decay purchase flash animations
        for (const key in this.purchaseFlash) {
            if (this.purchaseFlash[key] > 0) {
                this.purchaseFlash[key] = Math.max(0, this.purchaseFlash[key] - dt * 3);
            }
        }
    }

    /**
     * Render the upgrade menu
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        // Reset button tracking
        this.upgradeButtons = [];

        // Draw background
        renderer.drawRect(0, 0, this.canvas.width, this.canvas.height, COLORS.background);

        // Draw title
        renderer.drawText(
            'UPGRADES',
            this.canvas.width / 2,
            40,
            COLORS.accent,
            'bold 28px sans-serif',
            'center',
            'middle'
        );

        // Draw coin balance
        this.renderCoinBalance(renderer);

        // Draw upgrade items
        this.renderUpgradeItems(renderer);

        // Draw back button
        this.renderBackButton(renderer);
    }

    /**
     * Render the current coin balance
     * @param {Object} renderer - Renderer instance
     */
    renderCoinBalance(renderer) {
        const y = 75;
        const totalCoins = this.game.progression.getTotalCoins();

        // Draw coin icon
        renderer.drawCircle(this.canvas.width / 2 - 40, y, 10, COLORS.gold);
        renderer.save();
        renderer.setAlpha(0.5);
        renderer.drawCircle(this.canvas.width / 2 - 40, y, 5, '#B8860B');
        renderer.restore();

        // Draw coin count
        renderer.drawText(
            `${totalCoins}`,
            this.canvas.width / 2 - 25,
            y,
            COLORS.gold,
            'bold 20px sans-serif',
            'left',
            'middle'
        );
    }

    /**
     * Render all upgrade items
     * @param {Object} renderer - Renderer instance
     */
    renderUpgradeItems(renderer) {
        const upgradeInfo = this.game.progression.getUpgradeInfo();
        const startY = 110;

        upgradeInfo.forEach((upgrade, index) => {
            const y = startY + index * (UPGRADE_ITEM_HEIGHT + UPGRADE_ITEM_GAP);
            this.renderUpgradeItem(renderer, upgrade, y, index);
        });
    }

    /**
     * Render a single upgrade item
     * @param {Object} renderer - Renderer instance
     * @param {Object} upgrade - Upgrade info object
     * @param {number} y - Y position
     * @param {number} index - Item index
     */
    renderUpgradeItem(renderer, upgrade, y, index) {
        const x = UPGRADE_MENU_PADDING;
        const width = this.canvas.width - UPGRADE_MENU_PADDING * 2;
        const height = UPGRADE_ITEM_HEIGHT;

        // Store button bounds
        this.upgradeButtons.push({
            id: upgrade.id,
            x: x,
            y: y,
            width: width,
            height: height
        });

        // Background color based on state
        let bgColor = COLORS.ui.panel;
        if (this.purchaseFlash[upgrade.id] > 0) {
            // Flash green on successful purchase
            bgColor = '#2d5a3d';
        } else if (upgrade.isMaxed) {
            bgColor = '#1a2a1a'; // Darker for maxed
        }

        // Draw item background
        renderer.drawRect(x, y, width, height, bgColor);

        // Draw border
        const borderColor = upgrade.canPurchase ? COLORS.accent : COLORS.gridLine;
        renderer.drawRectOutline(x, y, width, height, borderColor, 2);

        // Draw upgrade name
        renderer.drawText(
            upgrade.name,
            x + 15,
            y + 18,
            COLORS.text,
            'bold 16px sans-serif',
            'left',
            'middle'
        );

        // Draw level indicator
        const levelText = upgrade.isMaxed
            ? 'MAX'
            : `Level ${upgrade.currentLevel}/${upgrade.maxLevel}`;
        renderer.drawText(
            levelText,
            x + width - 15,
            y + 18,
            upgrade.isMaxed ? COLORS.gold : COLORS.textDim,
            '14px sans-serif',
            'right',
            'middle'
        );

        // Draw description
        renderer.drawText(
            upgrade.description,
            x + 15,
            y + 42,
            COLORS.textDim,
            '12px sans-serif',
            'left',
            'middle'
        );

        // Draw cost/status button area
        this.renderUpgradeButton(renderer, upgrade, x + width - 90, y + 50, 75, 24);
    }

    /**
     * Render the buy button for an upgrade
     * @param {Object} renderer - Renderer instance
     * @param {Object} upgrade - Upgrade info object
     * @param {number} x - Button X position
     * @param {number} y - Button Y position
     * @param {number} width - Button width
     * @param {number} height - Button height
     */
    renderUpgradeButton(renderer, upgrade, x, y, width, height) {
        if (upgrade.isMaxed) {
            // Maxed out - show checkmark
            renderer.drawRect(x, y, width, height, '#2d5a3d');
            renderer.drawText(
                '✓ OWNED',
                x + width / 2,
                y + height / 2,
                COLORS.gold,
                'bold 11px sans-serif',
                'center',
                'middle'
            );
        } else {
            // Show cost
            const buttonColor = upgrade.canPurchase ? COLORS.ui.button : '#333333';
            renderer.drawRect(x, y, width, height, buttonColor);

            // Draw coin icon and cost
            const costText = `${upgrade.cost}`;
            renderer.drawCircle(x + 15, y + height / 2, 6, COLORS.gold);
            renderer.save();
            renderer.setAlpha(0.5);
            renderer.drawCircle(x + 15, y + height / 2, 3, '#B8860B');
            renderer.restore();

            renderer.drawText(
                costText,
                x + 25,
                y + height / 2,
                upgrade.canPurchase ? COLORS.text : COLORS.textDim,
                'bold 12px sans-serif',
                'left',
                'middle'
            );
        }
    }

    /**
     * Render the back button
     * @param {Object} renderer - Renderer instance
     */
    renderBackButton(renderer) {
        const buttonWidth = 120;
        const buttonHeight = BACK_BUTTON_HEIGHT;
        const x = (this.canvas.width - buttonWidth) / 2;
        const y = this.canvas.height - buttonHeight - 20;

        // Store button bounds
        this.backButton = {
            x: x,
            y: y,
            width: buttonWidth,
            height: buttonHeight
        };

        // Draw button
        renderer.drawRect(x, y, buttonWidth, buttonHeight, COLORS.ui.panel);
        renderer.drawRectOutline(x, y, buttonWidth, buttonHeight, COLORS.accent, 2);

        renderer.drawText(
            '< BACK',
            x + buttonWidth / 2,
            y + buttonHeight / 2,
            COLORS.text,
            'bold 14px sans-serif',
            'center',
            'middle'
        );
    }

    /**
     * Handle a click on the upgrade menu
     * @param {number} x - Click X position
     * @param {number} y - Click Y position
     * @returns {string|null} Action taken ('back', 'purchase', or null)
     */
    handleClick(x, y) {
        // Check back button
        if (this.backButton && this.isInBounds(x, y, this.backButton)) {
            return 'back';
        }

        // Check upgrade buttons
        for (const button of this.upgradeButtons) {
            if (this.isInBounds(x, y, button)) {
                // Attempt to purchase upgrade
                if (this.game.progression.purchaseUpgrade(button.id)) {
                    // Successful purchase
                    this.purchaseFlash[button.id] = 1;
                    // Update game's total coins display
                    this.game.coins = this.game.progression.getTotalCoins();
                    return 'purchase';
                }
                return null;
            }
        }

        return null;
    }

    /**
     * Check if a point is within bounds
     * @param {number} x - Point X
     * @param {number} y - Point Y
     * @param {Object} bounds - {x, y, width, height}
     * @returns {boolean} True if point is in bounds
     */
    isInBounds(x, y, bounds) {
        return x >= bounds.x && x <= bounds.x + bounds.width &&
               y >= bounds.y && y <= bounds.y + bounds.height;
    }

    /**
     * Reset menu state
     */
    reset() {
        this.purchaseFlash = {};
        this.selectedUpgrade = null;
    }
}
