/**
 * Micro Tower Defense - Merge Madness
 * Main game entry point
 */

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 480;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Initial render to show canvas is working
ctx.fillStyle = '#16213e';
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
