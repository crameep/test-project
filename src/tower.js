/**
 * Micro Tower Defense - Merge Madness
 * Tower class and tower-related utilities
 */

import { COLORS } from './renderer.js';

/**
 * Tower types configuration
 * Each type has different visual and combat properties
 */
export const TowerType = {
    FIRE: 'fire',
    ICE: 'ice',
    EARTH: 'earth'
};

/**
 * Tower configuration by type
 * Defines base stats and visual properties
 */
export const TOWER_CONFIG = {
    [TowerType.FIRE]: {
        color: COLORS.tower.fire,
        shape: 'diamond',
        baseDamage: 10,
        baseRange: 100,
        baseFireRate: 0.5, // attacks per second
        name: 'Fire Tower'
    },
    [TowerType.ICE]: {
        color: COLORS.tower.ice,
        shape: 'circle',
        baseDamage: 6,
        baseRange: 120,
        baseFireRate: 0.4,
        name: 'Ice Tower'
    },
    [TowerType.EARTH]: {
        color: COLORS.tower.earth,
        shape: 'square',
        baseDamage: 15,
        baseRange: 80,
        baseFireRate: 0.3,
        name: 'Earth Tower'
    }
};

/**
 * Tower class - represents a single tower on the grid
 */
export class Tower {
    /**
     * Create a new tower
     * @param {string} type - Tower type (fire, ice, earth)
     * @param {number} [tier=1] - Tower tier (1-5, increases on merge)
     */
    constructor(type, tier = 1) {
        // Validate tower type
        if (!TOWER_CONFIG[type]) {
            throw new Error(`Invalid tower type: ${type}`);
        }

        // Core properties
        this.type = type;
        this.tier = Math.max(1, Math.min(tier, 5)); // Clamp tier to 1-5

        // Position (set when placed on grid)
        this.col = -1;
        this.row = -1;
        this.x = 0;
        this.y = 0;

        // Drag state
        this.isDragging = false;
        this.dragX = 0;
        this.dragY = 0;

        // Combat state
        this.lastFireTime = 0;
        this.target = null;

        // Get config for this tower type
        this.config = TOWER_CONFIG[type];

        // Calculate tier-scaled stats
        this.updateStats();
    }

    /**
     * Update tower stats based on current tier
     * Stats scale exponentially with tier
     */
    updateStats() {
        const tierMultiplier = Math.pow(1.5, this.tier - 1);

        this.damage = Math.floor(this.config.baseDamage * tierMultiplier);
        this.range = Math.floor(this.config.baseRange * (1 + (this.tier - 1) * 0.1));
        this.fireRate = this.config.baseFireRate * (1 + (this.tier - 1) * 0.2);
        this.fireCooldown = 1 / this.fireRate;
    }

    /**
     * Get the color for this tower
     * @returns {string} Tower color
     */
    getColor() {
        return this.config.color;
    }

    /**
     * Get the shape for this tower
     * @returns {string} Tower shape (square, circle, diamond)
     */
    getShape() {
        return this.config.shape;
    }

    /**
     * Get the display name for this tower
     * @returns {string} Tower name with tier
     */
    getDisplayName() {
        return `${this.config.name} (Tier ${this.tier})`;
    }

    /**
     * Check if this tower can merge with another tower
     * @param {Tower} other - Other tower to check
     * @returns {boolean} True if towers can merge
     */
    canMergeWith(other) {
        if (!other || !(other instanceof Tower)) {
            return false;
        }
        // Can only merge towers of same type and tier
        // Cannot merge max tier towers (tier 5)
        return this.type === other.type &&
               this.tier === other.tier &&
               this.tier < 5;
    }

    /**
     * Upgrade this tower to the next tier (after merge)
     * @returns {boolean} True if upgrade was successful
     */
    upgrade() {
        if (this.tier >= 5) {
            return false;
        }
        this.tier++;
        this.updateStats();
        return true;
    }

    /**
     * Set the tower's position
     * @param {number} col - Grid column
     * @param {number} row - Grid row
     * @param {number} x - Pixel X position (center)
     * @param {number} y - Pixel Y position (center)
     */
    setPosition(col, row, x, y) {
        this.col = col;
        this.row = row;
        this.x = x;
        this.y = y;
    }

    /**
     * Update tower state (combat, animations, etc.)
     * @param {number} dt - Delta time in seconds
     * @param {Array} enemies - Array of enemy objects
     * @returns {Object|null} Projectile data if tower fired, null otherwise
     */
    update(dt, enemies = []) {
        // Update fire cooldown
        this.lastFireTime += dt;

        // Skip if no enemies or on cooldown
        if (enemies.length === 0 || this.lastFireTime < this.fireCooldown) {
            return null;
        }

        // Find target in range
        const target = this.findTarget(enemies);
        if (!target) {
            this.target = null;
            return null;
        }

        // Fire at target
        this.target = target;
        this.lastFireTime = 0;

        return {
            x: this.x,
            y: this.y,
            targetX: target.x,
            targetY: target.y,
            damage: this.damage,
            type: this.type,
            target: target
        };
    }

    /**
     * Find the best target within range
     * @param {Array} enemies - Array of enemy objects
     * @returns {Object|null} Target enemy or null
     */
    findTarget(enemies) {
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;

            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        return closestEnemy;
    }

    /**
     * Check if an enemy is within range
     * @param {Object} enemy - Enemy to check
     * @returns {boolean} True if enemy is in range
     */
    isInRange(enemy) {
        if (!enemy) return false;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.range;
    }

    /**
     * Render the tower
     * @param {Object} renderer - Renderer instance
     * @param {number} cellSize - Size of grid cell in pixels
     */
    render(renderer, cellSize) {
        // Determine render position (use drag position if dragging)
        const renderX = this.isDragging ? this.dragX : this.x;
        const renderY = this.isDragging ? this.dragY : this.y;

        // Draw the tower using renderer's drawTower method
        renderer.drawTower(
            renderX,
            renderY,
            cellSize * 0.9, // Slightly smaller than cell
            this.getColor(),
            this.tier,
            this.getShape()
        );

        // Draw range indicator when dragging or selected
        if (this.isDragging) {
            renderer.save();
            renderer.setAlpha(0.2);
            renderer.drawCircle(renderX, renderY, this.range, this.getColor());
            renderer.restore();
        }
    }

    /**
     * Create a copy of this tower (for dragging from panel)
     * @returns {Tower} New tower with same type and tier
     */
    clone() {
        return new Tower(this.type, this.tier);
    }

    /**
     * Get tower data for serialization
     * @returns {Object} Serializable tower data
     */
    toJSON() {
        return {
            type: this.type,
            tier: this.tier,
            col: this.col,
            row: this.row
        };
    }

    /**
     * Create a tower from serialized data
     * @param {Object} data - Serialized tower data
     * @returns {Tower} New tower instance
     */
    static fromJSON(data) {
        const tower = new Tower(data.type, data.tier);
        tower.col = data.col;
        tower.row = data.row;
        return tower;
    }
}

/**
 * Calculate coin reward for a merge
 * @param {number} tier - Tier of the towers being merged
 * @returns {number} Coin reward amount
 */
export function getMergeReward(tier) {
    // Higher tier merges give more coins
    return tier * 10;
}

/**
 * Get all available tower types
 * @returns {Array} Array of tower type strings
 */
export function getAvailableTowerTypes() {
    return Object.values(TowerType);
}
