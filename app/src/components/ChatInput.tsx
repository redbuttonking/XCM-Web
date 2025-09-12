import { useState, useEffect, useRef } from 'react';

type ChatInputModalProps = {
  onSend: (message: string) => Promise<void> | void;
  peerIds: string[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onCancel: () => void; // 취소 콜백 추가
};

const ChatInput = ({
  onSend,
  peerIds,
  placeholder = '메시지를 입력하세요',
  disabled = false,
  autoFocus = false,
  onCancel,
}: ChatInputModalProps) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
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

  // 모달 내 input에 포커스 자동 할당
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // 배경 클릭 차단용 preventDefault onClick
  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onCancel} // 배경 클릭시 모달 닫기
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-white p-6"
        onClick={handleOverlayClick} // 모달 내용 클릭시 배경 클릭 이벤트 방지
      >
        <h2 className="mb-4 text-xl font-semibold text-black">메시지 보내기</h2>
        <textarea
          ref={textareaRef}
          className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          autoFocus={autoFocus}
          rows={6}
          aria-label="메시지 입력"
        />

        {/* <div className="mb-4 mt-2 text-black">선택된 Peer 수 : {peerIds.length}</div> */}

        <div className="mt-[20px] flex justify-end space-x-3">
          <button
            className="rounded border bg-white px-4 py-2 text-gray-200"
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="rounded bg-[#3A589F] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={sendMessage}
            disabled={disabled || sending}
            type="button"
          >
            {sending ? '전송중…' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
