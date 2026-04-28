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
  "numberOfCards": 10,
  "outputDir": "out",
  "songs": [
    "Song 1 - Artist 1",
    "Song 2 - Artist 2",
    "Song 3 - Artist 3"
  ]
}
```

#### Configuration Options:

- **templateImage** (string): Path to your template image file
- **numberOfElements** (number): Grid size (5 = 5x5 grid = 25 cells)
- **startX** (number): X coordinate (in pixels) where the grid starts
- **startY** (number): Y coordinate (in pixels) where the grid starts
- **boxSize** (number): Size of each square box in pixels
- **numberOfCards** (number): How many unique bingo cards to generate
- **outputDir** (string): Output folder name (default: "out")
- **songs** (array): List of songs (must have at least gridSize² songs)

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

To find the correct `startX`, `startY`, and `boxSize` values:

1. Open your template image in an image editor (like Paint, GIMP, or Photoshop)
2. Use the selection tool to measure:
   - **startX**: X coordinate of the top-left corner of the first cell
   - **startY**: Y coordinate of the top-left corner of the first cell
   - **boxSize**: Width (and height) of one cell in pixels

## Example

An example configuration file is provided: `config.example.json`

To test with the example:
```bash
npm run test
```

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

## License

MIT
