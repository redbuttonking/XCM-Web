// src/components/DownloadTray.tsx
import { useDownloadQueue } from '@/store/useDownloadQueue';

export default function DownloadTray() {
  const { items, remove, clear } = useDownloadQueue();

  if (items.length === 0) return null; // 평소엔 숨김

  const saveOne = (id: string, url: string, name: string) => {
    // 사용자 제스처(버튼 클릭) 핸들러 안에서 호출됨
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 약간 늦게 revoke(다운로드 시작 보장용)
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    remove(id);
  };

  const saveAll = () => {
    // 한 번의 사용자 제스처로 일괄 다운로드
    for (const it of items) {
      const a = document.createElement('a');
      a.href = it.url;
      a.download = it.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(it.url), 5000);
    }
    clear(); // 리스트 비우면 트레이도 닫힘
  };

  const dismiss = () => {
    // 저장하지 않고 정리(메모리 누수 방지)
    for (const it of items) URL.revokeObjectURL(it.url);
    clear(); // 트레이 닫힘
  };

  return (
    <div
      style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999, maxWidth: 360 }}
      className="rounded-2xl bg-white/90 p-3 text-black shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold text-black">저장 대기 중</div>
        <div className="flex gap-2">
          <button
            onClick={saveAll}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
          >
            모두 저장
          </button>
          <button
            onClick={dismiss}
            className="rounded border px-3 py-1 text-xs font-medium text-gray-200"
          >
            닫기
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2">
            <span className="line-clamp-1 text-sm text-black">{it.name}</span>
            <button
              onClick={() => saveOne(it.id, it.url, it.name)}
              className="w-[50px] rounded bg-emerald-500 px-2 py-1 text-xs text-white"
            >
              저장
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
