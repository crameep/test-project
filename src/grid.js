/**
 * Micro Tower Defense - Merge Madness
 * Grid system and cell management
 */

import { COLORS } from './renderer.js';
import { Tower, getMergeReward } from './tower.js';

// Grid configuration
const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 5;
const DEFAULT_CELL_SIZE = 64;

/**
 * Grid class - manages the tower placement grid
 */
export class Grid {
    /**
     * @param {Object} game - Reference to the main game instance
     * @param {Object} options - Grid configuration options
     * @param {number} [options.cols=5] - Number of columns
     * @param {number} [options.rows=5] - Number of rows
     * @param {number} [options.cellSize=64] - Size of each cell in pixels
     * @param {number} [options.offsetX] - X offset for grid position (defaults to centered)
     * @param {number} [options.offsetY=60] - Y offset for grid position
     */
    constructor(game, options = {}) {
        this.game = game;

        // Grid dimensions
        this.cols = options.cols || DEFAULT_COLS;
        this.rows = options.rows || DEFAULT_ROWS;
        this.cellSize = options.cellSize || DEFAULT_CELL_SIZE;

        // Calculate grid pixel dimensions
        this.width = this.cols * this.cellSize;
        this.height = this.rows * this.cellSize;

        // Calculate offset to center grid on canvas
        const canvasWidth = game.canvas.width;
        this.offsetX = options.offsetX !== undefined
            ? options.offsetX
            : Math.floor((canvasWidth - this.width) / 2);
        this.offsetY = options.offsetY !== undefined
            ? options.offsetY
            : 60;

        // Cell storage - flat array for efficiency
        // Each cell can hold a tower or null
        this.cells = new Array(this.cols * this.rows).fill(null);

        // Track highlighted cell for drag-drop feedback
        this.highlightedCell = null;
    }

    /**
     * Reset the grid to initial state
     */
    reset() {
        this.cells.fill(null);
        this.highlightedCell = null;
    }

    /**
     * Convert pixel coordinates to cell information
     * @param {number} x - X position in pixels (relative to canvas)
     * @param {number} y - Y position in pixels (relative to canvas)
     * @returns {Object|null} Cell info {col, row, index} or null if outside grid
     */
    getCellAt(x, y) {
        // Adjust for grid offset
        const gridX = x - this.offsetX;
        const gridY = y - this.offsetY;

        // Calculate column and row
        const col = Math.floor(gridX / this.cellSize);
        const row = Math.floor(gridY / this.cellSize);

        // Check bounds
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return null;
        }

        return {
            col,
            row,
            index: this.getIndex(col, row)
        };
    }

    /**
     * Convert column and row to flat array index
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {number} Flat array index
     */
    getIndex(col, row) {
        return row * this.cols + col;
    }

    /**
     * Convert flat array index to column and row
     * @param {number} index - Flat array index
     * @returns {Object} {col, row}
     */
    getColRow(index) {
        return {
            col: index % this.cols,
            row: Math.floor(index / this.cols)
        };
    }

    /**
     * Get the center position of a cell in pixel coordinates
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Object} {x, y} center position in pixels
     */
    getCellCenter(col, row) {
        return {
            x: this.offsetX + col * this.cellSize + this.cellSize / 2,
            y: this.offsetY + row * this.cellSize + this.cellSize / 2
        };
    }

    /**
     * Get the top-left position of a cell in pixel coordinates
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Object} {x, y} top-left position in pixels
     */
    getCellPosition(col, row) {
        return {
            x: this.offsetX + col * this.cellSize,
            y: this.offsetY + row * this.cellSize
        };
    }

    /**
     * Get adjacent cells (up, down, left, right)
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Array} Array of adjacent cell info {col, row, index}
     */
    getAdjacentCells(col, row) {
        const adjacent = [];
        const offsets = [
            [-1, 0],  // Left
            [1, 0],   // Right
            [0, -1],  // Up
            [0, 1]    // Down
        ];

        for (const [dx, dy] of offsets) {
            const nc = col + dx;
            const nr = row + dy;

            // Check bounds
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                adjacent.push({
                    col: nc,
                    row: nr,
                    index: this.getIndex(nc, nr)
                });
            }
        }

        return adjacent;
    }

    /**
     * Get the tower at a specific cell
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Object|null} Tower at cell or null
     */
    getTower(col, row) {
        const index = this.getIndex(col, row);
        return this.cells[index];
    }

    /**
     * Get the tower at a pixel position
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     * @returns {Object|null} Tower at position or null
     */
    getTowerAt(x, y) {
        const cell = this.getCellAt(x, y);
        if (!cell) return null;
        return this.cells[cell.index];
    }

    /**
     * Check if a cell is empty
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {boolean} True if cell is empty
     */
    isCellEmpty(col, row) {
        const index = this.getIndex(col, row);
        return this.cells[index] === null;
    }

    /**
     * Place a tower at a specific cell
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @param {Object} tower - Tower to place
     * @returns {boolean} True if placement was successful
     */
    placeTower(col, row, tower) {
        // Check bounds
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return false;
        }

        const index = this.getIndex(col, row);

        // Check if cell is already occupied
        if (this.cells[index] !== null) {
            return false;
        }

        // Place the tower
        this.cells[index] = tower;

        // Update tower's position
        if (tower) {
            tower.col = col;
            tower.row = row;
            const center = this.getCellCenter(col, row);
            tower.x = center.x;
            tower.y = center.y;
        }

        // Check for merges with adjacent same-type/tier towers
        this.checkMerge(col, row);

        return true;
    }

    /**
     * Remove a tower from a cell
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Object|null} Removed tower or null
     */
    removeTower(col, row) {
        const index = this.getIndex(col, row);
        const tower = this.cells[index];
        this.cells[index] = null;
        return tower;
    }

    /**
     * Check for possible merges at a cell
     * Performs instant merge if adjacent same-type/tier tower is found
     * Supports recursive chain merges
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {boolean} True if a merge occurred
     */
    checkMerge(col, row) {
        const tower = this.getTower(col, row);
        if (!tower) return false;

        // Cannot merge max tier towers
        if (tower.tier >= 5) return false;

        const adjacent = this.getAdjacentCells(col, row);
        for (const cell of adjacent) {
            const neighbor = this.cells[cell.index];
            // Check if neighbor can merge using tower's canMergeWith method
            if (neighbor && tower.canMergeWith(neighbor)) {
                // INSTANT MERGE - no delay!
                this.performMerge(col, row, cell.col, cell.row);
                return true;
            }
        }
        return false;
    }

    /**
     * Perform a merge between two towers
     * Creates an upgraded tower at the first position
     * Triggers burst effects and coin rewards
     * Recursively checks for chain merges
     * @param {number} col1 - Column of first tower (will keep the merged tower)
     * @param {number} row1 - Row of first tower
     * @param {number} col2 - Column of second tower (will be removed)
     * @param {number} row2 - Row of second tower
     */
    performMerge(col1, row1, col2, row2) {
        const tower1 = this.getTower(col1, row1);
        const tower2 = this.getTower(col2, row2);

        if (!tower1 || !tower2) return;

        // Store tower info before removal
        const towerType = tower1.type;
        const originalTier = tower1.tier;
        const newTier = originalTier + 1;

        // Remove both towers from grid
        this.cells[this.getIndex(col1, row1)] = null;
        this.cells[this.getIndex(col2, row2)] = null;

        // Create upgraded tower at first position
        const mergedTower = new Tower(towerType, newTier);

        // Place the merged tower directly (without triggering another merge check yet)
        this.cells[this.getIndex(col1, row1)] = mergedTower;

        // Update tower's position
        mergedTower.col = col1;
        mergedTower.row = row1;
        const center = this.getCellCenter(col1, row1);
        mergedTower.x = center.x;
        mergedTower.y = center.y;

        // Trigger burst effects if effects manager exists
        if (this.game.effects) {
            this.game.effects.spawnMergeBurst(col1, row1);
        }

        // Play merge sound
        if (this.game.sound) {
            this.game.sound.playMerge();
        }

        // Add coin reward based on tier
        const reward = getMergeReward(originalTier);
        this.game.addCoins(reward);

        // Recursively check for chain merges
        // The merged tower might be able to merge with other adjacent towers
        this.checkMerge(col1, row1);
    }

    /**
     * Get all towers on the grid
     * @returns {Array} Array of {tower, col, row, index}
     */
    getAllTowers() {
        const towers = [];
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i] !== null) {
                const { col, row } = this.getColRow(i);
                towers.push({
                    tower: this.cells[i],
                    col,
                    row,
                    index: i
                });
            }
        }
        return towers;
    }

    /**
     * Count towers on the grid
     * @returns {number} Number of towers placed
     */
    getTowerCount() {
        return this.cells.filter(cell => cell !== null).length;
    }

    /**
     * Check if the grid is full
     * @returns {boolean} True if all cells are occupied
     */
    isFull() {
        return this.getTowerCount() === this.cells.length;
    }

    /**
     * Set the highlighted cell for drag-drop feedback
     * @param {number|null} col - Column index or null to clear
     * @param {number|null} row - Row index or null to clear
     */
    setHighlight(col, row) {
        if (col === null || row === null) {
            this.highlightedCell = null;
        } else {
            this.highlightedCell = { col, row };
        }
    }

    /**
     * Render the grid
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        // Draw cell backgrounds and grid lines
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const pos = this.getCellPosition(col, row);

                // Draw cell background
                renderer.drawRect(
                    pos.x,
                    pos.y,
                    this.cellSize,
                    this.cellSize,
                    COLORS.gridCell
                );

                // Draw cell border
                renderer.drawRectOutline(
                    pos.x,
                    pos.y,
                    this.cellSize,
                    this.cellSize,
                    COLORS.gridLine
                );
            }
        }

        // Draw highlighted cell for drag-drop feedback
        if (this.highlightedCell) {
            const pos = this.getCellPosition(
                this.highlightedCell.col,
                this.highlightedCell.row
            );
            const isEmpty = this.isCellEmpty(
                this.highlightedCell.col,
                this.highlightedCell.row
            );
            renderer.drawCellHighlight(
                pos.x,
                pos.y,
                this.cellSize,
                COLORS.accent,
                isEmpty
            );
        }

        // Draw towers on the grid
        this.renderTowers(renderer);
    }

    /**
     * Render all towers on the grid
     * @param {Object} renderer - Renderer instance
     */
    renderTowers(renderer) {
        for (const { tower, col, row } of this.getAllTowers()) {
            if (tower && tower.render) {
                tower.render(renderer, this.cellSize);
            }
        }
    }
}
