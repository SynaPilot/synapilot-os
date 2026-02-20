import { useEffect, useCallback, useRef } from 'react';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

export function useKonamiCode(callback: () => void) {
  const inputRef = useRef<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Clear timeout on each key press
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add the key to the input sequence
    inputRef.current.push(event.code);

    // Check if the sequence matches
    const inputString = inputRef.current.join(',');
    const konamiString = KONAMI_CODE.join(',');

    if (konamiString.startsWith(inputString)) {
      if (inputString === konamiString) {
        // Full match!
        callback();
        inputRef.current = [];
      }
    } else {
      // Reset if sequence breaks
      inputRef.current = [];
    }

    // Reset after 2 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      inputRef.current = [];
    }, 2000);
  }, [callback]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);
}
