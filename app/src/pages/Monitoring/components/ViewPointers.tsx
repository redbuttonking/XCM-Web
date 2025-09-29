import {
  MoveDown,
  MoveDownLeft,
  MoveDownRight,
  MoveLeft,
  MoveRight,
  MoveUp,
  MoveUpLeft,
  MoveUpRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useRoomStore } from '@/store/useRoomStore';
interface ViewPointersProps {
  peerId?: string;
  onCancel: () => void;
}

const ViewPointers = ({ peerId, onCancel }: ViewPointersProps) => {
  const btnStyle =
    'bg-blue rounded-full px-3 py-5  font-bold opacity-80 hover:opacity-100 hover:bg-blue ';
  const btnDiv = 'flex h-full w-full items-center justify-around ';
  const strokeWidth = 5;

  const roomClient = useRoomStore((state) => state.roomClient);

  const directionToFile: Record<string, string> = {
    up: 'look_up.mp3',
    up_left: 'look_up_left.mp3',
    up_right: 'look_up_right.mp3',
    down: 'look_down.mp3',
    down_left: 'look_down_left.mp3',
    down_right: 'look_down_right.mp3',
    left: 'look_left.mp3',
    right: 'look_right.mp3',
  };

  const handleDirection = async (direction: string) => {
    const filename = directionToFile[direction];
    if (!roomClient || !filename || !peerId) return;

    await roomClient.sendPointingAudio([peerId], filename, '가이드 음성');
  };

  return (
    <div className="absolute top-0 flex h-full w-full flex-col items-center justify-around">
      <div className={btnDiv}>
        {/* 버튼 상단 */}
        <Button onClick={() => handleDirection('up_left')} className={btnStyle}>
          <MoveUpLeft strokeWidth={strokeWidth} />
        </Button>

        <Button onClick={() => handleDirection('up')} className={btnStyle}>
          <MoveUp strokeWidth={strokeWidth} />
        </Button>

        <Button onClick={() => handleDirection('up_right')} className={btnStyle}>
          <MoveUpRight strokeWidth={strokeWidth} />
        </Button>
      </div>

      <div className={btnDiv}>
        {/* 버튼 중단 */}
        <Button onClick={() => handleDirection('left')} className={btnStyle}>
          <MoveLeft strokeWidth={strokeWidth} />
        </Button>

        <Button
          onClick={onCancel}
          className="rounded-full bg-blue px-3 py-[25px] font-bold opacity-80 hover:bg-blue hover:opacity-100"
        >
          취소
        </Button>

        <Button onClick={() => handleDirection('right')} className={btnStyle}>
          <MoveRight strokeWidth={strokeWidth} />
        </Button>
      </div>

      <div className={btnDiv}>
        {/* 버튼 하단 */}
        <Button onClick={() => handleDirection('down_left')} className={btnStyle}>
          <MoveDownLeft strokeWidth={strokeWidth} />
        </Button>

        <Button onClick={() => handleDirection('down')} className={btnStyle}>
          <MoveDown strokeWidth={strokeWidth} />
        </Button>

        <Button onClick={() => handleDirection('down_right')} className={btnStyle}>
          <MoveDownRight strokeWidth={strokeWidth} />
        </Button>
      </div>
    </div>
  );
};

export default ViewPointers;
