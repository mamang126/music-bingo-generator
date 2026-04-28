const generateBMFont = require('msdf-bmfont-xml');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

/**
 * Convert TTF font to BMFont format (bitmap, not MSDF)
 * This generates fonts that Jimp can render properly
 */
async function convertFont(fontPath, outputDir, sizes = [64]) {
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file not found: ${fontPath}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fontName = path.basename(fontPath, path.extname(fontPath));
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔤 Converting Font: ${fontName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  for (const size of sizes) {
    console.log(`📏 Generating size: ${size}px...`);
    
    const outputBaseName = sizes.length > 1 ? `${fontName}-${size}` : fontName;
    
    // Configuration for bitmap-like font with minimal distance field
    // Using very small distanceRange for cleaner rendering in Jimp
    const options = {
      outputType: 'xml',
      filename: outputBaseName,
      fontSize: size,
      textureSize: [2048, 2048],
      texturePadding: 2,
      border: 2,               // Add small border for antialiasing
      fieldType: 'sdf',        // Use SDF (single channel) instead of MSDF
      distanceRange: 2,        // Minimal range for cleaner bitmap-like appearance
      roundDecimal: 0,
      smartSize: true,
      pot: false,
      square: true,
    };

    await new Promise((resolve, reject) => {
      generateBMFont(fontPath, options, (error, textures, font) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          // Save texture files
          textures.forEach((texture) => {
            const texturePath = path.join(outputDir, texture.filename);
            fs.writeFileSync(texturePath, texture.texture);
            console.log(`   ✓ Created: ${texture.filename}`);
          });

          // Convert XML to .fnt format
          xml2js.parseString(font.data, (err, result) => {
            if (err) {
              reject(err);
              return;
            }

            // Convert parsed XML back to BMFont text format
            const fntContent = convertXmlToFnt(result);
            const fntPath = path.join(outputDir, font.filename);
            fs.writeFileSync(fntPath, fntContent);
            console.log(`   ✓ Created: ${font.filename}\n`);
            
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
  
  console.log(`✅ Font conversion complete!\n`);
  console.log(`To use in your config.json:`);
  if (sizes.length > 1) {
    console.log(`   "customFont": "./${outputDir}/${fontName}-${sizes[0]}.fnt"  (or any size you generated)\n`);
  } else {
    console.log(`   "customFont": "./${outputDir}/${fontName}.fnt"\n`);
  }
}

/**
 * Convert parsed XML to BMFont .fnt text format
 */
function convertXmlToFnt(xml) {
  const font = xml.font;
  let fnt = '';

  // Info line
  if (font.info && font.info[0]) {
    const info = font.info[0].$;
    fnt += `info face="${info.face || ''}" size=${info.size || 0} bold=${info.bold || 0} ` +
           `italic=${info.italic || 0} charset="${info.charset || ''}" unicode=${info.unicode || 0} ` +
           `stretchH=${info.stretchH || 100} smooth=${info.smooth || 1} aa=${info.aa || 1} ` +
           `padding=${info.padding || '0,0,0,0'} spacing=${info.spacing || '0,0'} outline=${info.outline || 0}\n`;
  }

  // Common line
  if (font.common && font.common[0]) {
    const common = font.common[0].$;
    fnt += `common lineHeight=${common.lineHeight || 0} base=${common.base || 0} ` +
           `scaleW=${common.scaleW || 0} scaleH=${common.scaleH || 0} pages=${common.pages || 1} ` +
           `packed=${common.packed || 0} alphaChnl=${common.alphaChnl || 0} redChnl=${common.redChnl || 0} ` +
           `greenChnl=${common.greenChnl || 0} blueChnl=${common.blueChnl || 0}\n`;
  }

  // Pages
  if (font.pages && font.pages[0] && font.pages[0].page) {
    font.pages[0].page.forEach(page => {
      const p = page.$;
      fnt += `page id=${p.id || 0} file="${p.file || ''}"\n`;
    });
  }

  // Chars count
  if (font.chars && font.chars[0] && font.chars[0].char) {
    fnt += `chars count=${font.chars[0].char.length}\n`;
    
    // Individual chars
    font.chars[0].char.forEach(char => {
      const c = char.$;
      fnt += `char id=${c.id || 0} x=${c.x || 0} y=${c.y || 0} width=${c.width || 0} ` +
             `height=${c.height || 0} xoffset=${c.xoffset || 0} yoffset=${c.yoffset || 0} ` +
             `xadvance=${c.xadvance || 0} page=${c.page || 0} chnl=${c.chnl || 0}\n`;
    });
  }

  // Kernings (if any)
  if (font.kernings && font.kernings[0] && font.kernings[0].kerning) {
    fnt += `kernings count=${font.kernings[0].kerning.length}\n`;
    
    font.kernings[0].kerning.forEach(kerning => {
      const k = kerning.$;
      fnt += `kerning first=${k.first || 0} second=${k.second || 0} amount=${k.amount || 0}\n`;
    });
  }

  return fnt;
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node convert-font.js <font.ttf> [outputDir] [size1,size2,...]');
    console.log('');
    console.log('Examples:');
    console.log('  node convert-font.js MyFont.ttf');
    console.log('  node convert-font.js MyFont.ttf fonts');
    console.log('  node convert-font.js MyFont.ttf fonts 32,64,128');
    console.log('');
    console.log('Generates bitmap fonts (not MSDF) compatible with Jimp');
    process.exit(1);
  }

  const fontPath = args[0];
  const outputDir = args[1] || 'fonts';
  const sizes = args[2] ? args[2].split(',').map(s => parseInt(s.trim())) : [64];

  convertFont(fontPath, outputDir, sizes)
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { convertFont };
