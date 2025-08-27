import { useState } from 'react';
interface InstallFormProps {
  peerIds: string[]; // 선택된 peerId만 전달됨
  onSubmit: (selectedPeers: string[], apkName: string, apkUrl: string) => void;
}

const InstallForm = ({ peerIds, onSubmit }: InstallFormProps) => {
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
    <div>
      <div className="text-black">APK 다운로드</div>
      <input
        type="text"
        value={apkName}
        onChange={(e) => setApkName(e.target.value)}
        placeholder="APK 파일 이름 (ex: myapp.apk)"
        className="w-full border p-2 text-black"
      />
      <input
        type="text"
        value={apkUrl}
        onChange={(e) => setApkUrl(e.target.value)}
        placeholder="APK 다운로드 URL"
        className="w-full border p-2 text-black"
      />
      <div className="text-black">선택된 Peer 수 : {peerIds.length}</div>
      <div className="text-black">선택된 Peer ID : {peerIds}</div>
      <button className="rounded bg-blue px-4 py-2 text-white" onClick={handleSubmit}>
        설치하기
      </button>
    </div>
  );
};

export default InstallForm;
