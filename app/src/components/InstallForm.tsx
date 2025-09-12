import { useState } from 'react';

interface InstallFormProps {
  peerIds: string[]; // 선택된 peerId만 전달됨
  onSubmit: (selectedPeers: string[], apkName: string, apkUrl: string) => void;
  onCancel: () => void; // 모달 닫기 콜백
}

const InstallForm = ({ peerIds, onSubmit, onCancel }: InstallFormProps) => {
  const [apkName, setApkName] = useState('');
  const [apkUrl, setApkUrl] = useState('');

  const handleSubmit = () => {
    if (!apkName || !apkUrl || peerIds.length === 0) {
      alert('APK 이름, 다운로드 URL, Peer 선택 모두 입력해야 합니다.');
      return;
    }
    onSubmit(peerIds, apkName, apkUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()} // 바깥 배경 클릭 이벤트 전파 차단
      >
        <h2 className="mb-4 text-xl font-semibold text-black">APK 다운로드 및 설치</h2>

        <input
          type="text"
          value={apkName}
          onChange={(e) => setApkName(e.target.value)}
          placeholder="APK 파일 이름 (ex: myapp.apk)"
          className="mb-4 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          placeholder="APK 다운로드 URL"
          className="mb-5 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            onClick={handleSubmit}
          >
            설치하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallForm;
