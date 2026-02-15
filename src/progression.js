/**
 * Micro Tower Defense - Merge Madness
 * Meta-progression system with localStorage persistence
 */

// Storage key for localStorage
const STORAGE_KEY = 'microTD_progress';

// Default progression data
const DEFAULT_DATA = {
    totalCoins: 0,
    startingTier: 1,
    upgrades: {}
};

/**
 * Upgrade definitions
 * @type {Object.<string, {name: string, description: string, maxLevel: number, getCost: function(number): number}>}
 */
export const UPGRADES = {
    startTier: {
        name: 'Starting Tier',
        description: 'Start new runs with higher tier towers',
        maxLevel: 3,
        getCost: (level) => (level + 1) * 100 // 100, 200, 300
    },
    bonusCoins: {
        name: 'Coin Bonus',
        description: 'Earn more coins from merges',
        maxLevel: 5,
        getCost: (level) => (level + 1) * 50 // 50, 100, 150, 200, 250
    },
    startingTower: {
        name: 'Starting Tower',
        description: 'Begin runs with an extra tower on the grid',
        maxLevel: 2,
        getCost: (level) => (level + 1) * 150 // 150, 300
    }
};

/**
 * Progression class - handles meta-currency and upgrades with localStorage persistence
 */
export class Progression {
    /**
     * Create a Progression instance and load saved data
     */
    constructor() {
        this.data = this.load();
    }

    /**
     * Load progression data from localStorage
     * @returns {Object} Progression data (or defaults if none saved)
     */
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all fields exist
                return {
                    ...DEFAULT_DATA,
                    ...parsed,
                    upgrades: {
                        ...DEFAULT_DATA.upgrades,
                        ...(parsed.upgrades || {})
                    }
                };
            }
        } catch (error) {
            // localStorage unavailable or corrupted data
            // Gracefully degrade to session-only progression
        }
        return { ...DEFAULT_DATA, upgrades: {} };
    }

    /**
     * Save current progression data to localStorage
     */
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (error) {
            // localStorage unavailable - data only persists for this session
        }
    }

    /**
     * Add coins to the total
     * @param {number} amount - Number of coins to add
     */
    addCoins(amount) {
        if (amount <= 0) {
            return;
        }
        this.data.totalCoins += amount;
        this.save();
    }

    /**
     * Get the current total coins
     * @returns {number} Total coins
     */
    getTotalCoins() {
        return this.data.totalCoins;
    }

    /**
     * Get the current level of an upgrade
     * @param {string} upgradeId - The upgrade identifier
     * @returns {number} Current upgrade level (0 if not purchased)
     */
    getUpgradeLevel(upgradeId) {
        return this.data.upgrades[upgradeId] || 0;
    }

    /**
     * Check if an upgrade can be purchased
     * @param {string} upgradeId - The upgrade identifier
     * @returns {boolean} True if purchase is possible
     */
    canPurchaseUpgrade(upgradeId) {
        const upgrade = UPGRADES[upgradeId];
        if (!upgrade) {
            return false;
        }

        const currentLevel = this.getUpgradeLevel(upgradeId);
        if (currentLevel >= upgrade.maxLevel) {
            return false; // Already at max level
        }

        const cost = upgrade.getCost(currentLevel);
        return this.data.totalCoins >= cost;
    }

    /**
     * Get the cost of the next level of an upgrade
     * @param {string} upgradeId - The upgrade identifier
     * @returns {number|null} Cost of next level, or null if maxed
     */
    getUpgradeCost(upgradeId) {
        const upgrade = UPGRADES[upgradeId];
        if (!upgrade) {
            return null;
        }

        const currentLevel = this.getUpgradeLevel(upgradeId);
        if (currentLevel >= upgrade.maxLevel) {
            return null;
        }

        return upgrade.getCost(currentLevel);
    }

    /**
     * Purchase an upgrade if possible
     * @param {string} upgradeId - The upgrade identifier
     * @returns {boolean} True if purchase was successful
     */
    purchaseUpgrade(upgradeId) {
        const upgrade = UPGRADES[upgradeId];
        if (!upgrade) {
            return false;
        }

        const currentLevel = this.getUpgradeLevel(upgradeId);
        if (currentLevel >= upgrade.maxLevel) {
            return false; // Already at max level
        }

        const cost = upgrade.getCost(currentLevel);
        if (this.data.totalCoins < cost) {
            return false; // Not enough coins
        }

        // Purchase successful
        this.data.totalCoins -= cost;
        this.data.upgrades[upgradeId] = currentLevel + 1;
        this.save();
        return true;
    }

    /**
     * Get the starting tier based on upgrades
     * @returns {number} Starting tier for new runs (1-4)
     */
    getStartingTier() {
        return 1 + this.getUpgradeLevel('startTier');
    }

    /**
     * Get the coin bonus multiplier based on upgrades
     * @returns {number} Multiplier for coin rewards (1.0 = 100%)
     */
    getCoinBonus() {
        // Each level gives 10% bonus
        return 1 + (this.getUpgradeLevel('bonusCoins') * 0.1);
    }

    /**
     * Get the number of starting towers based on upgrades
     * @returns {number} Number of bonus starting towers (0-2)
     */
    getStartingTowerCount() {
        return this.getUpgradeLevel('startingTower');
    }

    /**
     * Reset all progression data (for testing)
     */
    reset() {
        this.data = { ...DEFAULT_DATA, upgrades: {} };
        this.save();
    }

    /**
     * Get all upgrade information for UI display
     * @returns {Array<Object>} Array of upgrade info objects
     */
    getUpgradeInfo() {
        return Object.entries(UPGRADES).map(([id, upgrade]) => {
            const currentLevel = this.getUpgradeLevel(id);
            const isMaxed = currentLevel >= upgrade.maxLevel;
            return {
                id,
                name: upgrade.name,
                description: upgrade.description,
                currentLevel,
                maxLevel: upgrade.maxLevel,
                cost: isMaxed ? null : upgrade.getCost(currentLevel),
                isMaxed,
                canPurchase: this.canPurchaseUpgrade(id)
            };
        });
    }

    /**
     * Serialize progression data for debugging
     * @returns {Object} Current progression data
     */
    toJSON() {
        return { ...this.data };
    }
}
