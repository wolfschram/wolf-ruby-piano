import { AnimalMapping } from '../types';

export const ANIMAL_MAP: AnimalMapping[] = [
  { note: 'C', animal: 'cat',       emoji: '🐱', color: '#5DCAA5' },
  { note: 'D', animal: 'dog',       emoji: '🐶', color: '#F0997B' },
  { note: 'E', animal: 'elephant',  emoji: '🐘', color: '#AFA9EC' },
  { note: 'F', animal: 'frog',      emoji: '🐸', color: '#97C459' },
  { note: 'G', animal: 'giraffe',   emoji: '🦒', color: '#FAC775' },
  { note: 'A', animal: 'alligator', emoji: '🐊', color: '#85B7EB' },
  { note: 'B', animal: 'bear',      emoji: '🐻', color: '#ED93B1' },
];

export function getAnimalForNote(noteName: string): AnimalMapping | undefined {
  const base = noteName.replace(/[0-9#b]/g, '');
  return ANIMAL_MAP.find(a => a.note === base);
}

export function getAnimalColor(noteName: string): string {
  const animal = getAnimalForNote(noteName);
  return animal?.color ?? '#888888';
}

export function getAnimalEmoji(noteName: string): string {
  const animal = getAnimalForNote(noteName);
  return animal?.emoji ?? '🎵';
}

// Ruby mode levels — which notes are available at each level
export const RUBY_LEVELS = [
  { level: 1, notes: ['C', 'D', 'E'],                         label: '3 Keys' },
  { level: 2, notes: ['C', 'D', 'E', 'F', 'G'],              label: '5 Keys' },
  { level: 3, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],   label: 'Full Octave' },
  { level: 4, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],   label: 'Two Hands' },
];

export function getAvailableNotes(level: number): string[] {
  const lvl = RUBY_LEVELS.find(l => l.level === level) ?? RUBY_LEVELS[0];
  return lvl.notes;
}
