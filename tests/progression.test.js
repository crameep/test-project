/**
 * Unit tests for Progression class and localStorage persistence
 * Tests save/load, coin management, upgrades, and edge cases
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import the Progression class and UPGRADES
const { Progression, UPGRADES } = await import('../src/progression.js');

// Get reference to localStorage mock from setup
const localStorageMock = global.localStorage;

describe('Progression', () => {
  let progression;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});

    // Create fresh progression instance
    progression = new Progression();
  });

  describe('constructor', () => {
    it('should create a Progression instance', () => {
      expect(progression).toBeInstanceOf(Progression);
    });

    it('should initialize with default data when no saved data exists', () => {
      expect(progression.data.totalCoins).toBe(0);
      expect(progression.data.upgrades).toEqual({});
    });

    it('should call load() on construction', () => {
      expect(localStorageMock.getItem).toHaveBeenCalledWith('microTD_progress');
    });
  });

  describe('load', () => {
    it('should return default data when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const data = progression.load();

      expect(data.totalCoins).toBe(0);
      expect(data.startingTier).toBe(1);
      expect(data.upgrades).toEqual({});
    });

    it('should parse and return saved data from localStorage', () => {
      const savedData = {
        totalCoins: 500,
        startingTier: 2,
        upgrades: { startTier: 1, bonusCoins: 2 }
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

      const freshProgression = new Progression();

      expect(freshProgression.data.totalCoins).toBe(500);
      expect(freshProgression.data.upgrades.startTier).toBe(1);
      expect(freshProgression.data.upgrades.bonusCoins).toBe(2);
    });

    it('should merge saved data with defaults for missing fields', () => {
      const partialData = { totalCoins: 100 };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(partialData));

      const freshProgression = new Progression();

      expect(freshProgression.data.totalCoins).toBe(100);
      expect(freshProgression.data.startingTier).toBe(1); // default
      expect(freshProgression.data.upgrades).toEqual({}); // default
    });

    it('should handle corrupted JSON data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('{ corrupted json data');

      const freshProgression = new Progression();

      // Should fall back to defaults
      expect(freshProgression.data.totalCoins).toBe(0);
      expect(freshProgression.data.upgrades).toEqual({});
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const freshProgression = new Progression();

      // Should fall back to defaults
      expect(freshProgression.data.totalCoins).toBe(0);
    });
  });

  describe('save', () => {
    it('should save data to localStorage', () => {
      progression.data.totalCoins = 250;
      progression.data.upgrades = { startTier: 1 };

      progression.save();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'microTD_progress',
        expect.any(String)
      );

      // Verify the saved data structure
      const savedString = localStorageMock.setItem.mock.calls[0][1];
      const savedData = JSON.parse(savedString);
      expect(savedData.totalCoins).toBe(250);
      expect(savedData.upgrades.startTier).toBe(1);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage full');
      });

      // Should not throw
      expect(() => progression.save()).not.toThrow();
    });
  });

  describe('addCoins', () => {
    it('should add coins to the total', () => {
      progression.addCoins(100);
      expect(progression.data.totalCoins).toBe(100);
    });

    it('should accumulate coins across multiple calls', () => {
      progression.addCoins(50);
      progression.addCoins(30);
      progression.addCoins(20);
      expect(progression.data.totalCoins).toBe(100);
    });

    it('should save after adding coins', () => {
      progression.addCoins(100);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should not add zero coins', () => {
      progression.addCoins(0);
      expect(progression.data.totalCoins).toBe(0);
      // Should not trigger save for zero amount
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should not add negative coins', () => {
      progression.addCoins(100);
      jest.clearAllMocks();

      progression.addCoins(-50);

      expect(progression.data.totalCoins).toBe(100);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getTotalCoins', () => {
    it('should return current total coins', () => {
      expect(progression.getTotalCoins()).toBe(0);

      progression.data.totalCoins = 500;
      expect(progression.getTotalCoins()).toBe(500);
    });
  });

  describe('getUpgradeLevel', () => {
    it('should return 0 for unpurchased upgrades', () => {
      expect(progression.getUpgradeLevel('startTier')).toBe(0);
      expect(progression.getUpgradeLevel('bonusCoins')).toBe(0);
      expect(progression.getUpgradeLevel('startingTower')).toBe(0);
    });

    it('should return correct level for purchased upgrades', () => {
      progression.data.upgrades = { startTier: 2, bonusCoins: 3 };

      expect(progression.getUpgradeLevel('startTier')).toBe(2);
      expect(progression.getUpgradeLevel('bonusCoins')).toBe(3);
    });

    it('should return 0 for unknown upgrade IDs', () => {
      expect(progression.getUpgradeLevel('unknownUpgrade')).toBe(0);
    });
  });

  describe('canPurchaseUpgrade', () => {
    it('should return true when player has enough coins', () => {
      progression.data.totalCoins = 100;
      expect(progression.canPurchaseUpgrade('startTier')).toBe(true);
    });

    it('should return false when player lacks coins', () => {
      progression.data.totalCoins = 50;
      expect(progression.canPurchaseUpgrade('startTier')).toBe(false);
    });

    it('should return false for maxed upgrades', () => {
      progression.data.totalCoins = 10000;
      progression.data.upgrades = { startTier: UPGRADES.startTier.maxLevel };

      expect(progression.canPurchaseUpgrade('startTier')).toBe(false);
    });

    it('should return false for unknown upgrade IDs', () => {
      progression.data.totalCoins = 10000;
      expect(progression.canPurchaseUpgrade('unknownUpgrade')).toBe(false);
    });

    it('should account for current level when checking cost', () => {
      // Level 0 -> 1 costs 100
      progression.data.totalCoins = 100;
      expect(progression.canPurchaseUpgrade('startTier')).toBe(true);

      // Level 1 -> 2 costs 200
      progression.data.upgrades = { startTier: 1 };
      progression.data.totalCoins = 150;
      expect(progression.canPurchaseUpgrade('startTier')).toBe(false);

      progression.data.totalCoins = 200;
      expect(progression.canPurchaseUpgrade('startTier')).toBe(true);
    });
  });

  describe('getUpgradeCost', () => {
    it('should return correct cost for level 0 upgrade', () => {
      expect(progression.getUpgradeCost('startTier')).toBe(100);
      expect(progression.getUpgradeCost('bonusCoins')).toBe(50);
      expect(progression.getUpgradeCost('startingTower')).toBe(150);
    });

    it('should return increasing cost for higher levels', () => {
      progression.data.upgrades = { startTier: 1 };
      expect(progression.getUpgradeCost('startTier')).toBe(200);

      progression.data.upgrades = { startTier: 2 };
      expect(progression.getUpgradeCost('startTier')).toBe(300);
    });

    it('should return null for maxed upgrades', () => {
      progression.data.upgrades = { startTier: UPGRADES.startTier.maxLevel };
      expect(progression.getUpgradeCost('startTier')).toBeNull();
    });

    it('should return null for unknown upgrade IDs', () => {
      expect(progression.getUpgradeCost('unknownUpgrade')).toBeNull();
    });
  });

  describe('purchaseUpgrade', () => {
    it('should deduct coins and increase upgrade level', () => {
      progression.data.totalCoins = 100;

      const result = progression.purchaseUpgrade('startTier');

      expect(result).toBe(true);
      expect(progression.data.totalCoins).toBe(0);
      expect(progression.data.upgrades.startTier).toBe(1);
    });

    it('should save after successful purchase', () => {
      progression.data.totalCoins = 100;
      jest.clearAllMocks();

      progression.purchaseUpgrade('startTier');

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should return false and not modify data when lacking coins', () => {
      progression.data.totalCoins = 50;

      const result = progression.purchaseUpgrade('startTier');

      expect(result).toBe(false);
      expect(progression.data.totalCoins).toBe(50);
      expect(progression.data.upgrades.startTier).toBeUndefined();
    });

    it('should return false for maxed upgrades', () => {
      progression.data.totalCoins = 10000;
      progression.data.upgrades = { startTier: UPGRADES.startTier.maxLevel };

      const result = progression.purchaseUpgrade('startTier');

      expect(result).toBe(false);
    });

    it('should return false for unknown upgrade IDs', () => {
      progression.data.totalCoins = 10000;

      const result = progression.purchaseUpgrade('unknownUpgrade');

      expect(result).toBe(false);
    });

    it('should increment existing upgrade level', () => {
      progression.data.totalCoins = 500;
      progression.data.upgrades = { startTier: 1 };

      progression.purchaseUpgrade('startTier');

      expect(progression.data.upgrades.startTier).toBe(2);
    });

    it('should not allow purchasing above max level', () => {
      progression.data.totalCoins = 10000;

      // Purchase all levels
      for (let i = 0; i < UPGRADES.startTier.maxLevel; i++) {
        expect(progression.purchaseUpgrade('startTier')).toBe(true);
      }

      // Next purchase should fail
      expect(progression.purchaseUpgrade('startTier')).toBe(false);
      expect(progression.data.upgrades.startTier).toBe(UPGRADES.startTier.maxLevel);
    });
  });

  describe('getStartingTier', () => {
    it('should return 1 with no upgrades', () => {
      expect(progression.getStartingTier()).toBe(1);
    });

    it('should return 2 with one startTier upgrade', () => {
      progression.data.upgrades = { startTier: 1 };
      expect(progression.getStartingTier()).toBe(2);
    });

    it('should return 4 with max startTier upgrades', () => {
      progression.data.upgrades = { startTier: 3 };
      expect(progression.getStartingTier()).toBe(4);
    });
  });

  describe('getCoinBonus', () => {
    it('should return 1.0 with no upgrades', () => {
      expect(progression.getCoinBonus()).toBe(1);
    });

    it('should return 1.1 with one bonusCoins upgrade', () => {
      progression.data.upgrades = { bonusCoins: 1 };
      expect(progression.getCoinBonus()).toBeCloseTo(1.1);
    });

    it('should return 1.5 with max bonusCoins upgrades', () => {
      progression.data.upgrades = { bonusCoins: 5 };
      expect(progression.getCoinBonus()).toBeCloseTo(1.5);
    });

    it('should scale linearly with upgrade level', () => {
      progression.data.upgrades = { bonusCoins: 3 };
      expect(progression.getCoinBonus()).toBeCloseTo(1.3);
    });
  });

  describe('getStartingTowerCount', () => {
    it('should return 0 with no upgrades', () => {
      expect(progression.getStartingTowerCount()).toBe(0);
    });

    it('should return 1 with one startingTower upgrade', () => {
      progression.data.upgrades = { startingTower: 1 };
      expect(progression.getStartingTowerCount()).toBe(1);
    });

    it('should return 2 with max startingTower upgrades', () => {
      progression.data.upgrades = { startingTower: 2 };
      expect(progression.getStartingTowerCount()).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset all data to defaults', () => {
      progression.data.totalCoins = 1000;
      progression.data.upgrades = { startTier: 2, bonusCoins: 3 };

      progression.reset();

      expect(progression.data.totalCoins).toBe(0);
      expect(progression.data.upgrades).toEqual({});
    });

    it('should save after reset', () => {
      jest.clearAllMocks();

      progression.reset();

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('getUpgradeInfo', () => {
    it('should return info for all upgrades', () => {
      const info = progression.getUpgradeInfo();

      expect(info.length).toBe(Object.keys(UPGRADES).length);
    });

    it('should include correct fields for each upgrade', () => {
      const info = progression.getUpgradeInfo();

      for (const upgrade of info) {
        expect(upgrade).toHaveProperty('id');
        expect(upgrade).toHaveProperty('name');
        expect(upgrade).toHaveProperty('description');
        expect(upgrade).toHaveProperty('currentLevel');
        expect(upgrade).toHaveProperty('maxLevel');
        expect(upgrade).toHaveProperty('cost');
        expect(upgrade).toHaveProperty('isMaxed');
        expect(upgrade).toHaveProperty('canPurchase');
      }
    });

    it('should show current level correctly', () => {
      progression.data.upgrades = { startTier: 2 };

      const info = progression.getUpgradeInfo();
      const startTierInfo = info.find(u => u.id === 'startTier');

      expect(startTierInfo.currentLevel).toBe(2);
    });

    it('should show isMaxed correctly', () => {
      progression.data.upgrades = { startTier: UPGRADES.startTier.maxLevel };

      const info = progression.getUpgradeInfo();
      const startTierInfo = info.find(u => u.id === 'startTier');

      expect(startTierInfo.isMaxed).toBe(true);
      expect(startTierInfo.cost).toBeNull();
    });

    it('should show canPurchase based on coins', () => {
      progression.data.totalCoins = 100;

      const info = progression.getUpgradeInfo();
      const startTierInfo = info.find(u => u.id === 'startTier');
      const bonusCoinsInfo = info.find(u => u.id === 'bonusCoins');

      expect(startTierInfo.canPurchase).toBe(true); // costs 100
      expect(bonusCoinsInfo.canPurchase).toBe(true); // costs 50
    });

    it('should show canPurchase as false when lacking coins', () => {
      progression.data.totalCoins = 0;

      const info = progression.getUpgradeInfo();

      for (const upgrade of info) {
        expect(upgrade.canPurchase).toBe(false);
      }
    });
  });

  describe('toJSON', () => {
    it('should return copy of progression data', () => {
      progression.data.totalCoins = 500;
      progression.data.upgrades = { startTier: 1 };

      const json = progression.toJSON();

      expect(json.totalCoins).toBe(500);
      expect(json.upgrades.startTier).toBe(1);
    });

    it('should return a copy, not the original object', () => {
      const json = progression.toJSON();

      json.totalCoins = 999;

      expect(progression.data.totalCoins).toBe(0);
    });
  });
});

describe('UPGRADES constant', () => {
  it('should have startTier upgrade defined', () => {
    expect(UPGRADES.startTier).toBeDefined();
    expect(UPGRADES.startTier.name).toBe('Starting Tier');
    expect(UPGRADES.startTier.maxLevel).toBe(3);
  });

  it('should have bonusCoins upgrade defined', () => {
    expect(UPGRADES.bonusCoins).toBeDefined();
    expect(UPGRADES.bonusCoins.name).toBe('Coin Bonus');
    expect(UPGRADES.bonusCoins.maxLevel).toBe(5);
  });

  it('should have startingTower upgrade defined', () => {
    expect(UPGRADES.startingTower).toBeDefined();
    expect(UPGRADES.startingTower.name).toBe('Starting Tower');
    expect(UPGRADES.startingTower.maxLevel).toBe(2);
  });

  it('should have getCost function for each upgrade', () => {
    for (const upgrade of Object.values(UPGRADES)) {
      expect(typeof upgrade.getCost).toBe('function');
    }
  });

  it('should have increasing costs for higher levels', () => {
    for (const upgrade of Object.values(UPGRADES)) {
      const cost0 = upgrade.getCost(0);
      const cost1 = upgrade.getCost(1);
      const cost2 = upgrade.getCost(2);

      expect(cost1).toBeGreaterThan(cost0);
      expect(cost2).toBeGreaterThan(cost1);
    }
  });
});

describe('localStorage persistence integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should persist coins after page refresh simulation', () => {
    // First "session"
    localStorageMock.getItem.mockReturnValue(null);
    const session1 = new Progression();

    session1.addCoins(200);

    // Capture what was saved
    const savedString = localStorageMock.setItem.mock.calls[0][1];

    // Second "session" - simulate page refresh
    localStorageMock.getItem.mockReturnValue(savedString);
    const session2 = new Progression();

    expect(session2.getTotalCoins()).toBe(200);
  });

  it('should persist upgrades after page refresh simulation', () => {
    // First "session"
    localStorageMock.getItem.mockReturnValue(null);
    const session1 = new Progression();
    session1.data.totalCoins = 500;

    session1.purchaseUpgrade('startTier');
    session1.purchaseUpgrade('bonusCoins');

    // Get the last saved state
    const calls = localStorageMock.setItem.mock.calls;
    const savedString = calls[calls.length - 1][1];

    // Second "session"
    localStorageMock.getItem.mockReturnValue(savedString);
    const session2 = new Progression();

    expect(session2.getUpgradeLevel('startTier')).toBe(1);
    expect(session2.getUpgradeLevel('bonusCoins')).toBe(1);
    expect(session2.getStartingTier()).toBe(2);
  });

  it('should maintain coin bonus multiplier across sessions', () => {
    // Set up saved data with bonus coins upgrade
    const savedData = {
      totalCoins: 100,
      startingTier: 1,
      upgrades: { bonusCoins: 3 }
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

    const session = new Progression();

    expect(session.getCoinBonus()).toBeCloseTo(1.3);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should handle very large coin values', () => {
    const progression = new Progression();
    progression.addCoins(Number.MAX_SAFE_INTEGER - 1000);

    expect(progression.getTotalCoins()).toBe(Number.MAX_SAFE_INTEGER - 1000);
  });

  it('should handle rapid consecutive purchases', () => {
    const progression = new Progression();
    progression.data.totalCoins = 10000;

    // Rapid fire purchases
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(progression.purchaseUpgrade('bonusCoins'));
    }

    // Should succeed up to max level (5)
    expect(results.filter(r => r === true).length).toBe(5);
    expect(results.filter(r => r === false).length).toBe(5);
    expect(progression.getUpgradeLevel('bonusCoins')).toBe(5);
  });

  it('should handle empty string in localStorage', () => {
    localStorageMock.getItem.mockReturnValue('');

    const progression = new Progression();

    // Should use defaults
    expect(progression.getTotalCoins()).toBe(0);
  });

  it('should handle null values in saved upgrades', () => {
    const savedData = {
      totalCoins: 100,
      upgrades: { startTier: null }
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

    const progression = new Progression();

    // null should be treated as 0
    expect(progression.getUpgradeLevel('startTier')).toBe(0);
  });

  it('should handle missing upgrades object in saved data', () => {
    const savedData = { totalCoins: 100 };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

    const progression = new Progression();

    expect(progression.data.upgrades).toEqual({});
    expect(progression.getUpgradeLevel('startTier')).toBe(0);
  });

  it('should handle exactly enough coins for purchase', () => {
    const progression = new Progression();
    progression.data.totalCoins = 100; // Exact cost of first startTier upgrade

    const result = progression.purchaseUpgrade('startTier');

    expect(result).toBe(true);
    expect(progression.getTotalCoins()).toBe(0);
    expect(progression.getUpgradeLevel('startTier')).toBe(1);
  });

  it('should handle one coin less than needed', () => {
    const progression = new Progression();
    progression.data.totalCoins = 99; // One less than first startTier upgrade

    const result = progression.purchaseUpgrade('startTier');

    expect(result).toBe(false);
    expect(progression.getTotalCoins()).toBe(99);
    expect(progression.getUpgradeLevel('startTier')).toBe(0);
  });
});
