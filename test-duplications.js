const fs = require('fs');
const path = require('path');

/**
 * Test script to verify that generated bingo cards don't have duplications
 * A duplication is defined as two cards having the exact same set of songs,
 * regardless of order.
 * 
 * The goal is to ensure each card has at least 1 song different from any other card.
 */

/**
 * Read and parse the out.json file
 */
function loadCardsData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create a normalized signature for a card (sorted songs)
 * This allows us to compare cards regardless of song order
 */
function getCardSignature(songs) {
  return songs.slice().sort().join('|');
}

/**
 * Check if two cards have at least one different song
 */
function hasAtLeastOneDifference(songs1, songs2) {
  const set1 = new Set(songs1);
  const set2 = new Set(songs2);
  
  // Check if there's at least one song in set1 not in set2, or vice versa
  for (const song of set1) {
    if (!set2.has(song)) {
      return true;
    }
  }
  
  for (const song of set2) {
    if (!set1.has(song)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Count how many songs are different between two cards
 */
function countDifferences(songs1, songs2) {
  const set1 = new Set(songs1);
  const set2 = new Set(songs2);
  
  let differences = 0;
  
  // Count songs in set1 not in set2
  for (const song of set1) {
    if (!set2.has(song)) {
      differences++;
    }
  }
  
  // Count songs in set2 not in set1
  for (const song of set2) {
    if (!set1.has(song)) {
      differences++;
    }
  }
  
  return differences;
}

/**
 * Main test function
 */
function testDuplications(filePath) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing for Duplications');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Reading: ${filePath}\n`);
  
  const cards = loadCardsData(filePath);
  
  if (!Array.isArray(cards) || cards.length === 0) {
    console.error('❌ No cards found in the file');
    process.exit(1);
  }
  
  console.log(`Total cards: ${cards.length}\n`);
  
  // Track signatures to find exact duplicates (same songs, any order)
  const signatures = new Map();
  const exactDuplicates = [];
  
  // Check for exact duplicates (same set of songs)
  console.log('📋 Checking for exact duplicates (same songs, any order)...');
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const signature = getCardSignature(card.songs);
    
    if (signatures.has(signature)) {
      const originalCardNum = signatures.get(signature);
      exactDuplicates.push({
        card1: originalCardNum,
        card2: card.cardNumber
      });
      console.log(`   ⚠️  Cards ${originalCardNum} and ${card.cardNumber} are EXACT DUPLICATES`);
    } else {
      signatures.set(signature, card.cardNumber);
    }
  }
  
  if (exactDuplicates.length === 0) {
    console.log('   ✓ No exact duplicates found\n');
  } else {
    console.log(`\n   ❌ Found ${exactDuplicates.length} pair(s) of exact duplicates!\n`);
  }
  
  // Check that each card has at least 1 different song from other cards
  console.log('📋 Checking that each card has at least 1 different song from others...');
  let hasIssue = false;
  
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const card1 = cards[i];
      const card2 = cards[j];
      
      if (!hasAtLeastOneDifference(card1.songs, card2.songs)) {
        console.log(`   ❌ Cards ${card1.cardNumber} and ${card2.cardNumber} have IDENTICAL song sets`);
        hasIssue = true;
      }
    }
  }
  
  if (!hasIssue) {
    console.log('   ✓ All cards have at least 1 different song from each other\n');
  } else {
    console.log('');
  }
  
  // Statistics: minimum, maximum, and average differences between cards
  console.log('📊 Statistics:');
  const songsPerCard = cards[0].songs.length;
  let minDiff = Infinity;
  let maxDiff = 0;
  let totalDiff = 0;
  let comparisons = 0;
  let minPair = null;
  let maxPair = null;
  let minCommon = Infinity;
  let maxCommon = 0;
  
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const diff = countDifferences(cards[i].songs, cards[j].songs);
      // Calculate common songs: total songs - (unique differences / 2)
      const common = songsPerCard - (diff / 2);
      
      if (diff < minDiff) {
        minDiff = diff;
        minPair = [cards[i].cardNumber, cards[j].cardNumber];
      }
      
      if (diff > maxDiff) {
        maxDiff = diff;
        maxPair = [cards[i].cardNumber, cards[j].cardNumber];
      }
      
      if (common < minCommon) minCommon = common;
      if (common > maxCommon) maxCommon = common;
      
      totalDiff += diff;
      comparisons++;
    }
  }
  
  const avgDiff = comparisons > 0 ? (totalDiff / comparisons).toFixed(2) : 0;
  const avgCommon = comparisons > 0 ? (songsPerCard - (avgDiff / 2)).toFixed(2) : 0;
  
  console.log(`   Songs per card: ${songsPerCard}`);
  console.log(`   Most similar cards: ${minPair[0]} & ${minPair[1]} (${Math.floor(songsPerCard - minDiff/2)} songs in common, ${Math.floor(minDiff/2)} unique each)`);
  console.log(`   Most different cards: ${maxPair[0]} & ${maxPair[1]} (${Math.floor(songsPerCard - maxDiff/2)} songs in common, ${Math.floor(maxDiff/2)} unique each)`);
  console.log(`   Average common songs: ${avgCommon}`);
  console.log('');
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = exactDuplicates.length === 0 && !hasIssue;
  
  if (passed) {
    console.log('✅ PASSED: No duplications found!');
    console.log('✅ Each card has at least 1 different song from others');
  } else {
    console.log('❌ FAILED: Duplications detected!');
    if (exactDuplicates.length > 0) {
      console.log(`   - ${exactDuplicates.length} pair(s) of exact duplicates`);
    }
    if (hasIssue) {
      console.log('   - Some cards have identical song sets');
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

/**
 * Main execution
 */
function main() {
  const filePath = process.argv[2] || path.join('out', 'out.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log('\nUsage: node test-duplications.js [path-to-out.json]');
    console.log('Default: out/out.json');
    process.exit(1);
  }
  
  testDuplications(filePath);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { testDuplications, getCardSignature, hasAtLeastOneDifference, countDifferences };
