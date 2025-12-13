# Technocracy - Character World Simulation

An interactive 2D character world simulation built with Next.js, featuring animated pixel-art characters that wander, interact, and respond to questions.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4)

## Features

- **Animated Characters** - Pixel-art characters with walk, sit, and idle animations
- **Character Interactions** - Characters automatically interact based on proximity and "aura" levels
- **Trap Circles** - Right-click and drag to create barriers that confine characters
- **AI Chat Sidebar** - Ask questions to the villagers and get responses
- **Zoomable World** - Scroll to zoom, drag to pan the world view
- **Collapsible Sidebar** - Toggle the control panel visibility

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun

### Installation

```bash
# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Controls

| Action | Control |
|--------|---------|
| Pan world | Left-click + drag on canvas |
| Zoom | Mouse scroll wheel |
| Create trap circle | Right-click + drag |
| Remove trap circle | Ctrl + Right-click on circle |
| Toggle character sit | Click on character |
| End interaction | Shift + Click on interacting character |

## Project Structure

```
frontend/
├── app/                    # Next.js app router
├── components/ui/          # shadcn/ui components
├── src/
│   ├── components/         # Main application components
│   │   ├── CharacterWorld.tsx   # Main simulation container
│   │   ├── WorldCanvas.tsx      # Canvas rendering
│   │   └── WorldControls.tsx    # Sidebar controls
│   ├── hooks/              # Custom React hooks
│   │   ├── useCamera.ts         # Camera/zoom controls
│   │   ├── useCharacterData.ts  # Character data loading
│   │   └── useGameLoop.ts       # Game loop logic
│   ├── lib/                # Core logic
│   │   ├── character.ts         # Character class & behavior
│   │   ├── world.ts             # World configuration
│   │   └── canvas-utils.ts      # Drawing utilities
│   └── types/              # TypeScript types
└── public/
    └── characters/         # Character sprites & data
        ├── data/           # JSON character definitions
        └── [name]/         # Sprite sheets per character
```

## Configuration

Key constants in `src/lib/world.ts`:

```typescript
WORLD_CONFIG = {
  WIDTH: 3000,      // World width in pixels
  HEIGHT: 1500,     // World height in pixels
  NUM_CHARACTERS: 20
}

CHARACTER_CONFIG = {
  WIDTH: 64,
  HEIGHT: 64,
  SPEED: 1.5,
  INTERACTION_CHANCE: 0.001
}
```

## Adding Characters

1. Add sprite sheets to `public/characters/[name]/`:
   - `walk.png` - 4 rows × 4 columns (one row per direction)
   - `sit.png` - 3 frames per row
   - `idle.png` - 2 frames per row

2. Add character data to `public/characters/data/all-characters.json`

See `CHARACTERS_README.md` for detailed sprite specifications.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS 4
- **UI Components**: shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Icons**: Lucide React

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linter
```

## License

MIT
