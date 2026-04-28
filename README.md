# Music Bingo Generator

A Node.js script that generates unique music bingo cards from a template image and a song list.

## Features

- ✨ Generate multiple unique bingo cards
- 🎨 Use custom template images
- 📝 Automatically wraps long song names
- 🎲 Random song placement for each card
- 📐 Configurable grid size and positioning
- 💾 Outputs high-quality JPG images

## Installation

1. Make sure you have Node.js installed (version 12 or higher)

2. Install dependencies:
```bash
npm install
```

## Usage

### 1. Prepare Your Template Image

Create or download a bingo card template image (e.g., `template.jpg`). This should be your background with the bingo grid layout drawn on it. The script will overlay song names on top of this template.

### 2. Create Configuration File

Create a `config.json` file with your settings:

```json
{
  "templateImage": "template.jpg",
  "numberOfElements": 5,
  "startX": 50,
  "startY": 150,
  "boxSize": 120,
  "boxSpacing": 0,
  "numberOfCards": 10,
  "outputDir": "out",
  "fontSize": 16,
  "fontColor": "black",
  "textOverflow": "scale",
  "padding": 8,
  "lineSpacing": 2,
  "songs": [
    "Song 1 - Artist 1",
    "Song 2 - Artist 2",
    "Song 3 - Artist 3"
  ]
}
```

#### Configuration Options:

**Required Settings:**
- **templateImage** (string): Path to your template image file
- **numberOfElements** (number): Grid size (5 = 5x5 grid = 25 cells)
- **startX** (number): X coordinate (in pixels) where the grid starts
- **startY** (number): Y coordinate (in pixels) where the grid starts
- **boxSize** (number): Size of each square box in pixels
- **boxSpacing** (number): Space between boxes in pixels (default: 0)
- **songs** (array): List of songs (must have at least gridSize² songs)

**Optional Settings:**
- **numberOfCards** (number): How many unique bingo cards to generate (default: 10)
- **outputDir** (string): Output folder name (default: "out")
- **fontSize** (number): Font size in pixels (default: 16). Available sizes: 8, 10, 12, 14, 16, 32, 64, 128
- **fontColor** (string): Font color - "black" or "white" (default: "black")
- **customFont** (string|null): Path to custom BMFont .fnt file (default: null). **Must be BMFont format (.fnt), NOT .ttf**
- **textOverflow** (string): How to handle text that doesn't fit (default: "scale")
  - "scale": Automatically reduce font size until text fits
  - "wrap": Wrap text across multiple lines (may overflow box)
  - "truncate": Cut off text with "..." if it doesn't fit
- **padding** (number): Padding inside each box in pixels (default: 8)
- **lineSpacing** (number): Space between text lines in pixels (default: 2)
- **debug** (boolean): Draw red borders around grid boxes for alignment testing (default: false)

### 3. Run the Generator

```bash
node generate-bingo.js config.json
```

Or use the npm script:

```bash
npm start
```

### 4. Find Your Bingo Cards

Check the `out` folder for your generated cards: `1.jpg`, `2.jpg`, `3.jpg`, etc.

## How to Determine Grid Position

To find the correct `startX`, `startY`, `boxSize`, and `boxSpacing` values:

1. Open your template image in an image editor (like Paint, GIMP, or Photoshop)
2. Use the selection tool to measure:
   - **startX**: X coordinate of the top-left corner of the first cell
   - **startY**: Y coordinate of the top-left corner of the first cell
   - **boxSize**: Width (and height) of one cell in pixels (just the cell, not including gaps)
   - **boxSpacing**: Gap/spacing between cells in pixels (set to 0 if cells are adjacent)

**Example:** If your grid has 120px cells with 10px gaps between them, use:
```json
{
  "boxSize": 120,
  "boxSpacing": 10
}
```

### Using Debug Mode

Enable debug mode to visualize the grid placement:

```json
{
  "debug": true
}
```

This will draw red borders around each grid box in the generated images. Use this to:
- Verify your `startX`, `startY`, and `boxSize` values are correct
- Ensure text is properly aligned within boxes
- Fine-tune your grid positioning

**Remember to set `debug: false` before generating final cards!**

## Card Uniqueness & Variety

The generator uses the **Fisher-Yates shuffle algorithm** - a proven, unbiased shuffling method. Additionally, it includes **duplicate detection** to ensure no two cards have the exact same song combination.

### How It Works:
1. Each card gets a random selection of songs from your list
2. The system checks if this exact combination was already used
3. If a duplicate is found, it tries again (up to 1000 attempts)
4. A "card signature" is created based on song combinations (not positions)

### Song List Recommendations:

**Minimum:** `gridSize × gridSize` songs (e.g., 25 songs for 5×5 grid)
- Each card will have the same songs in different positions
- Still provides variety through different arrangements

**Recommended:** `25-50% more songs` than needed
- Example: 30-40 songs for a 5×5 grid (25 cells)
- Ensures each card can have different song combinations
- Much better variety across multiple cards

**Maximum Variety:** `2x or more songs` than needed
- Example: 50+ songs for a 5×5 grid
- Guarantees unique combinations even for hundreds of cards
- Best for large events

The script will display info about your song count when you run it.

## Example

An example configuration file is provided: `config.example.json`

To test with the example:
```bash
npm run test
```

## Font Customization

### Font Size
Choose from available sizes: 8, 10, 12, 14, 16, 32, 64, or 128 pixels. The script will use the closest available size.

```json
{
  "fontSize": 20
}
```

**Note:** When using `"textOverflow": "scale"`, the font size you specify is the *starting* size. The algorithm will automatically reduce it (down to 8px minimum) based on each song's length to ensure all text fits perfectly within the box. Longer song names will get smaller fonts, while shorter names will use the full specified size.

### Font Color
Use "black" for light backgrounds or "white" for dark backgrounds:

```json
{
  "fontColor": "white"
}
```

### Text Overflow Handling

**Scale (Recommended)**: Automatically reduces font size until text fits perfectly
```json
{
  "textOverflow": "scale"
}
```
This mode uses actual measured text width (not estimates) to ensure each song name fits within the box. The font size is reduced 1px at a time until both width and height constraints are satisfied. If text is still too long even at minimum font size (8px), it will be truncated with "..." to fit. This means:
- Short song names use the full `fontSize` you specify
- Long song names automatically get a smaller font
- Each box can have a different font size based on its content
- Extremely long names are truncated at minimum font size

**Truncate**: Cuts off text that doesn't fit and adds "..."
```json
{
  "textOverflow": "truncate"
}
```
Uses your specified font size and truncates any text that doesn't fit.

**Wrap**: Wraps text across multiple lines, truncating if needed
```json
{
  "textOverflow": "wrap"
}
```
Wraps text without reducing font size. If too many lines, excess lines are truncated to prevent overflow.

### Custom Fonts

**Important:** Jimp only supports **BMFont format**, not TrueType (.ttf) or OpenType (.otf) fonts.

To use a custom font:

1. **Convert your font to BMFont format** using one of these tools:
   - **Hiero** - https://github.com/libgdx/libgdx/wiki/Hiero (free, cross-platform)
   - **BMFont** - https://www.angelcode.com/products/bmfont/ (Windows)
   - **Online converter** - https://snowb.org/ (web-based)

2. **Place both files in your project:**
   - `custom-font.fnt` (font metrics)
   - `custom-font.png` (font texture atlas)

3. **Reference the .fnt file in config:**
   ```json
   {
     "customFont": "./fonts/custom-font.fnt"
   }
   ```

**Note:** The .png file must be in the same directory as the .fnt file with the same base name.

**Alternative:** If you don't need custom fonts, use the built-in fonts by setting:
```json
{
  "customFont": null,
  "fontSize": 16,
  "fontColor": "black"
}
```

### Line Spacing

Control the vertical space between lines of text when song names wrap to multiple lines:

```json
{
  "lineSpacing": 2
}
```

**Values:**
- `0` - No space between lines (text touching)
- `2` - Default spacing (recommended for most cases)
- `4-6` - More space for better readability with larger fonts
- `8+` - Very loose spacing

**Tip:** If your text looks cramped, increase line spacing. If you need to fit more text, reduce it to 0 or 1.

## Tips

- Make sure your song list has at least as many songs as grid cells (e.g., 25 songs for a 5x5 grid)
- Use high-resolution template images for better quality output
- The script automatically adjusts font size to fit song names in each box
- Song names are wrapped across multiple lines if needed

## Troubleshooting

### "Not enough songs!" error
You need at least gridSize × gridSize songs. For a 5×5 grid, you need 25 songs minimum.

### "Template image not found" error
Make sure the path in `templateImage` is correct and the file exists.

### Text doesn't fit properly
Adjust the `startX`, `startY`, and `boxSize` values to match your template's grid layout.

### "Failed to load custom font" error
This happens when you try to use a .ttf or .otf font file. Jimp only supports BMFont format (.fnt + .png).

**Solution:**
1. Convert your font to BMFont format using Hiero, BMFont, or an online converter
2. Or set `"customFont": null` to use the built-in fonts

## License

MIT
