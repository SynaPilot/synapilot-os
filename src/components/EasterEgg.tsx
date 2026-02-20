import { useKonamiCode } from '@/hooks/useKonamiCode';
import { toast } from 'sonner';
import { useCallback } from 'react';

// Simple confetti effect without external dependency
function createConfetti() {
  const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 5;
    const left = Math.random() * 100;
    const animationDuration = Math.random() * 2 + 2;
    const animationDelay = Math.random() * 0.5;

    confetti.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${left}%;
      top: -20px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confetti-fall ${animationDuration}s ease-out ${animationDelay}s forwards;
      transform: rotate(${Math.random() * 360}deg);
    `;

    container.appendChild(confetti);
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes confetti-fall {
      0% {
        top: -20px;
        opacity: 1;
        transform: rotate(0deg) translateX(0);
      }
      100% {
        top: 100vh;
        opacity: 0;
        transform: rotate(720deg) translateX(${Math.random() > 0.5 ? '' : '-'}100px);
      }
    }
  `;
  document.head.appendChild(style);

  // Cleanup after animation
  setTimeout(() => {
    container.remove();
    style.remove();
  }, 4000);
}

export function EasterEgg() {
  const handleKonami = useCallback(() => {
    createConfetti();
    toast.success('🎉 Vous avez trouvé le secret !', {
      description: 'Bravo ! Le code Konami fonctionne encore en 2026.',
      duration: 5000,
    });
  }, []);

  useKonamiCode(handleKonami);

  return null;
}
