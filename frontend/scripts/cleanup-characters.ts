#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'characters');
const DATA_DIR = path.join(OUTPUT_DIR, 'data');
const TOTAL_CHARACTERS = 1000;

// Files to remove (empty files)
const FILES_TO_REMOVE = ['answer.txt', 'short-answer.txt'];

interface CharacterData {
  id: number;
  gender: string;
  skin_color: string;
  hair_color: string;
  hair_style: string;
  shirt_color: string;
  leg_color: string;
  shoe_color: string;
  leg_type: string;
  description: string;
}

interface SpriteInfo {
  sprite_name: string;
  generated: string;
  layers: string[];
  note: string;
}

interface ConsolidatedCharacter {
  id: number;
  gender: string;
  description: string;
  attributes: {
    skin_color: string;
    hair_color: string;
    hair_style: string;
    shirt_color: string;
    leg_color: string;
    leg_type: string;
    shoe_color: string;
  };
  sprites: {
    idle: {
      url: string;
      generated: string;
      layers: string[];
    };
    walk: {
      url: string;
      generated: string;
      layers: string[];
    };
    sit: {
      url: string;
      generated: string;
      layers: string[];
    };
  };
}

interface ConsolidatedData {
  version: string;
  totalCharacters: number;
  generatedAt: string;
  characters: Record<string, ConsolidatedCharacter>;
}

// Utility: Format character folder name
const getCharacterFolder = (num: number): string => {
  return `character_${num.toString().padStart(4, '0')}`;
};

// Remove empty text files
function removeEmptyFiles(): void {
  console.log('🧹 Removing empty text files...');
  let removedCount = 0;
  let errorCount = 0;

  for (let i = 1; i <= TOTAL_CHARACTERS; i++) {
    const folderName = getCharacterFolder(i);
    const characterDir = path.join(OUTPUT_DIR, folderName);

    if (!fs.existsSync(characterDir)) {
      console.warn(`⚠️  Directory not found: ${folderName}`);
      continue;
    }

    for (const fileName of FILES_TO_REMOVE) {
      const filePath = path.join(characterDir, fileName);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch (error) {
        console.error(`Error removing ${folderName}/${fileName}: ${error}`);
        errorCount++;
      }
    }

    // Progress indicator every 100 characters
    if (i % 100 === 0) {
      process.stdout.write(`\r  Progress: ${i}/${TOTAL_CHARACTERS} characters processed`);
    }
  }

  console.log(`\n✅ Removed ${removedCount} empty files`);
  if (errorCount > 0) {
    console.warn(`⚠️  ${errorCount} errors occurred`);
  }
}

// Regenerate consolidated JSON without empty fields
function regenerateConsolidatedJSON(): void {
  console.log('\n📦 Regenerating consolidated JSON...');

  const consolidatedData: ConsolidatedData = {
    version: '1.0',
    totalCharacters: 0,
    generatedAt: new Date().toISOString(),
    characters: {}
  };

  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i <= TOTAL_CHARACTERS; i++) {
    const folderName = getCharacterFolder(i);
    const characterDir = path.join(OUTPUT_DIR, folderName);

    try {
      // Read character data
      const characterDataPath = path.join(characterDir, 'character_data.json');
      const characterData: CharacterData = JSON.parse(fs.readFileSync(characterDataPath, 'utf-8'));

      // Read sprite info
      const idleInfoPath = path.join(characterDir, 'idle_info.json');
      const walkInfoPath = path.join(characterDir, 'walk_info.json');
      const sitInfoPath = path.join(characterDir, 'sit_info.json');

      const idleInfo: SpriteInfo = JSON.parse(fs.readFileSync(idleInfoPath, 'utf-8'));
      const walkInfo: SpriteInfo = JSON.parse(fs.readFileSync(walkInfoPath, 'utf-8'));
      const sitInfo: SpriteInfo = JSON.parse(fs.readFileSync(sitInfoPath, 'utf-8'));

      // Build consolidated character object (without answer/shortAnswer)
      const consolidated: ConsolidatedCharacter = {
        id: characterData.id,
        gender: characterData.gender,
        description: characterData.description,
        attributes: {
          skin_color: characterData.skin_color,
          hair_color: characterData.hair_color,
          hair_style: characterData.hair_style,
          shirt_color: characterData.shirt_color,
          leg_color: characterData.leg_color,
          leg_type: characterData.leg_type,
          shoe_color: characterData.shoe_color,
        },
        sprites: {
          idle: {
            url: `/characters/${folderName}/idle.png`,
            generated: idleInfo.generated,
            layers: idleInfo.layers,
          },
          walk: {
            url: `/characters/${folderName}/walk.png`,
            generated: walkInfo.generated,
            layers: walkInfo.layers,
          },
          sit: {
            url: `/characters/${folderName}/sit.png`,
            generated: sitInfo.generated,
            layers: sitInfo.layers,
          },
        },
      };

      consolidatedData.characters[folderName] = consolidated;
      successCount++;

    } catch (error) {
      console.error(`Error processing ${folderName}: ${error}`);
      errorCount++;
    }

    // Progress indicator every 100 characters
    if (i % 100 === 0) {
      process.stdout.write(`\r  Progress: ${i}/${TOTAL_CHARACTERS} characters processed`);
    }
  }

  consolidatedData.totalCharacters = successCount;

  // Write consolidated JSON
  const consolidatedPath = path.join(DATA_DIR, 'all-characters.json');
  fs.writeFileSync(consolidatedPath, JSON.stringify(consolidatedData, null, 2));

  console.log(`\n✅ Consolidated JSON regenerated`);
  console.log(`   Characters: ${successCount}/${TOTAL_CHARACTERS}`);
  console.log(`   File size: ${(fs.statSync(consolidatedPath).size / 1024 / 1024).toFixed(2)} MB`);

  if (errorCount > 0) {
    console.warn(`⚠️  ${errorCount} errors occurred`);
  }
}

// Main cleanup function
async function main() {
  console.log('🎨 Character Cleanup Script');
  console.log('============================');
  console.log(`Working directory: ${OUTPUT_DIR}`);
  console.log('');

  const startTime = Date.now();

  // Step 1: Remove empty files
  removeEmptyFiles();

  // Step 2: Regenerate consolidated JSON
  regenerateConsolidatedJSON();

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('✅ Cleanup complete!');
  console.log('===================');
  console.log(`Total time: ${totalTime}s`);
  console.log('');
  console.log('Changes made:');
  console.log('  - Removed all answer.txt and short-answer.txt files');
  console.log('  - Regenerated all-characters.json without empty fields');
  console.log('  - Sprite URLs remain unchanged and ready for React');
}

// Run the script
main().catch(console.error);
