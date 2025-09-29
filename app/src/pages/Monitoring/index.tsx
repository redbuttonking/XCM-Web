import React, { useEffect, useRef, useState } from 'react';
import RoomClient from '@/core/RoomClient';
import Peers from '@/components/Peers';
import Peer from '@/components/Peer';
import { useRoomStore, type RoomState } from '@/store/useRoomStore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import Me from '@/components/Me';
import { useShallow } from 'zustand/shallow';
import PeerSelector from '@/components/PeerSelector';
import InstallForm from '@/components/InstallForm';
import AudioPlayForm from '@/components/AudioPlayForm';
import ChatInput from '@/components/ChatInput';
import LaunchAppForm from '@/components/LanchAppForm';

import { useMultiPeerRecorder } from '@/hooks/useMultiPeerRecorder';
import DownloadTray from '@/components/DownloadTray';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ControlPanel from '@/components/controlpanels/ControlPanel';
import PremiumControlPanel from '@/components/controlpanels/PremiumControlPanel';
import ViewPointers from '@/pages/Monitoring/components/ViewPointers';

const Monitoring = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedPeerId = searchParams.get('peer') || '';
  const isSingleMonitoring = !!focusedPeerId; // focusedPeerId 값이 있으면 단일 모니터링 없으면 전체 모니터링
  const [monitoringMode, setMonitoringMode] = useState(!!focusedPeerId); // 모니터링 현재 상태 값 (전체 모니터링인지 단일 모니터링인지)

  const joined = useRoomStore((state) => state.joined);
  const roomClient = useRoomStore((state) => state.roomClient);

  const onlineIds = useRoomStore(
    useShallow((s) => s.peers.filter((p) => p.isConnected).map((p) => p.id)),
  );

  // 메시지 전송 , 오디오 재생 , apk 설치, 녹화 상태 변수
  const [activeMode, setActiveMode] = useState<
    'none' | 'message' | 'audio' | 'install' | 'Launch' | 'record' | 'viewGuide'
  >('none');

  // 선택된 peer의 상태를 일관되게 관리 하는 변수
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);

  // 녹화 상태: { peerId: true/false }
  const [recordingPeers, setRecordingPeers] = useState<Record<string, boolean>>({});

  // 내 비디오 UI 보이기 * 지금은 UI 작업으로 false로 박아놓음
  const [isMyVideo, setIsMyVideo] = useState(false);

  // peer 화면 공유 녹화 및 종료
  const { startMany, stopManyAndDownload } = useMultiPeerRecorder();

  // peer 화면 공유 캡처 함수
  const { capturePeerScreen } = useMultiPeerRecorder();

  // 현재 Room에 있는 peer들의 정보 (useShallow 그대로 사용)
  const peers = useRoomStore(
    useShallow((state: RoomState) => state.peers.filter((p) => p.isConnected)),
  );

  const peerIds = React.useMemo(() => peers.map((p) => p.id), [peers]);

  // 단일 모니터링 대상 peer
  const focusedPeer = focusedPeerId ? peers.find((p) => p.id === focusedPeerId) : undefined;

  const showMyVideo = () => {
    if (isMyVideo) {
      setIsMyVideo(false);
    } else {
      setIsMyVideo(true);
    }
  };

  // apk 설치 함수
  const handleInstallApk = (selected: string[], apkName: string, apkUrl: string) => {
    const client = useRoomStore.getState().roomClient;
    client?.sendInstallApk(selected, apkName, apkUrl);
  };

  // 오디오 재생 함수
  const handleAudioPlay = (payload: AudioPayload) => {
    const client = useRoomStore.getState().roomClient;
    if (!client) return;

    if (payload.type === 'play_audio') {
      if (payload.filename) {
        client.sendAudioPlayByName(payload.targetPeerIds, payload.filename, payload.title);
      } else if (payload.uri) {
        client.sendAudioPlayByUri(payload.targetPeerIds, payload.uri, payload.title);
      } else {
        console.warn('play_audio payload에 filename 또는 uri가 필요합니다.');
      }
    } else if (payload.type === 'stop_audio') {
      client.sendAudioStop(payload.targetPeerIds);
    }
  };

  // 메시지 전송 함수
  const handleSendMessage = async (msg: string) => {
    if (!roomClient) {
      console.warn('RoomClient가 존재하지 않습니다.');
      return;
    }
    if (selectedPeers.length === 0) {
      alert('메시지 보낼 대상을 선택하세요.');
      return;
    }
    await roomClient.sendChatMessageToPeers(selectedPeers, msg);
  };

  // 앱 실행 요청 함수
  const handleLaunchApp = (payload: LaunchAppPayload) => {
    const client = useRoomStore.getState().roomClient;
    if (!client) return;

    client.sendLaunchApp(payload.targetPeerIds, {
      pkg: payload.pkg, // 패키지명 (알고 있으면 가장 정확)
      label: payload.label, // 앱 라벨 (아이콘에 보이는 이름)
      apkName: payload.apkName, // 설치 시의 원본 파일명 (또는 확장자 없는 이름)
      activity: payload.activity, // 필요시 명시 액티비티
    });
  };

  //  단일 ↔ 전체 모니터링 토글 함수
  const exitSingle = () => {
    searchParams.delete('peer');
    setSearchParams(searchParams, { replace: true });
    setSelectedPeers([]); // 추가: 선택 초기화
  };

  // 화면 공유된 비디오 녹화 함수
  const handleStartRecording = (peerIds: string[]) => {
    startMany(peerIds); // 실제 녹화 시작
    setRecordingPeers((prev) => {
      const updated = { ...prev };
      peerIds.forEach((id) => (updated[id] = true));
      return updated;
    });
  };

  // 화면 공유된 비디오 녹화 종료 함수
  const handleStopRecording = (peerIds: string[]) => {
    stopManyAndDownload(peerIds); // 실제 녹화 중지/저장
    setRecordingPeers((prev) => {
      const updated = { ...prev };
      peerIds.forEach((id) => (updated[id] = false));
      return updated;
    });
  };

  // 단일 모니터링 peer 화면 캡처 함수
  const handleSinglePeerCapture = async (peerId: string) => {
    await capturePeerScreen(peerId);
  };

  // peer의 미디어(consumer)를 재연결 하는 함수(새로고침)
  const handleMediaReconnect = async () => {
    if (!roomClient) return;

    try {
      await roomClient.request('resyncMedia'); // 서버에 커스텀 메시지 요청
      console.log('[MediaReconnectButton] 미디어 재연결 요청 완료');
    } catch (err) {
      console.error('[MediaReconnectButton] 미디어 재연결 실패:', err);
    }
  };

  // 방에 들어온 peer의 상태 업데이트 (퇴장한 대상은 선택 목록에서 제거)
  useEffect(() => {
    setSelectedPeers((prev) => {
      const next = prev.filter((id) => peerIds.includes(id));
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });
  }, [peerIds]);

  // 단일 화면일 때는 선택 대상을 해당 peer로 강제(컨트롤 재사용하려면 유용)
  useEffect(() => {
    if (focusedPeerId) {
      setSelectedPeers([focusedPeerId]);
    } else {
      setSelectedPeers([]);
    }
  }, [focusedPeerId]);

  // 녹화중에 나간 peer 상태 정리
  useEffect(() => {
    // 실제 값이 바뀔 때만 setState
    setRecordingPeers((prev) => {
      const validIds = new Set(peerIds);
      const updated: Record<string, boolean> = {};
      let changed = false;
      for (const id of Object.keys(prev)) {
        if (validIds.has(id)) {
          updated[id] = prev[id];
        } else {
          changed = true;
        }
      }
      // 변경이 있을 때만 새 객체 반환
      if (changed) return updated;
      return prev;
    });
  }, [peerIds]);

  // 전체 모니터링으로 전환 시 뷰가이드 UI 종료
  useEffect(() => {
    if (!isSingleMonitoring && activeMode === 'viewGuide') {
      setActiveMode('none');
    }
  }, [isSingleMonitoring, activeMode, setActiveMode]);

  // 관리자(웹) 입장에서 다른 peer(앱)와 연결된 consumer를 중단하거나 재개함
  useEffect(() => {
    if (!joined || !roomClient || peers.length === 0) return;

    if (isSingleMonitoring) {
      roomClient.resumeAudioForPeer(focusedPeerId);
    } else {
      roomClient.pauseAllAudioConsumers(peers);
    }
    return () => {
      roomClient.pauseAllAudioConsumers(peers);
    };
  }, [joined, roomClient, isSingleMonitoring, focusedPeerId, peers]);

  // 모니터링 상태 변화 감지 → 서버에 단일/전체 모드 알려주기
  useEffect(() => {
    if (!joined || !roomClient) return;

    if (isSingleMonitoring && focusedPeerId) {
      // 단일 모니터링: focusedPeerId를 targetPeerIds 배열로 보내 consumer 재개 요청
      roomClient
        .sendSingleMonitoring([focusedPeerId])
        .then((ok) => {
          if (!ok) console.warn('단일 모니터링 명령 전송 실패');
        })
        .catch((e) => console.error('단일 모니터링 명령 예외:', e));
    } else {
      // 전체 모니터링: 나(웹)의 peerId를 배열로 보내 consumer 중단 요청
      roomClient
        .sendFullMonitoring([roomClient.peerId])
        .then((ok) => {
          if (!ok) console.warn('전체 모니터링 명령 전송 실패');
        })
        .catch((e) => console.error('전체 모니터링 명령 예외:', e));
    }
  }, [monitoringMode, focusedPeerId, joined, roomClient]);

  // URL 쿼리 변화에 따라 모드 state 동기화
  useEffect(() => {
    setMonitoringMode(!!focusedPeerId);
  }, [focusedPeerId]);

  // 오프라인 상태 peer는 제거
  useEffect(() => {
    setSelectedPeers((prev) => prev.filter((id) => onlineIds.includes(id)));
  }, [onlineIds]);

  if (!joined) return <div className="text-center text-gray-500">방에 참여 중입니다...</div>;

  return (
    <div className="flex w-full flex-col">
      {/* <Button
        onClick={() => {
          // 모든 audio element muted 해제 및 play 시도
          document.querySelectorAll('audio').forEach((audio) => {
            audio.muted = false;
            audio.play().catch((err) => {
              console.error('사용자 인터랙션 후에도 재생 실패:', err);
            });
          });
          setActiveMode('none'); // 재생 모드 종료
        }}
      >
        오디오 재생 시작
      </Button> */}
      {/* (유지) 헤더 주석 블록 */}
      {/* <div className="flex justify-center gap-1">
        <MediaReconnectButton />

        <Button onClick={showMyVideo} className="flex justify-center p-2">
          {isMyVideo ? '내 영상 닫기' : '내 영상 보이기'}MediaReconnectButton
        </Button>
      </div> */}

      {/* --- 단일 화면 분기 --- */}
      {focusedPeerId ? (
        <div className="flex h-full w-full flex-col gap-4">
          <div>
            <Button
              type="button"
              className="flex gap-2 rounded-3xl border py-[12px] pl-[12px] pr-[18px] font-bold text-black"
              onClick={exitSingle}
              variant="outline"
              aria-label="전체 모니터링으로"
            >
              <ChevronLeft />
              <div>전체 모니터링</div>
            </Button>
          </div>

          {!focusedPeer ? (
            <div className="flex h-[1052px] items-center justify-center rounded-xl border bg-white p-8 text-center text-black">
              선택한 기기가 현재 방에 없어요.
              <Button className="ml-2" variant="outline" onClick={exitSingle}>
                돌아가기
              </Button>
            </div>
          ) : (
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-10 font-bold">
              <Peer
                peer={focusedPeer}
                variant="single"
                isRecording={!!recordingPeers[focusedPeer.id]}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
              />

              <div className="flex w-full max-w-[1280px] flex-wrap items-center justify-center gap-6">
                <ControlPanel
                  selectedPeers={selectedPeers}
                  focusedPeer={focusedPeer?.id}
                  onSetActiveMode={setActiveMode}
                  onStartRecording={() => handleStartRecording(selectedPeers)}
                  onStopRecording={() => handleStopRecording(selectedPeers)}
                  onMediaReconnect={() => handleMediaReconnect()}
                  onSinglePeerCapture={handleSinglePeerCapture}
                  showViewGuideButton={isSingleMonitoring}
                />
                <PremiumControlPanel
                  selectedPeers={selectedPeers}
                  onSetActiveMode={setActiveMode}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- 전체모니터링 화면 ---
        <>
          <div className="pb-[40px] text-2xl font-bold text-black">Monitoring</div>
          <div className="overflow-hidden px-[0px] pb-[80px]">
            <Peers
              selectedPeers={selectedPeers}
              onChange={setSelectedPeers}
              recordingPeers={recordingPeers}
              onlyOnline
            />
          </div>
          <div className="flex w-full items-center justify-center gap-10">
            <ControlPanel
              selectedPeers={selectedPeers}
              onSetActiveMode={setActiveMode}
              onStartRecording={() => handleStartRecording(selectedPeers)}
              onStopRecording={() => {
                handleStopRecording(selectedPeers);
                if (focusedPeerId === '') {
                  setSelectedPeers([]);
                }
              }}
              onMediaReconnect={() => handleMediaReconnect()}
            />
            <PremiumControlPanel selectedPeers={selectedPeers} onSetActiveMode={setActiveMode} />
          </div>
        </>
      )}

      {/* peer 영상 다운로드시 갑자기 나갔을 때 저장에 대한 예외 처리 */}
      <DownloadTray />
      {/* 모달창 */}
      {activeMode === 'message' && (
        <ChatInput
          peerIds={selectedPeers}
          onSend={async (msg) => {
            await handleSendMessage(msg);
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
          onCancel={() => {
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
        />
      )}
      {/* 오디오 재생 모달창 */}
      {/* {activeMode === 'audio' && (
        <AudioPlayForm
          peerIds={selectedPeers}
          sendJson={(payload) => {
            handleAudioPlay(payload);
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
          onCancel={() => {
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
        />
      )} */}
      {activeMode === 'install' && (
        <InstallForm
          peerIds={selectedPeers}
          onSubmit={(peers, apkName, apkUrl) => {
            handleInstallApk(peers, apkName, apkUrl);
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
          onCancel={() => {
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
        />
      )}
      {activeMode === 'Launch' && (
        <LaunchAppForm
          peerIds={selectedPeers}
          sendJson={(payload) => {
            handleLaunchApp(payload);
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
          onCancel={() => {
            setActiveMode('none');
            if (focusedPeerId === '') {
              setSelectedPeers([]);
            }
          }}
        />
      )}
      {/* 메시지 알림 UI */}
      {/* <div className="absolute bottom-4 right-4 z-50 text-black">
        <NotificationsContainer />
      </div> */}
    </div>
  );
};

type AudioPayload =
  | {
      type: 'play_audio';
      targetPeerIds: string[];
      title?: string;
      filename: string; // 파일명으로 재생
      uri?: never;
    }
  | {
      type: 'play_audio';
      targetPeerIds: string[];
      title?: string;
      uri: string; // uri 형태로 재생
      filename?: never;
    }
  | {
      type: 'stop_audio';
      targetPeerIds: string[];
    };

type LaunchAppPayload = {
  type: 'launch_app';
  targetPeerIds: string[];
  pkg?: string;
  label?: string;
  apkName?: string;
  activity?: string;
};

export default Monitoring;
