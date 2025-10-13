import { useEffect, useRef } from 'react';
import RoomClient from '@/core/RoomClient';
import { useRoomStore } from '@/store/useRoomStore';
import type { DCMessage } from '@/types/datachannel';
import { useAuthStore } from '@/store/useAuthStore';
import { loadAllDeviceSnapshots, upsertDeviceSnapshot } from '@/core/utils';
import { v4 as uuidv4 } from 'uuid'; // 렌덤으로 peerId ,roomId 생성

/**
 * 앱 전역에서 1회만 마운트되는 연결 관리자.
 * - 마운트 시 RoomClient 생성 -> join
 * - 라우트 전환과 무관하게 연결 유지
 * - 브라우저 종료/레이아웃 언마운트 시 close
 */
const RoomConnectionProvider = () => {
  const rcRef = useRef<RoomClient | null>(null);
  const roomClient = useRoomStore((s) => s.roomClient);

  // ✅ 로그인 mock 데이터 주입된 값 사용
  const adminId = useAuthStore((s) => s.adminId);
  const jwt = useAuthStore((s) => s.jwt);

  // 기존 Room 생성 방식(자동 and 하드코딩)
  // useEffect(() => {
  //   // zustand 상태는 getState()로 1회 접근 (deps에 안 걸리게)
  //   const store = useRoomStore.getState();

  //   // 이미 생성되어 있으면 재생성/재조인 방지
  //   if (!rcRef.current) {
  //     // const roomId = uuidv4();
  //     // const peerId = uuidv4();
  //     const roomId = 'monitoringRoom'; // 임시 고정
  //     const peerId = 'admin-web'; // 임시 고정
  //     const displayName = 'admin_displayName'; // 임시 고정 (로그인 연동 시 교체)

  //     rcRef.current = new RoomClient({
  //       roomId,
  //       peerId,
  //       displayName,
  //       forceTcp: false,
  //     });

  //     store.setRoomClient(rcRef.current);
  //   }

  //   // 이미 join 되어 있지 않으면 join
  //   if (!store.joined) {
  //     rcRef
  //       .current!.join()
  //       .then(() => {
  //         useRoomStore.getState().setJoined(true);
  //       })
  //       .catch((err) => {
  //         console.error('[RoomConnectionProvider] join 실패:', err);
  //         useRoomStore.getState().setJoined(false);
  //       });
  //   }

  //   // 탭 닫힘/새로고침 시 정리
  //   const onUnload = () => {
  //     try {
  //       rcRef.current?.close();
  //     } catch {}
  //   };
  //   window.addEventListener('beforeunload', onUnload);

  //   // 레이아웃이 정말로 언마운트될 때만 close
  //   return () => {
  //     window.removeEventListener('beforeunload', onUnload);
  //     try {
  //       rcRef.current?.close();
  //     } finally {
  //       rcRef.current = null;
  //       useRoomStore.getState().resetRoom();
  //     }
  //   };
  // }, []);

  useEffect(() => {
    // 아직 adminId가 없으면(로그인/mock 데이터 전) 아무 것도 안 함
    if (!adminId) return;

    const store = useRoomStore.getState();

    // 이미 생성되어 있으면 재생성/재조인 방지
    if (!rcRef.current) {
      const roomId = adminId; // ✅ 방 = 관리자 ID
      const peerId = `admin-${adminId}`; // ✅ 피어 = admin-<ID>
      const displayName = 'admin-web'; // 필요시 표시명으로 교체

      rcRef.current = new RoomClient({
        roomId,
        peerId,
        displayName,
        forceTcp: false,
        // ✅ JWT가 있으면 token까지 쿼리에 담아서 서버에서 관리자 검증
        extraQuery: jwt ? { token: jwt, adminId } : { adminId },
      });

      store.setRoomClient(rcRef.current);
    }

    // 이미 join 되어 있지 않으면 join
    if (!store.joined) {
      rcRef
        .current!.join()
        .then(() => useRoomStore.getState().setJoined(true))
        .catch((err) => {
          console.error('[RoomConnectionProvider] join 실패:', err);
          useRoomStore.getState().setJoined(false);
        });
    }

    // 탭 닫힘/새로고침 시 정리
    const onUnload = () => {
      try {
        rcRef.current?.close();
      } catch {}
    };
    window.addEventListener('beforeunload', onUnload);

    // 레이아웃이 정말로 언마운트될 때만 close
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      try {
        rcRef.current?.close();
      } finally {
        rcRef.current = null;
        useRoomStore.getState().resetRoom();
      }
    };
  }, [adminId, jwt]); // ✅ auth 값 바뀌면 재평가

  useEffect(() => {
    const rc = useRoomStore.getState().roomClient;
    if (!rc) return;

    const onMsg = (msg: DCMessage) => {
      const api = useRoomStore.getState();

      const pickSummary = (p: any) => {
        if (!p || typeof p !== 'object') return {};
        const { modelName, battery, controllerBattery, ssid, ip, geoCity, placeLabel } = p as any;
        return { modelName, battery, controllerBattery, ssid, ip, geoCity, placeLabel };
      };

      switch (msg.type) {
        case 'status.summary.push':
        case 'status.summary.res': {
          const summary = pickSummary(msg.payload);

          if (!api.peers.some((x) => x.id === msg.peerId)) {
            api.addPeer({ id: msg.peerId, displayName: msg.peerId });
          }

          const patch = {
            ...summary,
            isConnected: true,
            lastSeen: msg.ts,
            summaryUpdatedAt: msg.ts,
          };
          api.updatePeerFields(msg.peerId, patch);

          const existing = api.peers.find((p) => p.id === msg.peerId);
          upsertDeviceSnapshot({
            peerId: msg.peerId,
            displayName: existing?.displayName ?? msg.peerId,
            ...patch,
          });
          break;
        }
        case 'status.detail.res': {
          api.updatePeerFields(msg.peerId, { detailUpdatedAt: msg.ts });

          // detail 갱신도 스냅샷 반영(합쳐 저장)
          const p = api.peers.find((x) => x.id === msg.peerId);
          if (p) {
            upsertDeviceSnapshot({
              peerId: msg.peerId,
              displayName: p.displayName,
              modelName: p.modelName,
              battery: p.battery,
              controllerBattery: p.controllerBattery,
              ssid: p.ssid,
              ip: p.ip,
              geoCity: p.geoCity,
              placeLabel: p.placeLabel,
              lastSeen: p.lastSeen,
              summaryUpdatedAt: p.summaryUpdatedAt,
              detailUpdatedAt: msg.ts,
              isConnected: p.isConnected,
            });
          }
          break;
        }
        case 'status.heartbeat': {
          api.updatePeerFields(msg.peerId, { lastSeen: msg.ts });

          // heartbeat도 스냅샷 반영
          const p = api.peers.find((x) => x.id === msg.peerId);
          if (p) {
            upsertDeviceSnapshot({
              peerId: msg.peerId,
              displayName: p.displayName,
              modelName: p.modelName,
              battery: p.battery,
              controllerBattery: p.controllerBattery,
              ssid: p.ssid,
              ip: p.ip,
              geoCity: p.geoCity,
              placeLabel: p.placeLabel,
              lastSeen: msg.ts,
              summaryUpdatedAt: p.summaryUpdatedAt,
              detailUpdatedAt: p.detailUpdatedAt,
              isConnected: true,
            });
          }
          break;
        }
      }
    };

    const unsubscribe = rc.subscribeDcMessage(onMsg);
    return () => unsubscribe();
  }, [roomClient]);

  return null;
};

export default RoomConnectionProvider;
