/**
 * TypeScript types for character data from Physda-Labs/technocracy
 * Generated from the consolidated all-characters.json file
 */

export interface CharacterAttributes {
  skin_color: string;
  hair_color: string;
  hair_style: string;
  shirt_color: string;
  leg_color: string;
  leg_type: 'pants' | 'leggings';
  shoe_color: string;
}

export interface SpriteData {
  url: string;
  generated: string;
  layers: string[];
}

export interface CharacterSprites {
  idle: SpriteData;
  walk: SpriteData;
  sit: SpriteData;
}

export interface Character {
  id: number;
  gender: 'male' | 'female';
  description: string;
  attributes: CharacterAttributes;
  sprites: CharacterSprites;
  name: string;
  persona: string;
}

export interface CharactersData {
  version: string;
  totalCharacters: number;
  generatedAt: string;
  characters: Record<string, Character>;
}
