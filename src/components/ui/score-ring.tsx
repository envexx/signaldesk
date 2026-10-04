export function ScoreRing({ score, size = "normal" }: { score: number; size?: "small" | "normal" | "large" }) {
  return (
    <div
      className={`score-ring score-ring--${size}`}
      style={{ "--score": `${Math.max(0, Math.min(score, 100)) * 3.6}deg` } as React.CSSProperties}
      aria-label={`ICP score ${score} out of 100`}
    >
      <span>{score}</span>
      {size === "large" && <small>/100</small>}
    </div>
  );
}

