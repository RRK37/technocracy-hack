---
description: How to add a new world mode to the simulation
---

# Adding a New World Mode

Follow these steps to create a new mode (or promote SCRATCH to a named mode).

## 1. Define the Mode

In `src/lib/world.ts`:

```typescript
// Add to WorldMode enum
export enum WorldMode {
  INTERACTIVE = 'interactive',
  OBSERVE = 'observe',
  SCRATCH = 'scratch',
  YOUR_MODE = 'your-mode',  // Add your new mode here
}
```

## 2. Configure Mode Features

In the same file, add to `MODE_CONFIG`:

```typescript
export const MODE_CONFIG: Record<WorldMode, ModeFeatures> = {
  // ... existing modes ...
  [WorldMode.YOUR_MODE]: {
    trapCircles: true,       // Can create/show trap circles
    interactions: false,     // Characters can interact
    interactionRadius: true, // Show interaction radius
    sitting: true,           // Can sit when clicked
  },
};
```

## 3. Add UI Button

In `src/components/WorldControls.tsx`:

1. Import an icon from lucide-react (optional)
2. Add a button in the mode switcher section (around line 160):

```tsx
<Button
  variant={worldMode === WorldMode.YOUR_MODE ? "default" : "outline"}
  size="sm"
  onClick={() => onSetWorldMode(WorldMode.YOUR_MODE)}
  className={`h-6 px-2 text-xs ${worldMode === WorldMode.YOUR_MODE ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-transparent'}`}
>
  <YourIcon className="size-3 mr-1" />
  Your Mode
</Button>
```

## 4. Add Custom Logic (Optional)

For mode-specific behavior, add logic guards in components:

### In CharacterWorld.tsx (game loop):
```typescript
if (worldMode === WorldMode.YOUR_MODE) {
  // Your custom interaction logic
}
```

### In WorldCanvas.tsx (input handling):
```typescript
if (modeConfigRef.current.yourFeature) {
  // Feature-gated logic
}
```

## 5. Add New Features (Optional)

To add a completely new feature to modes:

1. Add to `ModeFeatures` interface in `world.ts`:
```typescript
export interface ModeFeatures {
  trapCircles: boolean;
  interactions: boolean;
  interactionRadius: boolean;
  sitting: boolean;
  yourFeature: boolean;  // New feature flag
}
```

2. Set true/false for each mode in `MODE_CONFIG`

3. Guard the feature logic with `modeConfig.yourFeature`

## Using SCRATCH Mode

The SCRATCH mode is your sandbox:
1. Switch to SCRATCH in the UI (orange button)
2. Modify `MODE_CONFIG[WorldMode.SCRATCH]` to experiment
3. When happy, rename SCRATCH to your new mode name
4. Reset SCRATCH config back to OBSERVE defaults

## Mode Colors Reference

| Mode        | Color        | Tailwind Class          |
|-------------|--------------|-------------------------|
| Interactive | Purple       | bg-purple-600           |
| Observe     | Blue         | bg-blue-600             |
| Scratch     | Orange       | bg-orange-600           |
| (available) | Cyan, Green, Red, Yellow, Pink |
