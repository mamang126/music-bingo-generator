const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

/**
 * Music Bingo Generator
 * Creates unique bingo cards with songs from a provided list
 */

class BingoGenerator {
  constructor(config) {
    this.templateImage = config.templateImage;
    this.gridSize = config.numberOfElements; // e.g., 5 for 5x5 grid
    this.startX = config.startX;
    this.startY = config.startY;
    this.boxSize = config.boxSize;
    this.songs = config.songs;
    this.numberOfCards = config.numberOfCards;
    this.outputDir = config.outputDir || 'out';
    
    // Validate configuration
    this.validate();
  }

  validate() {
    const requiredCells = this.gridSize * this.gridSize;
    if (this.songs.length < requiredCells) {
      throw new Error(`Not enough songs! Need at least ${requiredCells} songs for a ${this.gridSize}x${this.gridSize} grid. Got ${this.songs.length}.`);
    }
    
    if (!fs.existsSync(this.templateImage)) {
      throw new Error(`Template image not found: ${this.templateImage}`);
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate a unique set of songs for one bingo card
   */
  generateCardSongs() {
    const requiredCells = this.gridSize * this.gridSize;
    const shuffled = this.shuffleArray(this.songs);
    return shuffled.slice(0, requiredCells);
  }

  /**
   * Wrap text to fit within the box
   */
  wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  /**
   * Draw text centered in a box using Jimp
   */
  async drawCenteredText(image, text, x, y, boxSize) {
    const padding = 8;
    const maxWidth = boxSize - (padding * 2);
    
    // Calculate appropriate font size based on box size
    let fontSize = 16;
    if (boxSize <= 80) fontSize = 12;
    else if (boxSize <= 100) fontSize = 14;
    else if (boxSize >= 150) fontSize = 20;
    
    // Estimate characters per line (rough approximation)
    const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
    
    // Wrap text
    const lines = this.wrapText(text, charsPerLine);
    
    // Reduce font size if too many lines
    if (lines.length > 5) {
      fontSize = Math.max(10, fontSize - 2);
    }
    
    // Load font
    const font = await Jimp.loadFont(
      fontSize >= 16 ? Jimp.FONT_SANS_16_BLACK : 
      fontSize >= 14 ? Jimp.FONT_SANS_14_BLACK :
      fontSize >= 12 ? Jimp.FONT_SANS_12_BLACK :
      Jimp.FONT_SANS_10_BLACK
    );
    
    // Calculate starting y position to center all lines
    const lineHeight = fontSize + 2;
    const totalTextHeight = lines.length * lineHeight;
    let currentY = y + (boxSize / 2) - (totalTextHeight / 2);
    
    // Draw each line centered
    lines.forEach((line) => {
      const textWidth = Jimp.measureText(font, line);
      const textX = x + (boxSize / 2) - (textWidth / 2);
      image.print(font, textX, currentY, line);
      currentY += lineHeight;
    });
  }

  /**
   * Generate a single bingo card
   */
  async generateCard(cardNumber) {
    // Load the template image
    const image = await Jimp.read(this.templateImage);
    
    // Get songs for this card
    const cardSongs = this.generateCardSongs();
    
    // Draw grid with songs
    let songIndex = 0;
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const x = this.startX + (col * this.boxSize);
        const y = this.startY + (row * this.boxSize);
        
        // Draw song text
        const song = cardSongs[songIndex];
        await this.drawCenteredText(image, song, x, y, this.boxSize);
        
        songIndex++;
      }
    }
    
    // Save the image
    const outputPath = path.join(this.outputDir, `${cardNumber}.jpg`);
    await image.quality(95).writeAsync(outputPath);
    
    console.log(`✓ Generated card ${cardNumber}/${this.numberOfCards}`);
  }

  /**
   * Generate all bingo cards
   */
  async generate() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    console.log('Starting bingo card generation...');
    console.log(`Template: ${this.templateImage}`);
    console.log(`Grid size: ${this.gridSize}x${this.gridSize}`);
    console.log(`Number of cards: ${this.numberOfCards}`);
    console.log(`Output directory: ${this.outputDir}`);
    console.log('');

    // Generate each card
    for (let i = 1; i <= this.numberOfCards; i++) {
      await this.generateCard(i);
    }

    console.log('');
    console.log('✓ All bingo cards generated successfully!');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check for config file argument
    const configFile = process.argv[2] || 'config.json';
    
    if (!fs.existsSync(configFile)) {
      console.error(`Error: Configuration file '${configFile}' not found.`);
      console.log('\nUsage: node generate-bingo.js [config-file.json]');
      console.log('Default config file: config.json');
      process.exit(1);
    }

    // Load configuration
    const configData = fs.readFileSync(configFile, 'utf8');
    const config = JSON.parse(configData);

    // Create generator and run
    const generator = new BingoGenerator(config);
    await generator.generate();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = BingoGenerator;
