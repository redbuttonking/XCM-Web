import React from 'react';

type VolumeBarProps = {
  volume: number;
};

export default function VolumeBar({ volume }: VolumeBarProps) {
  if (volume <= 10) return null;

  let color = 'bg-green-400';
  if (volume > 70) {
    color = 'bg-red-500';
  } else if (volume > 40) {
    color = 'bg-yellow-400';
  }

  return (
    <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className={`h-full ${color} transition-all duration-300 ease-in-out`}
        style={{ width: `${volume}%` }}
      />
    </div>
  );
}
