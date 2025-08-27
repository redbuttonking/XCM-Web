// import { useState } from 'react';

// const LaunchAppForm = ({ peerIds, sendJson }: LaunchAppFormProps) => {
//   const [pkg, setPkg] = useState(''); // 패키지명
//   const [label, setLabel] = useState(''); //  앱 라벨(아이콘에 보이는 이름)
//   const [apkName, setApkName] = useState(''); //  설치 시 APK 원본 파일명
//   const [activity, setActivity] = useState(''); // 필요시 명시 액티비티

//   const handleLaunch = () => {
//     if (peerIds.length === 0) {
//       alert('Peer를 하나 이상 선택하세요.');
//       return;
//     }

//     const pkgTrim = pkg.trim();
//     const labelTrim = label.trim();
//     const apkTrim = apkName.trim();
//     const actTrim = activity.trim();

//     if (!pkgTrim && !labelTrim && !apkTrim) {
//       alert('패키지명, 앱 라벨, APK 파일명 중 하나는 입력해야 합니다.');
//       return;
//     }

//     const payload: LaunchAppPayload = {
//       type: 'launch_app',
//       targetPeerIds: peerIds, // ✅ 비어있으면 전송하지 않음(위에서 막음)
//       ...(pkgTrim ? { pkg: pkgTrim } : {}),
//       ...(labelTrim ? { label: labelTrim } : {}),
//       ...(apkTrim ? { apkName: apkTrim } : {}),
//       ...(actTrim ? { activity: actTrim } : {}),
//     };

//     sendJson(payload);
//   };

//   return (
//     <div className="text-black">
//       <div>앱 실행</div>

//       <input
//         type="text"
//         value={pkg}
//         onChange={(e) => setPkg(e.target.value)}
//         placeholder="패키지명 (예: com.example.app)"
//         className="w-full border p-2 text-black"
//       />

//       <input
//         type="text"
//         value={label}
//         onChange={(e) => setLabel(e.target.value)}
//         placeholder="앱 라벨 (예: NovaSquare)"
//         className="mt-2 w-full border p-2 text-black"
//       />

//       <input
//         type="text"
//         value={apkName}
//         onChange={(e) => setApkName(e.target.value)}
//         placeholder="APK 파일명 (예: XCM_Square.apk 또는 XCM_Square)"
//         className="mt-2 w-full border p-2 text-black"
//       />

//       <input
//         type="text"
//         value={activity}
//         onChange={(e) => setActivity(e.target.value)}
//         placeholder="액티비티(선택, 예: com.example.app.MainActivity)"
//         className="mt-2 w-full border p-2 text-black"
//       />
//       <small className="text-black">
//         {' '}
//         * 런처가 없는 앱이면 액티비티를 지정하세요. 여러 값을 입력하면 Android에서 pkg &gt; label
//         &gt; apkName 순으로 해석합니다.
//       </small>

//       <div className="mt-2 text-black">선택된 Peer 수 : {peerIds.length}</div>

//       <button className="mt-2 rounded bg-blue px-4 py-2 text-white" onClick={handleLaunch}>
//         실행
//       </button>
//     </div>
//   );
// };

// export default LaunchAppForm;

// type LaunchAppPayload = {
//   type: 'launch_app';
//   targetPeerIds: string[];
//   pkg?: string;
//   label?: string;
//   apkName?: string;
//   activity?: string;
// };

// type LaunchAppFormProps = {
//   peerIds: string[];
//   sendJson: (payload: LaunchAppPayload) => Promise<void> | void;
// };

import { useState } from 'react';

const LaunchAppForm = ({ peerIds, sendJson }: LaunchAppFormProps) => {
  // 라벨만 유지
  const [label, setLabel] = useState<string>(''); // react-select를 쓴다면 string | {label:string; value?:string} 로

  const handleLaunch = () => {
    if (peerIds.length === 0) {
      alert('Peer를 하나 이상 선택하세요.');
      return;
    }

    // 혹시 모를 객체 형태 방어 (react-select 등)
    const labelStr =
      typeof label === 'string'
        ? label.trim()
        : // @ts-ignore(객체로 들어온 경우 label 또는 value를 문자열로)
          (label?.label ?? label?.value ?? '').toString().trim();

    if (!labelStr) {
      alert('앱 라벨을 입력하세요.');
      return;
    }

    const payload: LaunchAppPayload = {
      type: 'launch_app',
      targetPeerIds: peerIds,
      label: labelStr, // ✅ 문자열만 전송
    };

    console.log('[LaunchAppForm] payload =', payload);
    sendJson(payload);
  };

  return (
    <div className="text-black">
      <div>앱 실행</div>

      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="앱 라벨 (예: 카메라)"
        className="w-full border p-2 text-black"
      />

      <div className="mt-2 text-black">선택된 Peer 수 : {peerIds.length}</div>

      <button className="mt-2 rounded bg-blue px-4 py-2 text-white" onClick={handleLaunch}>
        실행
      </button>
    </div>
  );
};

export default LaunchAppForm;

type LaunchAppPayload = {
  type: 'launch_app';
  targetPeerIds: string[];
  label: string; // ✅ 문자열 고정
};

type LaunchAppFormProps = {
  peerIds: string[];
  sendJson: (payload: LaunchAppPayload) => Promise<void> | void;
};
