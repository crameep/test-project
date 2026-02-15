/**
 * Unit tests for Tower class and merge logic
 * Tests tower creation, properties, merge detection, and tier upgrades
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock the renderer module
jest.unstable_mockModule('../src/renderer.js', () => ({
  COLORS: {
    gridCell: '#1a1a2e',
    gridLine: '#0f3460',
    accent: '#e94560',
    tower: {
      fire: '#FF6B6B',
      ice: '#4ECDC4',
      earth: '#95E1A3'
    },
    gold: '#FFD700'
  }
}));

// Import modules after mocks are set up
const { Tower, TowerType, TOWER_CONFIG, getMergeReward, getAvailableTowerTypes } = await import('../src/tower.js');
const { Grid } = await import('../src/grid.js');

describe('Tower', () => {
  describe('constructor', () => {
    it('should create a tower with valid type', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.type).toBe('fire');
    });

    it('should create a tower with default tier 1', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.tier).toBe(1);
    });

    it('should create a tower with specified tier', () => {
      const tower = new Tower(TowerType.ICE, 3);
      expect(tower.tier).toBe(3);
    });

    it('should clamp tier to minimum of 1', () => {
      const tower = new Tower(TowerType.FIRE, 0);
      expect(tower.tier).toBe(1);
    });

    it('should clamp tier to maximum of 5', () => {
      const tower = new Tower(TowerType.FIRE, 10);
      expect(tower.tier).toBe(5);
    });

    it('should throw error for invalid tower type', () => {
      expect(() => new Tower('invalid')).toThrow('Invalid tower type: invalid');
    });

    it('should initialize position to -1, -1 (unplaced)', () => {
      const tower = new Tower(TowerType.EARTH);
      expect(tower.col).toBe(-1);
      expect(tower.row).toBe(-1);
      expect(tower.x).toBe(0);
      expect(tower.y).toBe(0);
    });

    it('should initialize drag state to false', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.isDragging).toBe(false);
      expect(tower.dragX).toBe(0);
      expect(tower.dragY).toBe(0);
    });

    it('should initialize combat state', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.lastFireTime).toBe(0);
      expect(tower.target).toBeNull();
    });

    it('should set config reference for tower type', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.config).toBe(TOWER_CONFIG[TowerType.FIRE]);
    });
  });

  describe('TowerType enum', () => {
    it('should have FIRE type', () => {
      expect(TowerType.FIRE).toBe('fire');
    });

    it('should have ICE type', () => {
      expect(TowerType.ICE).toBe('ice');
    });

    it('should have EARTH type', () => {
      expect(TowerType.EARTH).toBe('earth');
    });
  });

  describe('TOWER_CONFIG', () => {
    it('should have config for all tower types', () => {
      expect(TOWER_CONFIG[TowerType.FIRE]).toBeDefined();
      expect(TOWER_CONFIG[TowerType.ICE]).toBeDefined();
      expect(TOWER_CONFIG[TowerType.EARTH]).toBeDefined();
    });

    it('should have required properties for each type', () => {
      for (const type of Object.values(TowerType)) {
        const config = TOWER_CONFIG[type];
        expect(config.color).toBeDefined();
        expect(config.shape).toBeDefined();
        expect(config.baseDamage).toBeGreaterThan(0);
        expect(config.baseRange).toBeGreaterThan(0);
        expect(config.baseFireRate).toBeGreaterThan(0);
        expect(config.name).toBeDefined();
      }
    });

    it('should have different shapes for each type', () => {
      expect(TOWER_CONFIG[TowerType.FIRE].shape).toBe('diamond');
      expect(TOWER_CONFIG[TowerType.ICE].shape).toBe('circle');
      expect(TOWER_CONFIG[TowerType.EARTH].shape).toBe('square');
    });
  });

  describe('updateStats', () => {
    it('should set base stats for tier 1 tower', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      expect(tower.damage).toBe(TOWER_CONFIG[TowerType.FIRE].baseDamage);
    });

    it('should scale stats with tier multiplier (1.5^(tier-1))', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 2);
      const tower3 = new Tower(TowerType.FIRE, 3);

      // Tier 2 should have 1.5x base damage
      const expectedDamage2 = Math.floor(TOWER_CONFIG[TowerType.FIRE].baseDamage * 1.5);
      expect(tower2.damage).toBe(expectedDamage2);

      // Tier 3 should have 2.25x base damage
      const expectedDamage3 = Math.floor(TOWER_CONFIG[TowerType.FIRE].baseDamage * 2.25);
      expect(tower3.damage).toBe(expectedDamage3);
    });

    it('should increase range with tier', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower5 = new Tower(TowerType.FIRE, 5);
      expect(tower5.range).toBeGreaterThan(tower1.range);
    });

    it('should increase fire rate with tier', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower5 = new Tower(TowerType.FIRE, 5);
      expect(tower5.fireRate).toBeGreaterThan(tower1.fireRate);
    });

    it('should set fire cooldown as inverse of fire rate', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      expect(tower.fireCooldown).toBe(1 / tower.fireRate);
    });
  });

  describe('getColor', () => {
    it('should return correct color for fire tower', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.getColor()).toBe(TOWER_CONFIG[TowerType.FIRE].color);
    });

    it('should return correct color for ice tower', () => {
      const tower = new Tower(TowerType.ICE);
      expect(tower.getColor()).toBe(TOWER_CONFIG[TowerType.ICE].color);
    });

    it('should return correct color for earth tower', () => {
      const tower = new Tower(TowerType.EARTH);
      expect(tower.getColor()).toBe(TOWER_CONFIG[TowerType.EARTH].color);
    });
  });

  describe('getShape', () => {
    it('should return diamond for fire tower', () => {
      const tower = new Tower(TowerType.FIRE);
      expect(tower.getShape()).toBe('diamond');
    });

    it('should return circle for ice tower', () => {
      const tower = new Tower(TowerType.ICE);
      expect(tower.getShape()).toBe('circle');
    });

    it('should return square for earth tower', () => {
      const tower = new Tower(TowerType.EARTH);
      expect(tower.getShape()).toBe('square');
    });
  });

  describe('getDisplayName', () => {
    it('should return name with tier', () => {
      const tower = new Tower(TowerType.FIRE, 3);
      expect(tower.getDisplayName()).toBe('Fire Tower (Tier 3)');
    });
  });

  describe('canMergeWith', () => {
    it('should return true for same type and tier towers', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);
      expect(tower1.canMergeWith(tower2)).toBe(true);
    });

    it('should return false for different types', () => {
      const fireTower = new Tower(TowerType.FIRE, 1);
      const iceTower = new Tower(TowerType.ICE, 1);
      expect(fireTower.canMergeWith(iceTower)).toBe(false);
    });

    it('should return false for different tiers', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 2);
      expect(tower1.canMergeWith(tower2)).toBe(false);
    });

    it('should return false for max tier towers (tier 5)', () => {
      const tower1 = new Tower(TowerType.FIRE, 5);
      const tower2 = new Tower(TowerType.FIRE, 5);
      expect(tower1.canMergeWith(tower2)).toBe(false);
    });

    it('should return false for null', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      expect(tower.canMergeWith(null)).toBe(false);
    });

    it('should return false for non-Tower objects', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      expect(tower.canMergeWith({ type: 'fire', tier: 1 })).toBe(false);
    });

    it('should return true for tier 4 towers (can merge to tier 5)', () => {
      const tower1 = new Tower(TowerType.EARTH, 4);
      const tower2 = new Tower(TowerType.EARTH, 4);
      expect(tower1.canMergeWith(tower2)).toBe(true);
    });
  });

  describe('upgrade', () => {
    it('should increase tier by 1', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      const result = tower.upgrade();
      expect(result).toBe(true);
      expect(tower.tier).toBe(2);
    });

    it('should update stats after upgrade', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      const oldDamage = tower.damage;
      tower.upgrade();
      expect(tower.damage).toBeGreaterThan(oldDamage);
    });

    it('should not upgrade past tier 5', () => {
      const tower = new Tower(TowerType.FIRE, 5);
      const result = tower.upgrade();
      expect(result).toBe(false);
      expect(tower.tier).toBe(5);
    });

    it('should upgrade from tier 4 to tier 5', () => {
      const tower = new Tower(TowerType.FIRE, 4);
      const result = tower.upgrade();
      expect(result).toBe(true);
      expect(tower.tier).toBe(5);
    });
  });

  describe('setPosition', () => {
    it('should set grid position', () => {
      const tower = new Tower(TowerType.FIRE);
      tower.setPosition(2, 3, 100, 150);
      expect(tower.col).toBe(2);
      expect(tower.row).toBe(3);
      expect(tower.x).toBe(100);
      expect(tower.y).toBe(150);
    });
  });

  describe('update', () => {
    let tower;
    let enemies;

    beforeEach(() => {
      tower = new Tower(TowerType.FIRE, 1);
      tower.setPosition(0, 0, 50, 50);
      // Set a short cooldown for testing
      tower.lastFireTime = tower.fireCooldown;
    });

    it('should return null with no enemies', () => {
      const result = tower.update(0.1, []);
      expect(result).toBeNull();
    });

    it('should return null when on cooldown', () => {
      tower.lastFireTime = 0;
      enemies = [{ x: 60, y: 60, isDead: false }];
      const result = tower.update(0.1, enemies);
      expect(result).toBeNull();
    });

    it('should return projectile data when firing at target in range', () => {
      enemies = [{ x: 60, y: 60, isDead: false }];
      const result = tower.update(0.1, enemies);

      expect(result).not.toBeNull();
      expect(result.x).toBe(tower.x);
      expect(result.y).toBe(tower.y);
      expect(result.damage).toBe(tower.damage);
      expect(result.type).toBe(tower.type);
    });

    it('should reset lastFireTime after firing', () => {
      enemies = [{ x: 60, y: 60, isDead: false }];
      tower.update(0.1, enemies);
      expect(tower.lastFireTime).toBe(0);
    });

    it('should set target after firing', () => {
      const enemy = { x: 60, y: 60, isDead: false };
      tower.update(0.1, [enemy]);
      expect(tower.target).toBe(enemy);
    });

    it('should not fire at dead enemies', () => {
      enemies = [{ x: 60, y: 60, isDead: true }];
      const result = tower.update(0.1, enemies);
      expect(result).toBeNull();
    });

    it('should not fire at enemies out of range', () => {
      // Place enemy far away
      enemies = [{ x: 1000, y: 1000, isDead: false }];
      const result = tower.update(0.1, enemies);
      expect(result).toBeNull();
    });
  });

  describe('findTarget', () => {
    let tower;

    beforeEach(() => {
      tower = new Tower(TowerType.FIRE, 1);
      tower.setPosition(0, 0, 50, 50);
    });

    it('should return null for empty enemy list', () => {
      const target = tower.findTarget([]);
      expect(target).toBeNull();
    });

    it('should return closest enemy in range', () => {
      const closeEnemy = { x: 60, y: 60, isDead: false };
      const farEnemy = { x: 80, y: 80, isDead: false };

      const target = tower.findTarget([farEnemy, closeEnemy]);
      expect(target).toBe(closeEnemy);
    });

    it('should skip dead enemies', () => {
      const deadEnemy = { x: 55, y: 55, isDead: true };
      const aliveEnemy = { x: 60, y: 60, isDead: false };

      const target = tower.findTarget([deadEnemy, aliveEnemy]);
      expect(target).toBe(aliveEnemy);
    });

    it('should return null if all enemies are out of range', () => {
      const farEnemy = { x: 1000, y: 1000, isDead: false };
      const target = tower.findTarget([farEnemy]);
      expect(target).toBeNull();
    });
  });

  describe('isInRange', () => {
    let tower;

    beforeEach(() => {
      tower = new Tower(TowerType.FIRE, 1);
      tower.setPosition(0, 0, 50, 50);
    });

    it('should return true for enemy in range', () => {
      const enemy = { x: 60, y: 60 };
      expect(tower.isInRange(enemy)).toBe(true);
    });

    it('should return false for enemy out of range', () => {
      const enemy = { x: 1000, y: 1000 };
      expect(tower.isInRange(enemy)).toBe(false);
    });

    it('should return false for null enemy', () => {
      expect(tower.isInRange(null)).toBe(false);
    });

    it('should return true for enemy exactly at range boundary', () => {
      const tower = new Tower(TowerType.FIRE, 1);
      tower.setPosition(0, 0, 0, 0);
      // Create enemy at exactly the range distance
      const enemy = { x: tower.range, y: 0 };
      expect(tower.isInRange(enemy)).toBe(true);
    });
  });

  describe('clone', () => {
    it('should create a new tower with same type and tier', () => {
      const original = new Tower(TowerType.ICE, 3);
      const cloned = original.clone();

      expect(cloned).not.toBe(original);
      expect(cloned.type).toBe(original.type);
      expect(cloned.tier).toBe(original.tier);
    });

    it('should not copy position from original', () => {
      const original = new Tower(TowerType.ICE, 2);
      original.setPosition(1, 2, 100, 150);
      const cloned = original.clone();

      expect(cloned.col).toBe(-1);
      expect(cloned.row).toBe(-1);
    });
  });

  describe('serialization', () => {
    describe('toJSON', () => {
      it('should return serializable object', () => {
        const tower = new Tower(TowerType.FIRE, 3);
        tower.setPosition(2, 4, 100, 200);

        const json = tower.toJSON();

        expect(json.type).toBe('fire');
        expect(json.tier).toBe(3);
        expect(json.col).toBe(2);
        expect(json.row).toBe(4);
      });
    });

    describe('fromJSON', () => {
      it('should create tower from serialized data', () => {
        const data = {
          type: 'earth',
          tier: 4,
          col: 1,
          row: 3
        };

        const tower = Tower.fromJSON(data);

        expect(tower.type).toBe('earth');
        expect(tower.tier).toBe(4);
        expect(tower.col).toBe(1);
        expect(tower.row).toBe(3);
      });

      it('should create valid Tower instance', () => {
        const data = { type: 'ice', tier: 2, col: 0, row: 0 };
        const tower = Tower.fromJSON(data);

        expect(tower instanceof Tower).toBe(true);
        expect(tower.canMergeWith).toBeDefined();
      });
    });

    it('should round-trip correctly', () => {
      const original = new Tower(TowerType.EARTH, 3);
      original.setPosition(2, 1, 100, 80);

      const json = original.toJSON();
      const restored = Tower.fromJSON(json);

      expect(restored.type).toBe(original.type);
      expect(restored.tier).toBe(original.tier);
      expect(restored.col).toBe(original.col);
      expect(restored.row).toBe(original.row);
    });
  });
});

describe('getMergeReward', () => {
  it('should return tier * 10 coins', () => {
    expect(getMergeReward(1)).toBe(10);
    expect(getMergeReward(2)).toBe(20);
    expect(getMergeReward(3)).toBe(30);
    expect(getMergeReward(4)).toBe(40);
    expect(getMergeReward(5)).toBe(50);
  });

  it('should scale linearly with tier', () => {
    const tier1Reward = getMergeReward(1);
    const tier2Reward = getMergeReward(2);
    expect(tier2Reward - tier1Reward).toBe(10);
  });
});

describe('getAvailableTowerTypes', () => {
  it('should return array of all tower types', () => {
    const types = getAvailableTowerTypes();
    expect(types).toContain('fire');
    expect(types).toContain('ice');
    expect(types).toContain('earth');
    expect(types.length).toBe(3);
  });
});

describe('Merge Logic Integration', () => {
  let game;
  let grid;

  beforeEach(() => {
    // Create mock game object
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;

    game = {
      canvas,
      effects: {
        spawnMergeBurst: jest.fn()
      },
      sound: {
        playMerge: jest.fn()
      },
      addCoins: jest.fn()
    };

    grid = new Grid(game);
    jest.clearAllMocks();
  });

  describe('checkMerge', () => {
    it('should trigger merge when placing adjacent same-type tower', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      grid.placeTower(0, 0, tower1);
      jest.clearAllMocks(); // Clear first placement

      grid.placeTower(1, 0, tower2);

      // Should have triggered merge
      expect(game.effects.spawnMergeBurst).toHaveBeenCalled();
      expect(game.addCoins).toHaveBeenCalledWith(10); // tier 1 * 10
    });

    it('should create tier 2 tower after merge', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      grid.placeTower(0, 0, tower1);
      grid.placeTower(1, 0, tower2);

      // Merged tower goes to position of newly placed tower (1,0), original position is empty
      const mergedTower = grid.getTower(1, 0);
      expect(mergedTower.tier).toBe(2);
      expect(grid.getTower(0, 0)).toBeNull();
    });

    it('should not merge different types', () => {
      const fireTower = new Tower(TowerType.FIRE, 1);
      const iceTower = new Tower(TowerType.ICE, 1);

      grid.placeTower(0, 0, fireTower);
      grid.placeTower(1, 0, iceTower);

      // Both towers should remain
      expect(grid.getTower(0, 0).type).toBe('fire');
      expect(grid.getTower(1, 0).type).toBe('ice');
    });

    it('should not merge different tiers', () => {
      const tier1Tower = new Tower(TowerType.FIRE, 1);
      const tier2Tower = new Tower(TowerType.FIRE, 2);

      grid.placeTower(0, 0, tier1Tower);
      // Manually set to avoid automatic merge detection
      grid.cells[grid.getIndex(1, 0)] = tier2Tower;

      // Both towers should remain
      expect(grid.getTower(0, 0).tier).toBe(1);
      expect(grid.getTower(1, 0).tier).toBe(2);
    });

    it('should not merge max tier towers', () => {
      const maxTier1 = new Tower(TowerType.FIRE, 5);
      const maxTier2 = new Tower(TowerType.FIRE, 5);

      // Manually place to avoid merge check
      grid.cells[grid.getIndex(0, 0)] = maxTier1;
      maxTier1.col = 0;
      maxTier1.row = 0;

      grid.cells[grid.getIndex(1, 0)] = maxTier2;
      maxTier2.col = 1;
      maxTier2.row = 0;

      // Manually trigger merge check
      const merged = grid.checkMerge(0, 0);

      expect(merged).toBe(false);
      expect(grid.getTower(0, 0).tier).toBe(5);
      expect(grid.getTower(1, 0).tier).toBe(5);
    });
  });

  describe('chain merges', () => {
    it('should perform chain merge when result can merge again', () => {
      // Set up: place tier 2 tower at (2,0), then tier 1 towers at (0,0) and (1,0)
      // When tier 1 at (1,0) is placed, it merges with (0,0) to create tier 2 at (1,0)
      // That tier 2 at (1,0) then chain merges with tier 2 at (2,0) to create tier 3 at (1,0)

      const tier2Tower = new Tower(TowerType.FIRE, 2);
      grid.cells[grid.getIndex(2, 0)] = tier2Tower;
      tier2Tower.col = 2;
      tier2Tower.row = 0;

      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      // Place first tier 1 at (0,0)
      grid.placeTower(0, 0, tower1);

      // Place second tier 1 at (1,0) - should merge with (0,0) to create tier 2 at (1,0)
      // That tier 2 should then chain merge with tier 2 at (2,0) to create tier 3 at (1,0)
      grid.placeTower(1, 0, tower2);

      // The chain should result in a tier 3 tower at the newly placed position (1,0)
      const finalTower = grid.getTower(1, 0);
      expect(finalTower.tier).toBe(3);

      // Other positions should be empty
      expect(grid.getTower(0, 0)).toBeNull();
      expect(grid.getTower(2, 0)).toBeNull();
    });

    it('should award coins for each merge in chain', () => {
      const tier2Tower = new Tower(TowerType.FIRE, 2);
      grid.cells[grid.getIndex(2, 0)] = tier2Tower;
      tier2Tower.col = 2;
      tier2Tower.row = 0;

      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      grid.placeTower(0, 0, tower1);
      jest.clearAllMocks();

      grid.placeTower(1, 0, tower2);

      // Should have two merges: tier 1 merge (10 coins) + tier 2 merge (20 coins)
      expect(game.addCoins).toHaveBeenCalledTimes(2);
      expect(game.addCoins).toHaveBeenCalledWith(10); // First merge (tier 1)
      expect(game.addCoins).toHaveBeenCalledWith(20); // Chain merge (tier 2)
    });

    it('should trigger effects for each merge in chain', () => {
      const tier2Tower = new Tower(TowerType.FIRE, 2);
      grid.cells[grid.getIndex(2, 0)] = tier2Tower;
      tier2Tower.col = 2;
      tier2Tower.row = 0;

      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      grid.placeTower(0, 0, tower1);
      jest.clearAllMocks();

      grid.placeTower(1, 0, tower2);

      // Should have triggered burst effects twice
      expect(game.effects.spawnMergeBurst).toHaveBeenCalledTimes(2);
    });
  });

  describe('performMerge', () => {
    it('should preserve tower type after merge', () => {
      const tower1 = new Tower(TowerType.ICE, 2);
      const tower2 = new Tower(TowerType.ICE, 2);

      grid.placeTower(0, 0, tower1);
      grid.placeTower(1, 0, tower2);

      // Merged tower goes to the newly placed position (1,0)
      const mergedTower = grid.getTower(1, 0);
      expect(mergedTower.type).toBe('ice');
    });

    it('should place merged tower at newly placed position', () => {
      const tower1 = new Tower(TowerType.EARTH, 1);
      const tower2 = new Tower(TowerType.EARTH, 1);

      grid.placeTower(2, 2, tower1);
      grid.placeTower(3, 2, tower2);

      // Merged tower should be at position (3, 2) - where the new tower was placed
      const mergedTower = grid.getTower(3, 2);
      expect(mergedTower).not.toBeNull();
      expect(mergedTower.tier).toBe(2);
      expect(grid.getTower(2, 2)).toBeNull();
    });

    it('should update merged tower pixel position', () => {
      const tower1 = new Tower(TowerType.FIRE, 1);
      const tower2 = new Tower(TowerType.FIRE, 1);

      grid.placeTower(1, 1, tower1);
      grid.placeTower(2, 1, tower2);

      // Merged tower goes to position (2,1) - where the new tower was placed
      const mergedTower = grid.getTower(2, 1);
      const expectedCenter = grid.getCellCenter(2, 1);

      expect(mergedTower.x).toBe(expectedCenter.x);
      expect(mergedTower.y).toBe(expectedCenter.y);
      expect(mergedTower.col).toBe(2);
      expect(mergedTower.row).toBe(1);
    });
  });
});
