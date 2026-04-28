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
    this.boxSpacing = config.boxSpacing || 0; // Spacing between boxes
    this.songs = config.songs;
    this.numberOfCards = config.numberOfCards;
    this.outputDir = config.outputDir || 'out';
    
    // Font configuration
    this.fontSize = config.fontSize || 16;
    this.fontColor = config.fontColor || 'black'; // 'black' or 'white'
    this.customFont = config.customFont || null; // Path to custom .fnt file
    this.textOverflow = config.textOverflow || 'wrap'; // 'wrap', 'truncate', or 'scale'
    this.padding = config.padding || 8;
    this.lineSpacing = config.lineSpacing !== undefined ? config.lineSpacing : 2; // Space between lines in pixels
    
    // Debug mode
    this.debug = config.debug || false;
    
    // Auto-convert TTF fonts if needed
    this._needsFontConversion = false;
    this._originalTtfPath = null;
    if (this.customFont && this.customFont.toLowerCase().endsWith('.ttf')) {
      this._needsFontConversion = true;
      this._originalTtfPath = this.customFont;
    }
    
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
    
    // Calculate and display theoretical unique card possibilities
    const totalSongs = this.songs.length;
    const cardsNeeded = this.numberOfCards;
    
    // Calculate combinations: C(n,k) = n! / (k! * (n-k)!)
    // For large numbers, we'll use a simpler check
    if (totalSongs === requiredCells) {
      // If exact match, we can generate requiredCells! different arrangements
      // But that's a lot, so we just warn if they want too many
      console.log(`Note: You have exactly ${requiredCells} songs for a ${this.gridSize}x${this.gridSize} grid.`);
      console.log(`Each card will have the same songs in different positions.`);
    } else if (totalSongs > requiredCells) {
      // More songs than needed - good for variety
      const extraSongs = totalSongs - requiredCells;
      console.log(`Note: You have ${totalSongs} songs for ${requiredCells} cells (+${extraSongs} extra songs).`);
      console.log(`This allows for good variety across ${cardsNeeded} cards.`);
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * This is a well-tested, unbiased shuffling algorithm
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
   * Creates a unique card by shuffling and checking against previously generated cards
   */
  generateCardSongs(previousCards = []) {
    const requiredCells = this.gridSize * this.gridSize;
    const maxAttempts = 1000; // Prevent infinite loop
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // Shuffle all songs and take required number
      const shuffled = this.shuffleArray(this.songs);
      const cardSongs = shuffled.slice(0, requiredCells);
      
      // Create a signature for this card (sorted song list)
      const cardSignature = cardSongs.slice().sort().join('|');
      
      // Check if this exact combination was already generated
      const isDuplicate = previousCards.some(prevCard => {
        const prevSignature = prevCard.slice().sort().join('|');
        return cardSignature === prevSignature;
      });
      
      if (!isDuplicate) {
        return cardSongs;
      }
      
      attempts++;
    }
    
    // If we couldn't find a unique combination after maxAttempts,
    // just return a shuffled version (better than failing)
    console.warn(`Warning: Could not generate unique card after ${maxAttempts} attempts. Returning potentially duplicate card.`);
    const shuffled = this.shuffleArray(this.songs);
    return shuffled.slice(0, requiredCells);
  }

  /**
   * Wrap text to fit within the box using actual measured width
   */
  wrapText(text, font, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const testWidth = Jimp.measureText(font, testLine);
      
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  /**
   * Get the appropriate Jimp font based on size and color
   */
  async loadFont(size, color) {
    // If custom font is provided, try to load it
    if (this.customFont) {
      try {
        const customFont = await Jimp.loadFont(this.customFont);
        
        // Show warning once about fixed size limitation
        if (!this._customFontSizeWarningShown) {
          this._customFontSizeWarningShown = true;
          const actualSize = customFont.common ? customFont.common.lineHeight : 'unknown';
          console.warn('\n⚠️  Note: Custom BMFont has a fixed size');
          console.warn(`   Font file size: ${actualSize}px (fontSize config is ignored for custom fonts)`);
          console.warn(`   To use different sizes, generate multiple .fnt files at different sizes\n`);
        }
        
        // Successfully loaded, return it
        return customFont;
      } catch (error) {
        // Only show error once per generation
        if (!this._customFontErrorShown) {
          this._customFontErrorShown = true;
          console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ ERROR: Failed to load custom font');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error(`Font path: ${this.customFont}`);
          console.error('');
          console.error('IMPORTANT: Jimp only supports BMFont format (.fnt + .png), not TrueType (.ttf) or OpenType (.otf) fonts.');
          console.error('');
          console.error('To use custom fonts, you need:');
          console.error('  1. A .fnt file (font metrics)');
          console.error('  2. A .png file (font texture atlas)');
          console.error('');
          console.error('Convert your .ttf font to BMFont format using:');
          console.error('  • Hiero (https://github.com/libgdx/libgdx/wiki/Hiero)');
          console.error('  • BMFont (https://www.angelcode.com/products/bmfont/)');
          console.error('  • Online tools like: https://snowb.org/');
          console.error('');
          console.error('Falling back to default built-in font...');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        // Fall through to use default font
      }
    }
    
    // Map to nearest available Jimp font size
    const colorSuffix = color === 'white' ? '_WHITE' : '_BLACK';
    
    if (size >= 128) return await Jimp.loadFont(Jimp[`FONT_SANS_128${colorSuffix}`]);
    if (size >= 64) return await Jimp.loadFont(Jimp[`FONT_SANS_64${colorSuffix}`]);
    if (size >= 32) return await Jimp.loadFont(Jimp[`FONT_SANS_32${colorSuffix}`]);
    if (size >= 16) return await Jimp.loadFont(Jimp[`FONT_SANS_16${colorSuffix}`]);
    if (size >= 14) return await Jimp.loadFont(Jimp[`FONT_SANS_14${colorSuffix}`]);
    if (size >= 12) return await Jimp.loadFont(Jimp[`FONT_SANS_12${colorSuffix}`]);
    if (size >= 10) return await Jimp.loadFont(Jimp[`FONT_SANS_10${colorSuffix}`]);
    return await Jimp.loadFont(Jimp[`FONT_SANS_8${colorSuffix}`]);
  }

  /**
   * Draw text centered in a box using Jimp
   */
  async drawCenteredText(image, text, x, y, boxSize) {
    const maxWidth = boxSize - (this.padding * 2);
    const maxHeight = boxSize - (this.padding * 2);
    
    let fontSize = this.fontSize;
    let lines = [];
    let font = null;
    let lineHeight = 0;
    
    // Handle different overflow strategies
    if (this.textOverflow === 'scale') {
      // Try scaling down font until text fits both width and height
      let fits = false;
      const minFontSize = 8;
      
      while (fontSize >= minFontSize && !fits) {
        font = await this.loadFont(fontSize, this.fontColor);
        
        // Calculate line height - use font's reported height if available, otherwise use fontSize
        // For custom fonts, we need to be more generous with line spacing
        if (this.customFont && font.common) {
          lineHeight = font.common.lineHeight + this.lineSpacing;
        } else {
          lineHeight = fontSize + this.lineSpacing;
        }
        
        // Ensure minimum line height
        lineHeight = Math.max(lineHeight, fontSize + 2);
        
        // Wrap text using actual measured width
        lines = this.wrapText(text, font, maxWidth);
        
        // Check if all lines fit within width (individual check)
        let widthFits = true;
        for (const line of lines) {
          const lineWidth = Jimp.measureText(font, line);
          if (lineWidth > maxWidth) {
            widthFits = false;
            break;
          }
        }
        
        // Check if total height fits
        const totalHeight = lines.length * lineHeight;
        const heightFits = totalHeight <= maxHeight;
        
        if (widthFits && heightFits) {
          fits = true;
        } else {
          fontSize -= 1; // Reduce by 1px for finer control
        }
      }
      
      // If we exited the loop without fitting, we're at minimum font size
      // Ensure we have the minimum font loaded and recalculate
      if (!fits) {
        font = await this.loadFont(minFontSize, this.fontColor);
        
        // Recalculate line height for minimum font
        if (this.customFont && font.common) {
          lineHeight = font.common.lineHeight + this.lineSpacing;
        } else {
          lineHeight = minFontSize + this.lineSpacing;
        }
        lineHeight = Math.max(lineHeight, minFontSize + 2);
        
        lines = this.wrapText(text, font, maxWidth);
        
        // Truncate lines to fit within height
        const maxLines = Math.floor(maxHeight / lineHeight);
        if (maxLines > 0 && lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          // Add ellipsis to last line if there's room
          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const ellipsis = '...';
            const ellipsisWidth = Jimp.measureText(font, ellipsis);
            
            // Trim last line to make room for ellipsis
            let trimmedLine = lastLine;
            while (Jimp.measureText(font, trimmedLine + ellipsis) > maxWidth && trimmedLine.length > 0) {
              trimmedLine = trimmedLine.slice(0, -1);
            }
            lines[lines.length - 1] = trimmedLine + ellipsis;
          }
        } else if (maxLines === 0) {
          // Box is too small, show just ellipsis
          lines = ['...'];
        }
      }
      
    } else if (this.textOverflow === 'truncate') {
      font = await this.loadFont(fontSize, this.fontColor);
      
      if (this.customFont && font.common) {
        lineHeight = font.common.lineHeight + this.lineSpacing;
      } else {
        lineHeight = fontSize + this.lineSpacing;
      }
      lineHeight = Math.max(lineHeight, fontSize + 2);
      
      lines = this.wrapText(text, font, maxWidth);
      
      // Truncate to fit height
      const maxLines = Math.floor(maxHeight / lineHeight);
      if (maxLines > 0 && lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const ellipsis = '...';
          
          // Trim last line to make room for ellipsis
          let trimmedLine = lastLine;
          while (Jimp.measureText(font, trimmedLine + ellipsis) > maxWidth && trimmedLine.length > 0) {
            trimmedLine = trimmedLine.slice(0, -1);
          }
          lines[lines.length - 1] = trimmedLine + ellipsis;
        }
      } else if (maxLines === 0) {
        lines = ['...'];
      }
      
    } else { // wrap (default)
      font = await this.loadFont(fontSize, this.fontColor);
      
      if (this.customFont && font.common) {
        lineHeight = font.common.lineHeight + this.lineSpacing;
      } else {
        lineHeight = fontSize + this.lineSpacing;
      }
      lineHeight = Math.max(lineHeight, fontSize + 2);
      
      lines = this.wrapText(text, font, maxWidth);
      
      // Even in wrap mode, prevent overflow by truncating excessive lines
      const maxLines = Math.floor(maxHeight / lineHeight);
      if (maxLines > 0 && lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
      } else if (maxLines === 0) {
        lines = [];
      }
    }
    
    // Safety check: ensure we have valid font and lines
    if (!font || lines.length === 0) {
      return; // Nothing to draw
    }
    
    // Calculate starting y position to center all lines
    const totalTextHeight = lines.length * lineHeight;
    let currentY = y + (boxSize / 2) - (totalTextHeight / 2);
    
    // Clamp starting Y to stay within box bounds
    const minY = y + this.padding;
    const maxY = y + boxSize - this.padding - totalTextHeight;
    currentY = Math.max(minY, Math.min(currentY, maxY));
    
    // Draw each line centered
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines
      if (!line || line.trim().length === 0) {
        currentY += lineHeight;
        continue;
      }
      
      const textWidth = Jimp.measureText(font, line);
      let textX = x + (boxSize / 2) - (textWidth / 2);
      
      // Clamp X position to stay within box bounds
      const minX = x + this.padding;
      const maxX = x + boxSize - this.padding - textWidth;
      textX = Math.max(minX, Math.min(textX, maxX));
      
      // Only draw if within box bounds
      const lineBottom = currentY + lineHeight;
      if (currentY >= y + this.padding && lineBottom <= y + boxSize - this.padding) {
        image.print(font, Math.floor(textX), Math.floor(currentY), line);
      }
      
      currentY += lineHeight;
    }
  }

  /**
   * Generate a single bingo card
   */
  async generateCard(cardNumber, previousCards = []) {
    // Load the template image
    const image = await Jimp.read(this.templateImage);
    
    // Get songs for this card (ensuring uniqueness)
    const cardSongs = this.generateCardSongs(previousCards);
    
    // Draw grid with songs
    let songIndex = 0;
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const x = this.startX + (col * (this.boxSize + this.boxSpacing));
        const y = this.startY + (row * (this.boxSize + this.boxSpacing));
        
        // Draw debug grid box if enabled
        if (this.debug) {
          // Draw border around the box
          const borderColor = 0xFF0000FF; // Red color
          for (let i = 0; i < 2; i++) { // 2px border width
            // Top border
            for (let px = x; px < x + this.boxSize; px++) {
              image.setPixelColor(borderColor, px, y + i);
            }
            // Bottom border
            for (let px = x; px < x + this.boxSize; px++) {
              image.setPixelColor(borderColor, px, y + this.boxSize - 1 - i);
            }
            // Left border
            for (let py = y; py < y + this.boxSize; py++) {
              image.setPixelColor(borderColor, x + i, py);
            }
            // Right border
            for (let py = y; py < y + this.boxSize; py++) {
              image.setPixelColor(borderColor, x + this.boxSize - 1 - i, py);
            }
          }
        }
        
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
    
    // Return the card songs for uniqueness tracking
    return cardSongs;
  }

  /**
   * Auto-convert TTF font to BMFont format if needed
   */
  async convertTtfFont() {
    if (!this._needsFontConversion) {
      return; // No conversion needed
    }

    const ttfPath = this._originalTtfPath;
    const fontName = path.basename(ttfPath, '.ttf');
    const fontsDir = path.dirname(ttfPath) || './fonts';
    const targetSize = this.fontSize || 48; // Use configured fontSize or default to 48
    const fntFileName = `${fontName}-${targetSize}.fnt`;
    const fntPath = path.join(fontsDir, fntFileName);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Auto-converting TTF font to BMFont format...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Font: ${ttfPath}`);
    console.log(`Size: ${targetSize}px`);
    console.log(`Output: ${fntPath}`);
    console.log('');

    // Check if already converted
    if (fs.existsSync(fntPath)) {
      console.log(`✓ Font already converted: ${fntFileName}`);
      console.log('  (Delete the .fnt file to force reconversion)');
      console.log('');
      this.customFont = fntPath;
      return;
    }

    // Import the converter
    try {
      const { convertFont } = require('./convert-font.js');
      
      // Convert the font
      await convertFont(ttfPath, fontsDir, [targetSize], fontName);
      
      // Update customFont path to use the converted .fnt file
      this.customFont = fntPath;
      
      console.log(`✓ Font converted successfully!`);
      console.log(`  Using: ${fntFileName}`);
      console.log('');
    } catch (error) {
      console.error('❌ Font conversion failed:', error.message);
      console.error('');
      console.error('Options:');
      console.error('  1. Install dependencies: npm install');
      console.error('  2. Manually convert using: node convert-font.js ' + ttfPath + ' ' + targetSize);
      console.error('  3. Use built-in fonts: set "customFont": null in config');
      console.error('');
      throw new Error(`Font conversion failed: ${error.message}`);
    }
  }

  /**
   * Generate all bingo cards
   */
  async generate() {
    // Auto-convert TTF font if needed
    await this.convertTtfFont();
    
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

    // Track all generated cards to ensure uniqueness
    const generatedCards = [];

    // Generate each card
    for (let i = 1; i <= this.numberOfCards; i++) {
      const cardSongs = await this.generateCard(i, generatedCards);
      generatedCards.push(cardSongs);
    }

    console.log('');
    console.log('✓ All bingo cards generated successfully!');
    console.log(`✓ Generated ${generatedCards.length} unique cards`);
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
