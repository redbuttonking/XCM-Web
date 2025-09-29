import { useState, useEffect } from 'react';

type LaunchAppFormProps = {
  peerIds: string[];
  sendJson: (payload: LaunchAppPayload) => Promise<void> | void;
  onCancel: () => void; // 모달 닫기 콜백
};

type LaunchAppPayload = {
  type: 'launch_app';
  targetPeerIds: string[];
  label: string; // 문자열 고정
};

const LaunchAppForm = ({ peerIds, sendJson, onCancel }: LaunchAppFormProps) => {
  const [label, setLabel] = useState<string>('');

  const handleLaunch = () => {
    if (peerIds.length === 0) {
      alert('Peer를 하나 이상 선택하세요.');
      return;
    }

    const labelStr = label.trim();

    if (!labelStr) {
      alert('앱 라벨을 입력하세요.');
      return;
    }

    const payload: LaunchAppPayload = {
      type: 'launch_app',
      targetPeerIds: peerIds,
      label: labelStr,
    };

    sendJson(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()} // 모달 내부 클릭시 이벤트 배경 전파 차단
      >
        <h2 className="mb-4 text-xl font-semibold text-black">APP 실행</h2>

        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="APP 라벨"
          className="mb-6 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="APP 라벨 입력"
        />

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="rounded border bg-white px-5 py-2 text-gray-200"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="rounded bg-[#3A589F] px-5 py-2 text-white"
            onClick={handleLaunch}
          >
            실행
          </button>
        </div>
      </div>
    </div>
  );
};

export default LaunchAppForm;
