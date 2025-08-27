import { useState } from 'react';

type ChatInputProps = {
  onSend: (message: string) => Promise<void> | void;
  peerIds: string[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

const ChatInput = ({
  onSend,
  peerIds,
  placeholder = '메시지를 입력하세요',
  disabled = false,
  autoFocus = false,
}: ChatInputProps) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const sendMassege = async () => {
    const text = value.trim();
    if (!text || disabled || sending) return;

    try {
      setSending(true);
      await onSend(text);
      setValue('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <input
        className="flex-1 rounded px-2 py-1 text-black disabled:opacity-60"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') sendMassege();
        }}
        placeholder={placeholder}
        disabled={disabled || sending}
        autoFocus={autoFocus}
      />
      <div className="text-black">선택된 Peer 수 : {peerIds.length}</div>
      <button
        onClick={sendMassege}
        disabled={disabled || sending}
        className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? '전송중…' : '전송'}
      </button>
    </div>
  );
};

export default ChatInput;
