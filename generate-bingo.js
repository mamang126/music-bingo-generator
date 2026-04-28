const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

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
   * Create SVG text for rendering with sharp (supports TTF fonts)
   */
  createTextSVG(text, fontSize, fontFamily, color, maxWidth, maxHeight) {
    // Escape special XML characters
    const escapeXml = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Word wrapping
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    // Approximate character width (this is rough, but works for most fonts)
    const charWidth = fontSize * 0.6;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length * charWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Line height (with spacing)
    const lineHeight = fontSize + this.lineSpacing;
    
    // Truncate lines if they exceed max height
    const maxLines = Math.floor(maxHeight / lineHeight);
    if (lines.length > maxLines && maxLines > 0) {
      lines.splice(maxLines);
      if (lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1].substring(0, 30) + '...';
      }
    }

    // Calculate total height
    const totalHeight = lines.length * lineHeight;

    // Build SVG
    const svgLines = lines.map((line, index) => {
      const y = (index + 0.8) * lineHeight; // 0.8 for baseline adjustment
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" fill="${color}">${escapeXml(line)}</text>`;
    }).join('\n');

    const svg = `
      <svg width="${maxWidth}" height="${Math.max(totalHeight, maxHeight)}">
        ${svgLines}
      </svg>
    `;

    return { svg, width: maxWidth, height: totalHeight };
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
   * Draw TTF text using sharp (supports filled text rendering)
   */
  async drawTTFText(image, text, x, y, boxSize) {
    const maxWidth = boxSize - (this.padding * 2);
    const maxHeight = boxSize - (this.padding * 2);
    
    let fontSize = this.fontSize;
    const minFontSize = 8;
    const fontFamily = path.parse(this.customFont).name; // Extract font name from path
    const color = this.fontColor === 'white' ? '#FFFFFF' : '#000000';
    
    // Try to fit text with scaling if needed
    let svgData = null;
    let fits = false;
    
    if (this.textOverflow === 'scale') {
      // Scale down until it fits
      while (fontSize >= minFontSize && !fits) {
        svgData = this.createTextSVG(text, fontSize, fontFamily, color, maxWidth, maxHeight);
        
        // Check if it fits
        if (svgData.height <= maxHeight) {
          fits = true;
        } else {
          fontSize -= 2; // Reduce by 2px at a time
        }
      }
      
      // If still doesn't fit, truncate
      if (!fits) {
        fontSize = minFontSize;
        const truncated = text.substring(0, 30) + '...';
        svgData = this.createTextSVG(truncated, fontSize, fontFamily, color, maxWidth, maxHeight);
      }
    } else {
      svgData = this.createTextSVG(text, fontSize, fontFamily, color, maxWidth, maxHeight);
    }

    try {
      // Render SVG to PNG buffer using sharp
      const textBuffer = await sharp(Buffer.from(svgData.svg))
        .png()
        .toBuffer();
      
      // Load text image with Jimp
      const textImage = await Jimp.read(textBuffer);
      
      // Calculate centered position
      const textX = x + this.padding + Math.floor((maxWidth - textImage.bitmap.width) / 2);
      const textY = y + this.padding + Math.floor((maxHeight - svgData.height) / 2);
      
      // Composite text onto main image
      image.composite(textImage, Math.floor(textX), Math.floor(textY));
    } catch (error) {
      console.error(`Error rendering text "${text}":`, error.message);
      // Fall back to Jimp's built-in font
      const fallbackFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
      image.print(fallbackFont, x + this.padding, y + this.padding, text, maxWidth);
    }
  }

  /**
   * Draw text centered in a box using Jimp
   */
  async drawCenteredText(image, text, x, y, boxSize) {
    // If using TTF font, use sharp rendering
    if (this.customFont && this.customFont.toLowerCase().endsWith('.ttf')) {
      return await this.drawTTFText(image, text, x, y, boxSize);
    }

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

    // For TTF fonts, we use sharp's SVG rendering directly
    // No conversion to BMFont format needed
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔤 Using TTF font with sharp rendering');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Font: ${this._originalTtfPath}`);
    console.log(`Size: ${this.fontSize}px`);
    console.log('Rendering: SVG with filled text support');
    console.log('');
    
    // Keep the TTF path as customFont
    this.customFont = this._originalTtfPath;
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

    // Save all cards data to a single JSON file
    const cardsData = generatedCards.map((songs, index) => ({
      cardNumber: index + 1,
      songs: songs
    }));
    
    const jsonPath = path.join(this.outputDir, 'out.json');
    fs.writeFileSync(jsonPath, JSON.stringify(cardsData, null, 2), 'utf8');
    console.log(`✓ Saved cards data to: ${jsonPath}`);

    console.log('');
    console.log('✓ All bingo cards generated successfully!');
    console.log(`✓ Generated ${generatedCards.length} unique cards`);
  }
}

/**
 * Generate a PDF with all images from the output directory
 * @param {string} outputDir - Output directory containing images
 * @param {string} pdfFileName - Name of the PDF file
 * @param {object} config - Configuration object with PDF settings
 */
async function generatePDF(outputDir, pdfFileName = 'bingo-cards.pdf', config = {}) {
  console.log('\n📄 Generating PDF with all bingo cards...');
  
  // Get all JPG files from output directory
  const files = fs.readdirSync(outputDir)
    .filter(file => file.toLowerCase().endsWith('.jpg'))
    .sort((a, b) => {
      // Natural sort: 1.jpg, 2.jpg, ..., 10.jpg, 11.jpg
      const numA = parseInt(path.parse(a).name);
      const numB = parseInt(path.parse(b).name);
      return numA - numB;
    });

  if (files.length === 0) {
    console.error('❌ No JPG files found in output directory');
    return;
  }

  console.log(`   Found ${files.length} bingo card(s)`);

  // Read first image to get dimensions
  const firstImagePath = path.join(outputDir, files[0]);
  const firstImage = await Jimp.read(firstImagePath);
  const imgWidth = firstImage.bitmap.width;
  const imgHeight = firstImage.bitmap.height;

  console.log(`   Image size: ${imgWidth}x${imgHeight}px`);

  // Parse PDF configuration
  const pdfPageSize = config.pdfPageSize || 'A3';
  const gridCols = config.pdfGridCols || 1;
  const gridRows = config.pdfGridRows || 1;
  const pdfLandscape = config.pdfLandscape || false;
  const margin = 0;
  const spacing = 0;

  // Get page dimensions based on size
  let pageWidth, pageHeight;
  const pageSizes = {
    'A0': [2383.94, 3370.39],
    'A1': [1683.78, 2383.94],
    'A2': [1190.55, 1683.78],
    'A3': [841.89, 1190.55],
    'A4': [595.28, 841.89],
    'A5': [419.53, 595.28],
    'LETTER': [612, 792],
    'LEGAL': [612, 1008]
  };

  if (Array.isArray(pdfPageSize) && pdfPageSize.length === 2) {
    // Custom size [width, height] in points
    [pageWidth, pageHeight] = pdfPageSize;
    console.log(`   Page size: Custom ${pageWidth}x${pageHeight} pts`);
  } else if (pageSizes[pdfPageSize.toUpperCase()]) {
    [pageWidth, pageHeight] = pageSizes[pdfPageSize.toUpperCase()];
    console.log(`   Page size: ${pdfPageSize.toUpperCase()} (${Math.round(pageWidth)}x${Math.round(pageHeight)} pts)`);
  } else {
    // Default to A3
    [pageWidth, pageHeight] = pageSizes['A3'];
    console.log(`   Page size: A3 (default)`);
  }

  // Apply landscape orientation (swap width and height)
  if (pdfLandscape) {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
    console.log(`   Orientation: Landscape`);
  }

  // Calculate available space
  const availableWidth = pageWidth - (2 * margin);
  const availableHeight = pageHeight - (2 * margin);

  // Use configured grid layout
  const bestLayout = { cols: gridCols, rows: gridRows };
  const maxImagesPerPage = gridCols * gridRows;

  // Calculate image dimensions to fit in grid
  const totalHorizontalSpacing = spacing * (gridCols - 1);
  const totalVerticalSpacing = spacing * (gridRows - 1);
  
  const cellWidth = (availableWidth - totalHorizontalSpacing) / gridCols;
  const cellHeight = (availableHeight - totalVerticalSpacing) / gridRows;

  // Calculate scaled dimensions maintaining aspect ratio
  const aspectRatio = imgWidth / imgHeight;
  let scaledWidth = cellWidth;
  let scaledHeight = scaledWidth / aspectRatio;

  if (scaledHeight > cellHeight) {
    scaledHeight = cellHeight;
    scaledWidth = scaledHeight * aspectRatio;
  }

  console.log(`   Layout: ${gridCols}x${gridRows} grid (${maxImagesPerPage} cards per page)`);
  console.log(`   Card size on page: ${Math.round(scaledWidth)}x${Math.round(scaledHeight)} pts (aspect ratio preserved)`);

  // Create PDF
  const pdfPath = path.join(outputDir, pdfFileName);
  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    autoFirstPage: false
  });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Add images to PDF
  let imageIndex = 0;
  const totalPages = Math.ceil(files.length / maxImagesPerPage);

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    doc.addPage();

    for (let row = 0; row < bestLayout.rows; row++) {
      for (let col = 0; col < bestLayout.cols; col++) {
        if (imageIndex >= files.length) break;

        // Place images directly adjacent (no spacing between them)
        const x = margin + col * scaledWidth;
        const y = margin + row * scaledHeight;

        const imagePath = path.join(outputDir, files[imageIndex]);
        doc.image(imagePath, x, y, {
          width: scaledWidth,
          height: scaledHeight
        });

        imageIndex++;
      }
      if (imageIndex >= files.length) break;
    }
  }

  doc.end();

  // Wait for PDF to be written
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log(`✓ PDF generated: ${pdfPath}`);
  console.log(`✓ Total pages: ${totalPages}`);
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

    // Generate PDF with all cards
    await generatePDF(config.outputDir || 'out', 'bingo-cards.pdf', config);

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
