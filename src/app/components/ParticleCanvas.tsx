'use client';
import { useEffect, useRef } from 'react';

export default function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId: number;

    const tokenTypes = ['avax', 'eth', 'usdc', 'btc'];

    const nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      type?: string; // 'avax', 'eth', etc.
    }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < 80; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        type: Math.random() < 0.15 ? tokenTypes[Math.floor(Math.random() * tokenTypes.length)] : undefined,
      });
    }

    const drawToken = (ctx: CanvasRenderingContext2D, node: any) => {
      switch (node.type) {
        case 'avax':
          ctx.fillStyle = '#e84142';
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - 6);
          ctx.lineTo(node.x - 5, node.y + 5);
          ctx.lineTo(node.x + 5, node.y + 5);
          ctx.closePath();
          ctx.fill();
          break;
        case 'eth':
          ctx.strokeStyle = '#9fa8b3';
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - 6);
          ctx.lineTo(node.x, node.y + 6);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(node.x - 4, node.y);
          ctx.lineTo(node.x, node.y - 6);
          ctx.lineTo(node.x + 4, node.y);
          ctx.lineTo(node.x, node.y + 6);
          ctx.lineTo(node.x - 4, node.y);
          ctx.stroke();
          break;
        case 'usdc':
          ctx.fillStyle = '#2775ca';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'btc':
          ctx.fillStyle = '#f7931a';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '6px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('₿', node.x, node.y + 2);
          break;
        default:
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
      }
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(98, 234, 247, ${1 - distance / 120})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        drawToken(ctx, node);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0 w-full h-full z-[-1]"
    />
  );
}
