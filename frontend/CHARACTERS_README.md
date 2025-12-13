# Character Data Documentation

This project includes 1,000 characters from the [Physda-Labs/technocracy](https://github.com/Physda-Labs/technocracy) repository, complete with sprites and metadata.

## Overview

- **Total Characters**: 1,000
- **Storage Location**: `frontend/public/characters/`
- **Consolidated Data**: `frontend/public/characters/data/all-characters.json` (2.17 MB)
- **Individual Assets**: Each character has its own folder with sprites and metadata

## Directory Structure

```
frontend/
├── public/
│   └── characters/
│       ├── data/
│       │   └── all-characters.json          # Consolidated metadata
│       ├── character_0001/
│       │   ├── idle.png                     # Idle animation sprite
│       │   ├── walk.png                     # Walking animation sprite
│       │   ├── sit.png                      # Sitting animation sprite
│       │   ├── character_data.json          # Character metadata
│       │   ├── idle_info.json               # Idle sprite layers
│       │   ├── walk_info.json               # Walk sprite layers
│       │   ├── sit_info.json                # Sit sprite layers
│       │   └── description.txt              # Character description
│       └── ... (character_0002 through character_1000)
├── src/
│   ├── types/
│   │   └── character.ts                     # TypeScript types
│   ├── components/
│   │   ├── CharacterWorld.tsx               # Main simulation component
│   │   ├── WorldCanvas.tsx                  # Canvas rendering
│   │   └── WorldControls.tsx                # UI controls
│   ├── hooks/
│   │   ├── useCharacterData.ts              # Data loading with TanStack Query
│   │   ├── useCamera.ts                     # Camera controls
│   │   └── useGameLoop.ts                   # Animation loop
│   └── lib/
│       ├── character.ts                     # Character class
│       ├── world.ts                         # World constants
│       └── canvas-utils.ts                  # Drawing utilities
└── scripts/
    ├── download-characters.ts               # Download script
    └── cleanup-characters.ts                # Cleanup script
```

## NPM Scripts

### Download All Characters
```bash
npm run download:characters
```
Downloads all 1,000 characters from the GitHub repository. Takes ~3-5 minutes.

### Resume Interrupted Download
```bash
npm run download:characters:resume
```
Skips already downloaded files and only fetches missing data.

### Clean Up Character Data
```bash
npm run cleanup:characters
```
Removes empty text files (answer.txt, short-answer.txt) and regenerates the consolidated JSON without those fields. Run this after downloading if you want a cleaner file structure.

## Data Format

### Consolidated JSON Structure

```typescript
{
  "version": "1.0",
  "totalCharacters": 1000,
  "generatedAt": "2025-11-22T...",
  "characters": {
    "character_0001": {
      "id": 1,
      "gender": "male" | "female",
      "description": "A boy with bronze skin...",
      "attributes": {
        "skin_color": "bronze",
        "hair_color": "chestnut",
        "hair_style": "twists_straight",
        "shirt_color": "slate",
        "leg_color": "navy",
        "leg_type": "pants" | "leggings",
        "shoe_color": "maroon"
      },
      "sprites": {
        "idle": {
          "url": "/characters/character_0001/idle.png",
          "generated": "2025-11-20T...",
          "layers": ["body/...", "head/...", ...]
        },
        "walk": { ... },
        "sit": { ... }
      }
    }
  }
}
```

## TypeScript Types

Import types from `@/types/character`:

```typescript
import type {
  Character,
  CharactersData,
  CharacterAttributes,
  CharacterSprites,
  SpriteData
} from '@/types/character';
```

## Usage in React Components

### Basic Example

```tsx
import { useState, useEffect } from 'react';
import type { CharactersData, Character } from '@/src/types/character';

export function CharacterDisplay() {
  const [data, setData] = useState<CharactersData | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);

  useEffect(() => {
    fetch('/characters/data/all-characters.json')
      .then(res => res.json())
      .then((data: CharactersData) => {
        setData(data);
        // Get first character
        const firstChar = Object.values(data.characters)[0];
        setCharacter(firstChar);
      });
  }, []);

  if (!character) return <div>Loading...</div>;

  return (
    <div>
      <h1>Character #{character.id}</h1>
      <p>{character.description}</p>
      <img src={character.sprites.walk.url} alt="Character sprite" />
    </div>
  );
}
```

## Sprite Information

Each character has 3 animation states:
- **Idle**: Standing still
- **Walk**: Walking animation
- **Sit**: Sitting pose

Each sprite is composed of 8 layers (LPC sprite format):
1. Body base
2. Head
3. Nose
4. Eyes
5. Hair
6. Torso/clothing
7. Legs/pants
8. Feet/shoes

Typical sprite dimensions: ~20-50 KB per PNG file

## Performance Considerations

### Lazy Loading Images
Since there are 3,000 PNG files, consider lazy loading:

```tsx
<img
  src={character.sprites.idle.url}
  loading="lazy"
  alt="Character sprite"
/>
```

### Pagination
For displaying many characters, use pagination:

```tsx
const charactersPerPage = 20;
const paginatedChars = allCharacters.slice(
  page * charactersPerPage,
  (page + 1) * charactersPerPage
);
```

### Virtual Scrolling
For very long lists, consider using a virtual scrolling library like `react-window`.

## Attribution

These character sprites use LPC (Liberated Pixel Cup) assets. See the original repository's CREDITS.csv for full attribution:
https://github.com/Physda-Labs/technocracy

## Re-downloading Data

If you need to re-download the data:

1. Delete the `public/characters` directory
2. Run `npm run download:characters`

Or use resume mode to only download missing files:
```bash
npm run download:characters:resume
```

## File Sizes

- **Total storage**: ~67 MB (after cleanup)
- **Consolidated JSON**: 2.17 MB
- **PNG sprites**: ~20-50 KB each (3 per character)
- **JSON metadata**: ~1-2 KB each (4 per character)
- **Description text**: ~100 bytes each

## Integration Tips

1. **Preload critical data**: Load the consolidated JSON early in your app
2. **Cache images**: Use Next.js Image component for automatic optimization
3. **Index by use case**: Create custom indexes for faster filtering
4. **Consider CDN**: Upload to Vercel/Cloudflare for faster global serving
5. **Optimize for production**: Consider WebP conversion for smaller images
