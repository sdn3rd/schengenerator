import './LavaLamp.css';

const ORBS = [
  { cls: 'o1', size: 560 },
  { cls: 'o2', size: 420 },
  { cls: 'o3', size: 480 },
  { cls: 'o4', size: 340 },
  { cls: 'o5', size: 390 },
  { cls: 'o6', size: 300 },
];

export default function LavaLamp() {
  return (
    <div className="lava-wrap" aria-hidden="true">
      {ORBS.map(({ cls, size }) => (
        <div key={cls} className={`lava-orb ${cls}`} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}
