/**
 * Unit tests for Grid class
 * Tests cell lookup, adjacent cells, tower placement, and merge logic
 */

// Mock the renderer module
jest.unstable_mockModule('../src/renderer.js', () => ({
  COLORS: {
    gridCell: '#1a1a2e',
    gridLine: '#0f3460',
    accent: '#e94560'
  }
}));

// Mock the tower module
const mockTower = {
  type: 'fire',
  tier: 1,
  col: 0,
  row: 0,
  x: 0,
  y: 0,
  canMergeWith: jest.fn((other) => other.type === 'fire' && other.tier === 1),
  render: jest.fn()
};

const mockGetMergeReward = jest.fn((tier) => tier * 10);

jest.unstable_mockModule('../src/tower.js', () => ({
  Tower: jest.fn().mockImplementation((type, tier) => ({
    type,
    tier,
    col: 0,
    row: 0,
    x: 0,
    y: 0,
    canMergeWith: jest.fn((other) => other.type === type && other.tier === tier),
    render: jest.fn()
  })),
  getMergeReward: mockGetMergeReward
}));

// Import Grid after mocks are set up
const { Grid } = await import('../src/grid.js');

describe('Grid', () => {
  let game;
  let grid;

  beforeEach(() => {
    // Create mock game object with canvas
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;

    game = {
      canvas,
      effects: {
        spawnMergeBurst: jest.fn()
      },
      addCoins: jest.fn()
    };

    // Create grid with default options
    grid = new Grid(game);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a 5x5 grid by default', () => {
      expect(grid.cols).toBe(5);
      expect(grid.rows).toBe(5);
      expect(grid.cells.length).toBe(25);
    });

    it('should use 64px cell size by default', () => {
      expect(grid.cellSize).toBe(64);
    });

    it('should center the grid horizontally', () => {
      // Canvas width is 480, grid width is 5*64 = 320
      // Expected offset: (480 - 320) / 2 = 80
      expect(grid.offsetX).toBe(80);
    });

    it('should use 60px vertical offset by default', () => {
      expect(grid.offsetY).toBe(60);
    });

    it('should allow custom grid dimensions', () => {
      const customGrid = new Grid(game, { cols: 3, rows: 4 });
      expect(customGrid.cols).toBe(3);
      expect(customGrid.rows).toBe(4);
      expect(customGrid.cells.length).toBe(12);
    });

    it('should allow custom cell size', () => {
      const customGrid = new Grid(game, { cellSize: 32 });
      expect(customGrid.cellSize).toBe(32);
      expect(customGrid.width).toBe(160); // 5 * 32
    });

    it('should initialize all cells as null', () => {
      expect(grid.cells.every(cell => cell === null)).toBe(true);
    });
  });

  describe('getCellAt', () => {
    it('should return correct cell for pixel coordinates in top-left cell', () => {
      // Cell (0,0) starts at (offsetX, offsetY) = (80, 60)
      const cell = grid.getCellAt(80, 60);
      expect(cell).toEqual({ col: 0, row: 0, index: 0 });
    });

    it('should return correct cell for center of grid', () => {
      // Cell (2,2) center: offsetX + 2.5*64, offsetY + 2.5*64
      const cell = grid.getCellAt(80 + 160, 60 + 160);
      expect(cell).toEqual({ col: 2, row: 2, index: 12 });
    });

    it('should return correct cell for bottom-right cell', () => {
      // Cell (4,4): offsetX + 4*64 to offsetX + 5*64
      const cell = grid.getCellAt(80 + 256, 60 + 256);
      expect(cell).toEqual({ col: 4, row: 4, index: 24 });
    });

    it('should return null for coordinates outside grid bounds (left)', () => {
      const cell = grid.getCellAt(70, 100);
      expect(cell).toBeNull();
    });

    it('should return null for coordinates outside grid bounds (above)', () => {
      const cell = grid.getCellAt(100, 50);
      expect(cell).toBeNull();
    });

    it('should return null for coordinates outside grid bounds (right)', () => {
      const cell = grid.getCellAt(80 + 320, 100);
      expect(cell).toBeNull();
    });

    it('should return null for coordinates outside grid bounds (below)', () => {
      const cell = grid.getCellAt(100, 60 + 320);
      expect(cell).toBeNull();
    });

    it('should return null for negative coordinates', () => {
      const cell = grid.getCellAt(-10, -10);
      expect(cell).toBeNull();
    });

    it('should handle edge of cell correctly', () => {
      // Just at the edge of cell (0,0) - should still be cell 0
      const cell = grid.getCellAt(80 + 63, 60 + 63);
      expect(cell).toEqual({ col: 0, row: 0, index: 0 });
    });

    it('should transition to next cell at boundary', () => {
      // First pixel of cell (1,0)
      const cell = grid.getCellAt(80 + 64, 60);
      expect(cell).toEqual({ col: 1, row: 0, index: 1 });
    });
  });

  describe('getIndex', () => {
    it('should return correct index for top-left cell', () => {
      expect(grid.getIndex(0, 0)).toBe(0);
    });

    it('should return correct index for first row', () => {
      expect(grid.getIndex(3, 0)).toBe(3);
    });

    it('should return correct index for second row', () => {
      expect(grid.getIndex(0, 1)).toBe(5);
      expect(grid.getIndex(2, 1)).toBe(7);
    });

    it('should return correct index for bottom-right cell', () => {
      expect(grid.getIndex(4, 4)).toBe(24);
    });
  });

  describe('getColRow', () => {
    it('should return correct col/row for index 0', () => {
      expect(grid.getColRow(0)).toEqual({ col: 0, row: 0 });
    });

    it('should return correct col/row for end of first row', () => {
      expect(grid.getColRow(4)).toEqual({ col: 4, row: 0 });
    });

    it('should return correct col/row for start of second row', () => {
      expect(grid.getColRow(5)).toEqual({ col: 0, row: 1 });
    });

    it('should return correct col/row for bottom-right cell', () => {
      expect(grid.getColRow(24)).toEqual({ col: 4, row: 4 });
    });

    it('should be inverse of getIndex', () => {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const index = grid.getIndex(col, row);
          const result = grid.getColRow(index);
          expect(result).toEqual({ col, row });
        }
      }
    });
  });

  describe('getAdjacentCells', () => {
    it('should return 4 adjacent cells for center cell', () => {
      const adjacent = grid.getAdjacentCells(2, 2);
      expect(adjacent.length).toBe(4);

      // Check all 4 directions are present
      const positions = adjacent.map(a => `${a.col},${a.row}`);
      expect(positions).toContain('1,2'); // Left
      expect(positions).toContain('3,2'); // Right
      expect(positions).toContain('2,1'); // Up
      expect(positions).toContain('2,3'); // Down
    });

    it('should return 2 adjacent cells for corner cell (0,0)', () => {
      const adjacent = grid.getAdjacentCells(0, 0);
      expect(adjacent.length).toBe(2);

      const positions = adjacent.map(a => `${a.col},${a.row}`);
      expect(positions).toContain('1,0'); // Right
      expect(positions).toContain('0,1'); // Down
    });

    it('should return 2 adjacent cells for corner cell (4,4)', () => {
      const adjacent = grid.getAdjacentCells(4, 4);
      expect(adjacent.length).toBe(2);

      const positions = adjacent.map(a => `${a.col},${a.row}`);
      expect(positions).toContain('3,4'); // Left
      expect(positions).toContain('4,3'); // Up
    });

    it('should return 3 adjacent cells for edge cell (0,2)', () => {
      const adjacent = grid.getAdjacentCells(0, 2);
      expect(adjacent.length).toBe(3);

      const positions = adjacent.map(a => `${a.col},${a.row}`);
      expect(positions).toContain('1,2'); // Right
      expect(positions).toContain('0,1'); // Up
      expect(positions).toContain('0,3'); // Down
      expect(positions).not.toContain('-1,2'); // No left
    });

    it('should return 3 adjacent cells for edge cell (2,0)', () => {
      const adjacent = grid.getAdjacentCells(2, 0);
      expect(adjacent.length).toBe(3);

      const positions = adjacent.map(a => `${a.col},${a.row}`);
      expect(positions).toContain('1,0'); // Left
      expect(positions).toContain('3,0'); // Right
      expect(positions).toContain('2,1'); // Down
    });

    it('should return correct indices for adjacent cells', () => {
      const adjacent = grid.getAdjacentCells(2, 2);

      for (const cell of adjacent) {
        expect(cell.index).toBe(grid.getIndex(cell.col, cell.row));
      }
    });
  });

  describe('getCellCenter', () => {
    it('should return center of cell (0,0)', () => {
      const center = grid.getCellCenter(0, 0);
      expect(center).toEqual({
        x: 80 + 32, // offsetX + cellSize/2
        y: 60 + 32  // offsetY + cellSize/2
      });
    });

    it('should return center of cell (2,2)', () => {
      const center = grid.getCellCenter(2, 2);
      expect(center).toEqual({
        x: 80 + 2 * 64 + 32,
        y: 60 + 2 * 64 + 32
      });
    });
  });

  describe('getCellPosition', () => {
    it('should return top-left of cell (0,0)', () => {
      const pos = grid.getCellPosition(0, 0);
      expect(pos).toEqual({ x: 80, y: 60 });
    });

    it('should return top-left of cell (1,1)', () => {
      const pos = grid.getCellPosition(1, 1);
      expect(pos).toEqual({ x: 80 + 64, y: 60 + 64 });
    });
  });

  describe('tower placement', () => {
    let tower;

    beforeEach(() => {
      tower = {
        type: 'fire',
        tier: 1,
        col: 0,
        row: 0,
        x: 0,
        y: 0,
        canMergeWith: jest.fn(() => false),
        render: jest.fn()
      };
    });

    describe('placeTower', () => {
      it('should place a tower in an empty cell', () => {
        const result = grid.placeTower(0, 0, tower);
        expect(result).toBe(true);
        expect(grid.cells[0]).toBe(tower);
      });

      it('should update tower position after placement', () => {
        grid.placeTower(2, 3, tower);
        expect(tower.col).toBe(2);
        expect(tower.row).toBe(3);
        expect(tower.x).toBe(80 + 2 * 64 + 32);
        expect(tower.y).toBe(60 + 3 * 64 + 32);
      });

      it('should fail to place tower in occupied cell', () => {
        grid.placeTower(0, 0, tower);

        const tower2 = { ...tower };
        const result = grid.placeTower(0, 0, tower2);
        expect(result).toBe(false);
        expect(grid.cells[0]).toBe(tower);
      });

      it('should fail to place tower outside grid bounds', () => {
        expect(grid.placeTower(-1, 0, tower)).toBe(false);
        expect(grid.placeTower(0, -1, tower)).toBe(false);
        expect(grid.placeTower(5, 0, tower)).toBe(false);
        expect(grid.placeTower(0, 5, tower)).toBe(false);
      });
    });

    describe('getTower', () => {
      it('should return tower at position', () => {
        grid.placeTower(1, 2, tower);
        expect(grid.getTower(1, 2)).toBe(tower);
      });

      it('should return null for empty cell', () => {
        expect(grid.getTower(0, 0)).toBeNull();
      });
    });

    describe('removeTower', () => {
      it('should remove and return tower from cell', () => {
        grid.placeTower(0, 0, tower);
        const removed = grid.removeTower(0, 0);
        expect(removed).toBe(tower);
        expect(grid.cells[0]).toBeNull();
      });

      it('should return null when removing from empty cell', () => {
        const removed = grid.removeTower(0, 0);
        expect(removed).toBeNull();
      });
    });

    describe('isCellEmpty', () => {
      it('should return true for empty cell', () => {
        expect(grid.isCellEmpty(0, 0)).toBe(true);
      });

      it('should return false for occupied cell', () => {
        grid.placeTower(0, 0, tower);
        expect(grid.isCellEmpty(0, 0)).toBe(false);
      });
    });
  });

  describe('getAllTowers', () => {
    it('should return empty array when no towers', () => {
      expect(grid.getAllTowers()).toEqual([]);
    });

    it('should return all placed towers', () => {
      const tower1 = { type: 'fire', tier: 1, canMergeWith: () => false };
      const tower2 = { type: 'ice', tier: 2, canMergeWith: () => false };

      grid.cells[0] = tower1;
      grid.cells[5] = tower2;

      const towers = grid.getAllTowers();
      expect(towers.length).toBe(2);
      expect(towers).toContainEqual({ tower: tower1, col: 0, row: 0, index: 0 });
      expect(towers).toContainEqual({ tower: tower2, col: 0, row: 1, index: 5 });
    });
  });

  describe('getTowerCount', () => {
    it('should return 0 for empty grid', () => {
      expect(grid.getTowerCount()).toBe(0);
    });

    it('should count placed towers correctly', () => {
      grid.cells[0] = { type: 'fire' };
      grid.cells[5] = { type: 'ice' };
      grid.cells[10] = { type: 'earth' };

      expect(grid.getTowerCount()).toBe(3);
    });
  });

  describe('isFull', () => {
    it('should return false for empty grid', () => {
      expect(grid.isFull()).toBe(false);
    });

    it('should return false for partially filled grid', () => {
      grid.cells[0] = { type: 'fire' };
      expect(grid.isFull()).toBe(false);
    });

    it('should return true when all cells are occupied', () => {
      grid.cells.fill({ type: 'fire' });
      expect(grid.isFull()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all cells', () => {
      grid.cells[0] = { type: 'fire' };
      grid.cells[5] = { type: 'ice' };
      grid.highlightedCell = { col: 1, row: 1 };

      grid.reset();

      expect(grid.cells.every(c => c === null)).toBe(true);
      expect(grid.highlightedCell).toBeNull();
    });
  });

  describe('highlight', () => {
    it('should set highlighted cell', () => {
      grid.setHighlight(2, 3);
      expect(grid.highlightedCell).toEqual({ col: 2, row: 3 });
    });

    it('should clear highlight with null', () => {
      grid.setHighlight(2, 3);
      grid.setHighlight(null, null);
      expect(grid.highlightedCell).toBeNull();
    });
  });
});
