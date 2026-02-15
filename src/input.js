/**
 * Micro Tower Defense - Merge Madness
 * Input handling for drag-and-drop tower placement
 */

import { Tower, TowerType } from './tower.js';
import { GameState } from './game.js';

/**
 * InputHandler class - manages mouse and touch input for drag-and-drop
 */
export class InputHandler {
    /**
     * @param {Object} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;

        // Drag state
        this.isDragging = false;
        this.draggedTower = null;
        this.draggedTowerOriginalCell = null; // Track where tower came from
        this.dragX = 0;
        this.dragY = 0;

        // Track active touch/pointer for multi-touch handling
        this.activePointerId = null;

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onTouchCancel = this.onTouchCancel.bind(this);

        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Attach all event listeners to the canvas
     */
    attachEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('mouseleave', this.onMouseUp);

        // Touch events - passive: false to allow preventDefault
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
    }

    /**
     * Remove all event listeners
     */
    detachEventListeners() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseUp);

        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.onTouchCancel);
    }

    /**
     * Get canvas-relative position from mouse event
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} {x, y} position relative to canvas
     */
    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    /**
     * Get canvas-relative position from touch event
     * @param {Touch} touch - Touch object
     * @returns {Object} {x, y} position relative to canvas
     */
    getTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;

        const pos = this.getMousePosition(event);
        this.handleDragStart(pos);
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseMove(event) {
        const pos = this.getMousePosition(event);
        this.handleDragMove(pos);
    }

    /**
     * Handle mouse up event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseUp(event) {
        const pos = this.getMousePosition(event);
        this.handleDragEnd(pos);
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    onTouchStart(event) {
        event.preventDefault();

        // Only track the first touch
        if (this.activePointerId !== null) return;
        if (event.touches.length === 0) return;

        const touch = event.touches[0];
        this.activePointerId = touch.identifier;

        const pos = this.getTouchPosition(touch);
        this.handleDragStart(pos);
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} event - Touch event
     */
    onTouchMove(event) {
        event.preventDefault();

        // Find the active touch
        const touch = this.findActiveTouch(event.touches);
        if (!touch) return;

        const pos = this.getTouchPosition(touch);
        this.handleDragMove(pos);
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} event - Touch event
     */
    onTouchEnd(event) {
        event.preventDefault();

        // Find the active touch in changedTouches
        const touch = this.findActiveTouch(event.changedTouches);
        if (!touch) return;

        const pos = this.getTouchPosition(touch);
        this.handleDragEnd(pos);
        this.activePointerId = null;
    }

    /**
     * Handle touch cancel event
     * @param {TouchEvent} event - Touch event
     */
    onTouchCancel(event) {
        event.preventDefault();
        this.cancelDrag();
        this.activePointerId = null;
    }

    /**
     * Find the active touch by identifier
     * @param {TouchList} touches - Touch list to search
     * @returns {Touch|null} Active touch or null
     */
    findActiveTouch(touches) {
        for (let i = 0; i < touches.length; i++) {
            if (touches[i].identifier === this.activePointerId) {
                return touches[i];
            }
        }
        return null;
    }

    /**
     * Handle drag start at position
     * @param {Object} pos - {x, y} position
     */
    handleDragStart(pos) {
        // Handle non-playing state clicks
        if (this.game.state !== GameState.PLAYING) {
            this.handleNonPlayingClick(pos);
            return;
        }

        // Check if clicking on a tower in the grid
        const tower = this.game.grid.getTowerAt(pos.x, pos.y);
        if (tower) {
            // Pick up tower from grid
            this.startDragFromGrid(tower, pos);
            return;
        }

        // Check if clicking on tower panel (when UI is implemented)
        if (this.game.ui) {
            const panelTower = this.game.ui.getTowerFromPanel(pos.x, pos.y);
            if (panelTower) {
                this.startDragFromPanel(panelTower, pos);
                return;
            }
        }
    }

    /**
     * Handle clicks in non-playing states (menu, pause, game over)
     * @param {Object} pos - {x, y} position
     */
    handleNonPlayingClick(pos) {
        switch (this.game.state) {
            case GameState.MENU:
                this.handleMenuClick(pos);
                break;
            case GameState.UPGRADES:
                this.handleUpgradesClick(pos);
                break;
            case GameState.PAUSED:
                this.game.resume();
                break;
            case GameState.GAME_OVER:
                this.game.setState(GameState.MENU);
                break;
        }
    }

    /**
     * Handle clicks on the main menu
     * @param {Object} pos - {x, y} position
     */
    handleMenuClick(pos) {
        // Check for menu button clicks
        const buttonId = this.game.getMenuButtonAt(pos.x, pos.y);

        if (buttonId === 'play') {
            this.game.startRun();
        } else if (buttonId === 'upgrades') {
            this.game.setState(GameState.UPGRADES);
        }
    }

    /**
     * Handle clicks on the upgrades menu
     * @param {Object} pos - {x, y} position
     */
    handleUpgradesClick(pos) {
        if (this.game.ui && this.game.ui.upgradeMenu) {
            const action = this.game.ui.upgradeMenu.handleClick(pos.x, pos.y);

            if (action === 'back') {
                this.game.setState(GameState.MENU);
            }
            // 'purchase' action is handled internally by UpgradeMenu
        }
    }

    /**
     * Start dragging a tower from the grid
     * @param {Tower} tower - Tower to drag
     * @param {Object} pos - Current cursor position
     */
    startDragFromGrid(tower, pos) {
        this.isDragging = true;
        this.draggedTower = tower;
        this.draggedTowerOriginalCell = { col: tower.col, row: tower.row };

        // Set tower to dragging state
        tower.isDragging = true;
        tower.dragX = pos.x;
        tower.dragY = pos.y;

        // Store drag position
        this.dragX = pos.x;
        this.dragY = pos.y;

        // Remove tower from grid temporarily
        this.game.grid.removeTower(tower.col, tower.row);

        // Update highlight
        this.updateHighlight(pos);
    }

    /**
     * Start dragging a new tower from the panel
     * @param {Tower} panelTower - Tower template from panel
     * @param {Object} pos - Current cursor position
     */
    startDragFromPanel(panelTower, pos) {
        // Clone the tower from the panel
        const newTower = panelTower.clone();

        this.isDragging = true;
        this.draggedTower = newTower;
        this.draggedTowerOriginalCell = null; // No original cell - it's new

        // Set tower to dragging state
        newTower.isDragging = true;
        newTower.dragX = pos.x;
        newTower.dragY = pos.y;

        // Store drag position
        this.dragX = pos.x;
        this.dragY = pos.y;

        // Update highlight
        this.updateHighlight(pos);
    }

    /**
     * Handle drag move at position
     * @param {Object} pos - {x, y} position
     */
    handleDragMove(pos) {
        // Always update drag position
        this.dragX = pos.x;
        this.dragY = pos.y;

        if (!this.isDragging || !this.draggedTower) {
            // Clear highlight when not dragging
            this.game.grid.setHighlight(null, null);
            return;
        }

        // Update tower drag position
        this.draggedTower.dragX = pos.x;
        this.draggedTower.dragY = pos.y;

        // Update cell highlight
        this.updateHighlight(pos);
    }

    /**
     * Update the grid cell highlight based on cursor position
     * @param {Object} pos - {x, y} position
     */
    updateHighlight(pos) {
        const cell = this.game.grid.getCellAt(pos.x, pos.y);
        if (cell) {
            this.game.grid.setHighlight(cell.col, cell.row);
        } else {
            this.game.grid.setHighlight(null, null);
        }
    }

    /**
     * Handle drag end at position
     * @param {Object} pos - {x, y} position
     */
    handleDragEnd(pos) {
        if (!this.isDragging || !this.draggedTower) {
            return;
        }

        // Clear tower dragging state
        this.draggedTower.isDragging = false;

        // Try to place tower on grid
        const cell = this.game.grid.getCellAt(pos.x, pos.y);
        let placed = false;

        if (cell) {
            // Check if cell is empty or if it's the original cell
            const isOriginalCell = this.draggedTowerOriginalCell &&
                cell.col === this.draggedTowerOriginalCell.col &&
                cell.row === this.draggedTowerOriginalCell.row;

            if (this.game.grid.isCellEmpty(cell.col, cell.row) || isOriginalCell) {
                // Place the tower
                placed = this.game.grid.placeTower(cell.col, cell.row, this.draggedTower);
            }
        }

        // If not placed and tower came from grid, return it to original position
        if (!placed && this.draggedTowerOriginalCell) {
            this.game.grid.placeTower(
                this.draggedTowerOriginalCell.col,
                this.draggedTowerOriginalCell.row,
                this.draggedTower
            );
        }

        // Clear drag state
        this.clearDragState();
    }

    /**
     * Cancel current drag operation
     */
    cancelDrag() {
        if (!this.isDragging || !this.draggedTower) {
            return;
        }

        // Clear tower dragging state
        this.draggedTower.isDragging = false;

        // If tower came from grid, return it to original position
        if (this.draggedTowerOriginalCell) {
            this.game.grid.placeTower(
                this.draggedTowerOriginalCell.col,
                this.draggedTowerOriginalCell.row,
                this.draggedTower
            );
        }

        // Clear drag state
        this.clearDragState();
    }

    /**
     * Clear all drag-related state
     */
    clearDragState() {
        this.isDragging = false;
        this.draggedTower = null;
        this.draggedTowerOriginalCell = null;
        this.game.grid.setHighlight(null, null);
    }

    /**
     * Check if currently dragging
     * @returns {boolean} True if dragging a tower
     */
    isDraggingTower() {
        return this.isDragging && this.draggedTower !== null;
    }

    /**
     * Get the currently dragged tower
     * @returns {Tower|null} Dragged tower or null
     */
    getDraggedTower() {
        return this.draggedTower;
    }

    /**
     * Render the dragged tower (called from game render loop)
     * @param {Object} renderer - Renderer instance
     */
    render(renderer) {
        if (this.isDragging && this.draggedTower) {
            // Render dragged tower at cursor position
            this.draggedTower.render(renderer, this.game.grid.cellSize);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.detachEventListeners();
        this.clearDragState();
    }
}
