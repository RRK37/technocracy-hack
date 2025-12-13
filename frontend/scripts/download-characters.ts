#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const REPO_BASE_URL = 'https://raw.githubusercontent.com/Physda-Labs/technocracy/main/char_x1000';
const TOTAL_CHARACTERS = 1000;
const CONCURRENT_DOWNLOADS = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'characters');
const DATA_DIR = path.join(OUTPUT_DIR, 'data');

// File lists for each character
const FILES_TO_DOWNLOAD = {
  json: ['character_data.json', 'idle_info.json', 'walk_info.json', 'sit_info.json'],
  text: ['description.txt', 'answer.txt', 'short-answer.txt'],
  images: ['idle.png', 'walk.png', 'sit.png']
};

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
  text: {
    answer: string;
    shortAnswer: string;
    description: string;
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

// Utility: Sleep function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Format character folder name
const getCharacterFolder = (num: number): string => {
  return `character_${num.toString().padStart(4, '0')}`;
};

// Utility: Download a file with retry logic
async function downloadFile(url: string, retries = MAX_RETRIES): Promise<string | Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Determine if binary or text
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('image') || url.endsWith('.png')) {
        return Buffer.from(await response.arrayBuffer());
      } else {
        return await response.text();
      }
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to download ${url} after ${retries} attempts: ${error}`);
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error(`Failed to download ${url}`);
}

// Utility: Ensure directory exists
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Utility: Check if file exists
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Download a single character's data
async function downloadCharacter(characterNum: number, resume: boolean = false): Promise<ConsolidatedCharacter | null> {
  const folderName = getCharacterFolder(characterNum);
  const characterDir = path.join(OUTPUT_DIR, folderName);

  ensureDir(characterDir);

  try {
    // Storage for downloaded data
    let characterData: CharacterData | null = null;
    let idleInfo: SpriteInfo | null = null;
    let walkInfo: SpriteInfo | null = null;
    let sitInfo: SpriteInfo | null = null;
    let descriptionText = '';
    let answerText = '';
    let shortAnswerText = '';

    // Download JSON files
    for (const jsonFile of FILES_TO_DOWNLOAD.json) {
      const url = `${REPO_BASE_URL}/${folderName}/${jsonFile}`;
      const localPath = path.join(characterDir, jsonFile);

      let content: string;
      if (resume && fileExists(localPath)) {
        content = fs.readFileSync(localPath, 'utf-8');
      } else {
        content = await downloadFile(url) as string;
        fs.writeFileSync(localPath, content);
      }

      const jsonData = JSON.parse(content);

      if (jsonFile === 'character_data.json') {
        characterData = jsonData;
      } else if (jsonFile === 'idle_info.json') {
        idleInfo = jsonData;
      } else if (jsonFile === 'walk_info.json') {
        walkInfo = jsonData;
      } else if (jsonFile === 'sit_info.json') {
        sitInfo = jsonData;
      }
    }

    // Download text files
    for (const textFile of FILES_TO_DOWNLOAD.text) {
      const url = `${REPO_BASE_URL}/${folderName}/${textFile}`;
      const localPath = path.join(characterDir, textFile);

      let content: string;
      if (resume && fileExists(localPath)) {
        content = fs.readFileSync(localPath, 'utf-8');
      } else {
        content = await downloadFile(url) as string;
        fs.writeFileSync(localPath, content);
      }

      if (textFile === 'description.txt') {
        descriptionText = content;
      } else if (textFile === 'answer.txt') {
        answerText = content;
      } else if (textFile === 'short-answer.txt') {
        shortAnswerText = content;
      }
    }

    // Download images
    for (const imageFile of FILES_TO_DOWNLOAD.images) {
      const url = `${REPO_BASE_URL}/${folderName}/${imageFile}`;
      const localPath = path.join(characterDir, imageFile);

      if (resume && fileExists(localPath)) {
        continue; // Skip if already downloaded
      }

      const imageBuffer = await downloadFile(url) as Buffer;
      fs.writeFileSync(localPath, imageBuffer);
    }

    // Build consolidated character object
    if (!characterData || !idleInfo || !walkInfo || !sitInfo) {
      throw new Error('Missing required data files');
    }

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
      text: {
        answer: answerText,
        shortAnswer: shortAnswerText,
        description: descriptionText,
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

    return consolidated;
  } catch (error) {
    console.error(`Error downloading ${folderName}: ${error}`);
    return null;
  }
}

// Download with concurrency control
async function downloadWithConcurrency(
  tasks: (() => Promise<any>)[],
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<any[]> {
  const results: any[] = [];
  let completed = 0;

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(task => task()));
    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress(completed, tasks.length);
    }
  }

  return results;
}

// Main download function
async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');

  console.log('🎨 Character Download Script');
  console.log('============================');
  console.log(`Downloading ${TOTAL_CHARACTERS} characters from Physda-Labs/technocracy`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Resume mode: ${resume ? 'ON' : 'OFF'}`);
  console.log('');

  // Ensure output directories exist
  ensureDir(OUTPUT_DIR);
  ensureDir(DATA_DIR);

  // Create download tasks
  const downloadTasks = Array.from({ length: TOTAL_CHARACTERS }, (_, i) => {
    const characterNum = i + 1;
    return () => downloadCharacter(characterNum, resume);
  });

  // Execute downloads with progress
  console.log('⬇️  Downloading character data...');
  const startTime = Date.now();

  const characters = await downloadWithConcurrency(
    downloadTasks,
    CONCURRENT_DOWNLOADS,
    (completed, total) => {
      const percent = ((completed / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  Progress: ${completed}/${total} (${percent}%) - ${elapsed}s elapsed`);
    }
  );

  console.log('\n');

  // Filter out failed downloads
  const successfulCharacters = characters.filter(c => c !== null);
  const failedCount = TOTAL_CHARACTERS - successfulCharacters.length;

  if (failedCount > 0) {
    console.warn(`⚠️  ${failedCount} character(s) failed to download`);
  }

  // Build consolidated JSON
  console.log('📦 Building consolidated JSON...');
  const consolidatedData: ConsolidatedData = {
    version: '1.0',
    totalCharacters: successfulCharacters.length,
    generatedAt: new Date().toISOString(),
    characters: {}
  };

  for (const character of successfulCharacters) {
    const folderName = getCharacterFolder(character.id);
    consolidatedData.characters[folderName] = character;
  }

  // Write consolidated JSON
  const consolidatedPath = path.join(DATA_DIR, 'all-characters.json');
  fs.writeFileSync(consolidatedPath, JSON.stringify(consolidatedData, null, 2));

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('✅ Download complete!');
  console.log('====================');
  console.log(`Total time: ${totalTime}s`);
  console.log(`Characters downloaded: ${successfulCharacters.length}/${TOTAL_CHARACTERS}`);
  console.log(`Consolidated JSON: ${consolidatedPath}`);
  console.log(`Total size: ${(fs.statSync(consolidatedPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  if (failedCount > 0) {
    console.log('Run with --resume flag to retry failed downloads');
  }
}

// Run the script
main().catch(console.error);
