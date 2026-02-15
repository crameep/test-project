/**
 * Micro Tower Defense - Merge Madness
 * Canvas rendering utilities
 */

/**
 * Renderer class - handles all canvas drawing operations
 */
export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas element to render to
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Shake offset for screen shake effect
        this.shakeOffset = { x: 0, y: 0 };
    }

    /**
     * Set the shake offset for screen shake effect
     * @param {number} x - X offset in pixels
     * @param {number} y - Y offset in pixels
     */
    setShakeOffset(x, y) {
        this.shakeOffset.x = x;
        this.shakeOffset.y = y;
    }

    /**
     * Clear the entire canvas
     * @param {string} [color='#16213e'] - Background color
     */
    clear(color = '#16213e') {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for clearing
        // Clear the canvas first
        this.ctx.clearRect(0, 0, this.width, this.height);
        // Then fill with background color
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
    }

    /**
     * Apply shake offset transform for rendering
     */
    applyShakeTransform() {
        this.ctx.setTransform(1, 0, 0, 1, this.shakeOffset.x, this.shakeOffset.y);
    }

    /**
     * Reset transform to identity
     */
    resetTransform() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Draw a filled rectangle
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {string} color - Fill color
     */
    drawRect(x, y, width, height, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
    }

    /**
     * Draw a stroked rectangle (outline only)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {string} color - Stroke color
     * @param {number} [lineWidth=1] - Line width
     */
    drawRectOutline(x, y, width, height, color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(x, y, width, height);
    }

    /**
     * Draw a filled circle
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} radius - Circle radius
     * @param {string} color - Fill color
     */
    drawCircle(x, y, radius, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Draw a stroked circle (outline only)
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} radius - Circle radius
     * @param {string} color - Stroke color
     * @param {number} [lineWidth=1] - Line width
     */
    drawCircleOutline(x, y, radius, color, lineWidth = 1) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    /**
     * Draw text on the canvas
     * @param {string} text - Text to draw
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} [color='#ffffff'] - Text color
     * @param {string} [font='16px sans-serif'] - Font specification
     * @param {string} [align='left'] - Text alignment (left, center, right)
     * @param {string} [baseline='top'] - Text baseline (top, middle, bottom)
     */
    drawText(text, x, y, color = '#ffffff', font = '16px sans-serif', align = 'left', baseline = 'top') {
        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Draw a line between two points
     * @param {number} x1 - Start X position
     * @param {number} y1 - Start Y position
     * @param {number} x2 - End X position
     * @param {number} y2 - End Y position
     * @param {string} color - Line color
     * @param {number} [lineWidth=1] - Line width
     */
    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    /**
     * Draw a grid of cells
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows
     * @param {number} cellSize - Size of each cell in pixels
     * @param {number} offsetX - X offset for grid position
     * @param {number} offsetY - Y offset for grid position
     * @param {string} [lineColor='#0f3460'] - Grid line color
     * @param {string} [fillColor='#1a1a2e'] - Cell fill color
     */
    drawGrid(cols, rows, cellSize, offsetX, offsetY, lineColor = '#0f3460', fillColor = '#1a1a2e') {
        // Draw cell backgrounds
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * cellSize;
                const y = offsetY + row * cellSize;
                this.drawRect(x, y, cellSize, cellSize, fillColor);
                this.drawRectOutline(x, y, cellSize, cellSize, lineColor);
            }
        }
    }

    /**
     * Draw a tower shape (colored shape based on type/tier)
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} size - Tower size (width/height)
     * @param {string} color - Tower color
     * @param {number} tier - Tower tier (affects visual)
     * @param {string} [shape='square'] - Shape type (square, circle, diamond)
     */
    drawTower(x, y, size, color, tier, shape = 'square') {
        const halfSize = size / 2;

        // Draw base shape
        switch (shape) {
            case 'circle':
                this.drawCircle(x, y, halfSize * 0.8, color);
                break;
            case 'diamond':
                this.ctx.save();
                this.ctx.translate(x, y);
                this.ctx.rotate(Math.PI / 4);
                this.drawRect(-halfSize * 0.6, -halfSize * 0.6, size * 0.6, size * 0.6, color);
                this.ctx.restore();
                break;
            case 'square':
            default:
                this.drawRect(x - halfSize * 0.8, y - halfSize * 0.8, size * 0.8, size * 0.8, color);
                break;
        }

        // Draw tier indicator (small circles)
        if (tier > 1) {
            const indicatorRadius = 4;
            const indicatorColor = '#ffffff';
            const indicatorY = y + halfSize * 0.4;
            const spacing = 10;
            const totalWidth = (Math.min(tier, 5) - 1) * spacing;
            const startX = x - totalWidth / 2;

            for (let i = 0; i < Math.min(tier, 5); i++) {
                this.drawCircle(startX + i * spacing, indicatorY, indicatorRadius, indicatorColor);
            }
        }
    }

    /**
     * Draw a particle (for effects)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Particle size
     * @param {string} color - Particle color
     * @param {number} alpha - Particle alpha (0-1)
     */
    drawParticle(x, y, size, color, alpha = 1) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.drawCircle(x, y, size, color);
        this.ctx.restore();
    }

    /**
     * Draw a highlight effect on a cell (for drag-drop feedback)
     * @param {number} x - Cell X position
     * @param {number} y - Cell Y position
     * @param {number} size - Cell size
     * @param {string} [color='#e94560'] - Highlight color
     * @param {boolean} [valid=true] - Whether placement is valid
     */
    drawCellHighlight(x, y, size, color = '#e94560', valid = true) {
        const highlightColor = valid ? color : '#ff0000';
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.drawRect(x, y, size, size, highlightColor);
        this.ctx.restore();
        this.drawRectOutline(x, y, size, size, highlightColor, 2);
    }

    /**
     * Draw an enemy (simple colored shape)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Enemy size
     * @param {string} color - Enemy color
     * @param {number} healthPercent - Health percentage (0-1)
     */
    drawEnemy(x, y, size, color, healthPercent = 1) {
        // Draw enemy body
        this.drawCircle(x, y, size / 2, color);

        // Draw health bar
        const barWidth = size;
        const barHeight = 4;
        const barX = x - barWidth / 2;
        const barY = y - size / 2 - 8;

        // Background
        this.drawRect(barX, barY, barWidth, barHeight, '#333333');
        // Health
        this.drawRect(barX, barY, barWidth * healthPercent, barHeight, '#00ff00');
    }

    /**
     * Draw a projectile (for tower attacks)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Projectile size
     * @param {string} color - Projectile color
     */
    drawProjectile(x, y, size, color) {
        this.drawCircle(x, y, size, color);
    }

    /**
     * Save the current canvas state
     */
    save() {
        this.ctx.save();
    }

    /**
     * Restore the previous canvas state
     */
    restore() {
        this.ctx.restore();
    }

    /**
     * Set global alpha for rendering
     * @param {number} alpha - Alpha value (0-1)
     */
    setAlpha(alpha) {
        this.ctx.globalAlpha = alpha;
    }

    /**
     * Get the 2D rendering context
     * @returns {CanvasRenderingContext2D}
     */
    getContext() {
        return this.ctx;
    }
}

// Export color constants for consistent theming
export const COLORS = {
    background: '#16213e',
    gridCell: '#1a1a2e',
    gridLine: '#0f3460',
    accent: '#e94560',
    text: '#ffffff',
    textDim: '#a0a0a0',
    gold: '#FFD700',
    // Tower type colors
    tower: {
        fire: '#ff4444',
        ice: '#44aaff',
        earth: '#44aa44'
    },
    // UI colors
    ui: {
        panel: '#0f3460',
        button: '#e94560',
        buttonHover: '#ff6b8a'
    }
};
