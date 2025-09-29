// src/core/RoomClient.js (Minimal version)

// RoomClient.ts
import * as mediasoupClient from 'mediasoup-client';
// import type { EnhancedEventEmitter } from 'mediasoup-client/lib/EnhancedEventEmitter';
import protooClient from 'protoo-client';
import { getProtooUrl } from '@/core/urlFactory';
import Logger from '@/lib/Logger';
import { useRoomStore, type PeerInfo } from '../store/useRoomStore'; // ✅ 상태 관리 불러오기
import type {
  DCMessage,
  DCMessageType,
  RequestStatusSummary,
  RequestStatusDetail,
} from '@/types/datachannel';
import { makeEnvelope } from '@/types/datachannel';
import { upsertDeviceSnapshot } from '@/core/utils';
import { resolveGeoIp } from '@/core/geoIp';
import type { BatteryObj } from '@/types/device';
import { pruneNullish } from './sanitize.ts';

const logger = new Logger('RoomClient');

interface RoomClientOptions {
  roomId: string;
  peerId: string;
  displayName: string;
  forceTcp?: boolean;
}

type MaybeLabel = string | { label?: string; value?: string } | null | undefined;

function getBatteryLevel(b: number | BatteryObj | undefined): number | undefined {
  return typeof b === 'number' ? b : b?.level;
}

export default class RoomClient {
  private _roomId: string;
  private _peerId: string;
  private _displayName: string;
  private _forceTcp: boolean;
  private _closed = false;
  private _protooUrl: string;
  private _protoo: any = null;
  private _mediasoupDevice: mediasoupClient.types.Device | null = null;
  private _sendTransport: mediasoupClient.types.Transport | null = null;
  private _recvTransport: mediasoupClient.types.Transport | null = null;

  private _micProducer: mediasoupClient.types.Producer | null = null;
  private _webcamProducer: mediasoupClient.types.Producer | null = null;

  private _dataProducer: mediasoupClient.types.DataProducer | null = null;

  private _peerDataChannels: Record<string, RTCDataChannel> = {};
  private _registerPeerDataChannel(peerId: string, dataChannel: RTCDataChannel) {
    this._peerDataChannels[peerId] = dataChannel;
  }

  private dcListeners = new Set<(msg: DCMessage) => void>();
  public subscribeDcMessage(fn: (msg: DCMessage) => void): () => void {
    this.dcListeners.add(fn);
    return () => {
      this.dcListeners.delete(fn);
    };
  }

  private _emitDc(msg: DCMessage) {
    for (const fn of this.dcListeners) {
      try {
        fn(msg);
      } catch (e) {
        console.error(e);
      }
    }
  }

  constructor({ roomId, peerId, displayName, forceTcp = false }: RoomClientOptions) {
    this._roomId = roomId;
    this._peerId = peerId;
    this._displayName = displayName;
    this._forceTcp = forceTcp;
    this._protooUrl = getProtooUrl({ roomId, peerId });
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this._protoo?.close();
    this._sendTransport?.close();
    this._recvTransport?.close();
    logger.debug('Room closed');
  }

  async join(): Promise<void> {
    logger.debug('join()');

    const transport = new protooClient.WebSocketTransport(this._protooUrl);

    this._protoo = new protooClient.Peer(transport);

    this._protoo.on('request', async (request: any, accept: any, reject: any) => {
      console.log('request.method: ', request.method);
      console.log('request: ', request);
      if (request.method === 'newConsumer') {
        const { peerId, producerId, id: consumerId, kind, rtpParameters, appData } = request.data;
        try {
          const consumer = await this._recvTransport!.consume({
            id: consumerId,
            producerId,
            kind,
            rtpParameters,
            appData: { ...appData, peerId },
          });

          const { updatePeerTrack, updatePeerConsumerId, updatePeerFields } =
            useRoomStore.getState();
          // 트랙 상태 갱신
          updatePeerTrack(peerId, kind, consumer.track);
          // consumerId 저장 (추가)
          updatePeerConsumerId(peerId, kind, consumerId);

          // 온라인 마킹 + 마지막 본 시간 업데이트
          updatePeerFields?.(peerId, { isConnected: true, lastSeen: Date.now() });

          // 🔽 mute 상태를 체크하고, 추후 unmute 되면 다시 업데이트
          if (kind === 'video') {
            consumer.track.addEventListener('unmute', () => {
              console.log(`[RoomClient] 🔊 consumer videoTrack unmuted → UI 갱신`);
              updatePeerTrack(peerId, 'video', consumer.track); // 강제로 UI 리렌더 유도
            });
          }

          accept();
        } catch (err) {
          reject(err);
        }
      } else if (request.method === 'newDataConsumer') {
        const { id, dataProducerId, sctpStreamParameters, label, protocol, appData, peerId } =
          request.data;

        console.log(`[RoomClient] 🔔 newDataConsumer from=${peerId} label=${label}`);
        try {
          const rawConsumer = await this._recvTransport!.consumeData({
            id,
            dataProducerId,
            sctpStreamParameters,
            label,
            protocol,
            appData,
          });

          // mediasoup-client 에서 DataConsumer 타입을 제대로 명시하지 않음
          // this._registerPeerDataChannel(peerId, dataConsumer);

          // 그래서 타입 가드 + 타입 좁히기
          if ('dataChannel' in rawConsumer) {
            const dataConsumer = rawConsumer as { dataChannel: RTCDataChannel };
            this._registerPeerDataChannel(peerId, dataConsumer.dataChannel);
          } else {
            console.warn('⚠️ dataChannel 속성이 존재하지 않음 — peer:', peerId);
          }

          console.log(`[RoomClient] ✅ DataConsumer created from peer ${peerId}`);

          useRoomStore
            .getState()
            .updatePeerFields?.(peerId, { isConnected: true, lastSeen: Date.now() });

          rawConsumer.on('open', () => {
            console.log(`[RoomClient] 📡 DataConsumer open: ${label}`);
          });

          rawConsumer.on('message', (message: string | Buffer) => {
            const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
            console.log(`[RoomClient] 💬 메시지 수신 from ${peerId}:`, text);
            this._onDcText(peerId, text); //  여기에서 DC 메시지 라우팅
          });

          rawConsumer.on('close', () => {
            console.warn('[RoomClient] ❌ DataConsumer closed');
          });

          accept();
        } catch (err) {
          console.error('[RoomClient] Failed to consume data:', err);
          reject(err);
        }
      } else {
        reject(404, 'not handled');
      }
    });

    this._protoo.on('open', async () => {
      useRoomStore.getState().setPeerId(this._peerId);

      const peers = await this._joinRoom();

      // 기존에 참여 중인 peer들 등록
      if (Array.isArray(peers)) {
        const { addPeer } = useRoomStore.getState();
        peers
          .filter((peer) => peer.id !== this._peerId)
          .forEach((peer: { id: string; displayName: string }) => {
            addPeer({
              id: peer.id,
              displayName: peer.displayName,
              isConnected: true,
              lastSeen: Date.now(),
            });
          });
      }
      // 임시로 웹켐 주석 처리
      //  방에 입장 완료 후 내 미디어 자동 연결 (카메라 on , 마이크 off)
      await this.enableMic();
      // await this.enableWebcam();

      // room 입장시 상대 peer 미디어 연결
      // resyncMedia 중복 때문에 주석 처리
      // try {
      //   await this.request('resyncMedia');
      //   console.log('[RoomClient] 미디어 자동 연결 성공');
      // } catch (err) {
      //   console.error('[RoomClient] 미디어 자동 연결 실패:', err);
      // }
    });

    this._protoo.on('close', () => this.close());

    this._protoo.on('notification', (notification: any) => {
      // 서버에서 이벤트(method)가 일어난 것을 받고 data를 받음
      const { method, data } = notification;

      if (notification.method === 'newPeer') {
        const { id, displayName } = notification.data;
        if (id === this._peerId) return;

        const api = useRoomStore.getState();
        api.addPeer({ id, displayName, isConnected: true, lastSeen: Date.now() });

        // 바로 기기 상태 요청 (앱이 즉시 push 안 주는 대비)
        // this.requestStatusSummary([id]);
      } // 퇴실한 peer 제거 처리 (서버에서 상대 peer이 나갔을 때 알려주는 이벤트)
      else if (method === 'peerClosed' || method === 'peerDisconnected') {
        const { peerId } = data;
        console.log('[RoomClient] peer 퇴실 알림:', peerId);
        //   const { removePeer } = useRoomStore.getState();
        //   removePeer(peerId);

        const api = useRoomStore.getState();
        // 삭제 대신 오프라인 마킹
        api.updatePeerFields(peerId, { isConnected: false, lastSeen: Date.now() });
        api.clearPeerMedia(peerId);
      } else if (method === 'consumerClosed') {
        const { consumerId } = data;
        const api = useRoomStore.getState();

        const peer = api.peers.find(
          (p) => p.audioConsumerId === consumerId || p.videoConsumerId === consumerId,
        );
        if (!peer) return;

        if (peer.audioConsumerId === consumerId) {
          api.clearPeerAudio(peer.id); // ✅ 오디오만 정리
        } else {
          api.clearPeerVideo(peer.id); // ✅ 비디오만 정리
        }

        api.removeConsumer?.(consumerId); // (있으면) consumers 맵도 같이 정리
        console.log('[RoomClient] consumerClosed cleaned:', consumerId);
      } else if (method === 'device-location') {
        const { peerId, pos, accuracyM } = data || {};
        const api = useRoomStore.getState();
        api.updatePeerFields(peerId, {
          geoLat: typeof pos?.lat === 'number' ? pos.lat : undefined,
          geoLon: typeof pos?.lon === 'number' ? pos.lon : undefined,
          geoAccuracyM: typeof accuracyM === 'number' ? accuracyM : undefined,
          lastSeen: Date.now(),
        });
      }
    });
  }

  private async _joinRoom(): Promise<Array<{ id: string; displayName: string }>> {
    try {
      this._mediasoupDevice = new mediasoupClient.Device();

      const routerRtpCapabilities = await this._protoo.request('getRouterRtpCapabilities');
      await this._mediasoupDevice.load({ routerRtpCapabilities });

      console.log('[join] sctpCapabilities:', this._mediasoupDevice.sctpCapabilities);

      const sendTransportInfo = await this._protoo.request('createWebRtcTransport', {
        forceTcp: this._forceTcp,
        producing: true,
        consuming: false,
        sctpCapabilities: this._mediasoupDevice?.sctpCapabilities,
      });

      this._sendTransport = this._mediasoupDevice.createSendTransport({
        ...sendTransportInfo,
        iceServers: [],
        proprietaryConstraints: {},
      });

      this._sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        this._protoo
          .request('connectWebRtcTransport', {
            transportId: this._sendTransport!.id,
            dtlsParameters,
          })
          .then(callback)
          .catch(errback);
      });

      this._sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await this._protoo.request('produce', {
            transportId: this._sendTransport!.id,
            kind,
            rtpParameters,
          });
          callback({ id });
        } catch (err) {
          errback(err as Error);
        }
      });

      this._sendTransport.on(
        'producedata',
        async ({ sctpStreamParameters, label, protocol, appData }, callback, errback) => {
          try {
            const { id } = await this._protoo.request('produceData', {
              transportId: this._sendTransport!.id,
              sctpStreamParameters,
              label,
              protocol,
              appData,
            });
            callback({ id });
          } catch (err) {
            errback(err as Error);
          }
        },
      );

      const { peers } = await this._protoo.request('join', {
        displayName: this._displayName,
        device: { flag: 'custom-client' },
        rtpCapabilities: this._mediasoupDevice.rtpCapabilities,
        sctpCapabilities: this._mediasoupDevice.sctpCapabilities,
        useDataChannel: true,
        role: 'admin', // 관리자
      });

      if (Array.isArray(peers)) {
        const { addPeer } = useRoomStore.getState();

        peers
          .filter((peer) => peer.id !== this._peerId)
          .forEach((peer) => {
            addPeer({ id: peer.id, displayName: peer.displayName });
          });
      }

      const recvTransportInfo = await this._protoo.request('createWebRtcTransport', {
        forceTcp: this._forceTcp,
        producing: false,
        consuming: true,
        sctpCapabilities: this._mediasoupDevice?.sctpCapabilities,
      });

      this._recvTransport = this._mediasoupDevice.createRecvTransport({
        ...recvTransportInfo,
        iceServers: [],
        proprietaryConstraints: {},
      });

      this._recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        this._protoo
          .request('connectWebRtcTransport', {
            transportId: this._recvTransport!.id,
            dtlsParameters,
          })
          .then(callback)
          .catch(errback);
      });

      try {
        await this.request('resyncMedia');
        console.log('[RoomClient] 미디어 자동 연결 성공');
      } catch (err) {
        console.error('[RoomClient] 미디어 자동 연결 실패:', err);
      }

      // ✅ join, transport 생성 등이 모두 끝난 후 dataproducer 생성
      if (this._sendTransport && !this._dataProducer) {
        this._dataProducer = await this._sendTransport.produceData({
          ordered: true,
          maxPacketLifeTime: undefined,
          maxRetransmits: undefined,
          label: 'chat',
          protocol: '',
          appData: {},
        });

        // 디버깅 리스너
        // 나중에 지워도 됨
        this._dataProducer.on('open', () => {
          console.log('[RoomClient] DataProducer open - 채팅 사용 가능');
        });
        this._dataProducer.on('close', () => {
          console.warn('[RoomClient] DataProducer closed');
        });
        this._dataProducer.on('error', (err) => {
          console.error('[RoomClient] DataProducer error:', err);
        });
      }

      logger.debug('Successfully joined room');
      return peers;
    } catch (err) {
      logger.error('Failed to join room:', err);
      this.close();
      return [];
    }
  }

  async enableMic(): Promise<void> {
    const { setMicTrack, setMicEnabled } = useRoomStore.getState();

    // 이미 producer가 있고, 꺼져 있는 경우에는 다시 활성화만
    if (this._micProducer?.track && !this._micProducer.track.enabled) {
      this._micProducer.track.enabled = true;
      setMicEnabled(true);
      return;
    }

    // 이미 producer가 있다면 produce() 하지 않음
    if (this._micProducer) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    this._micProducer = await this._sendTransport!.produce({ track });

    setMicTrack(track);
    setMicEnabled(true);
  }

  async enableWebcam(): Promise<void> {
    if (this._webcamProducer || !this._mediasoupDevice?.canProduce('video')) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      this._webcamProducer = await this._sendTransport!.produce({ track });

      // ✅ 상태 업데이트 여기서 직접
      const { setWebcamTrack, setWebcamEnabled } = useRoomStore.getState();
      setWebcamTrack(track);
      setWebcamEnabled(true);
    } catch (error) {
      console.warn('⚠️ enableWebcam() 실패:', error);
    }
  }

  async disableMic(): Promise<void> {
    const { setMicEnabled } = useRoomStore.getState();

    if (!this._micProducer?.track) return;

    // 오디오(마이크) 트랙 비활성화(음소거)
    this._micProducer.track.enabled = false;

    // 상태 업데이트
    setMicEnabled(false);
  }

  async disableWebcam(): Promise<void> {
    if (!this._webcamProducer) return;
    this._webcamProducer.close();
    this._webcamProducer = null;

    // ✅ 상태 업데이트
    const { setWebcamTrack, setWebcamEnabled } = useRoomStore.getState();
    setWebcamTrack(null);
    setWebcamEnabled(false);
  }

  // 전체 peer audio consumer를 모두 pause
  async pauseAllAudioConsumers(peers: PeerInfo[]) {
    for (const peer of peers) {
      if (peer.audioConsumerId) {
        await this.pauseConsumer(peer.audioConsumerId);
      }
    }
  }

  // 특정 peer audio consumer resume
  async resumeAudioForPeer(peerId: string) {
    const state = useRoomStore.getState();
    const peer = state.peers.find((p) => p.id === peerId);
    if (peer && peer.audioConsumerId) {
      await this.resumeConsumer(peer.audioConsumerId);
    }
  }

  // 다른 peer의 오디오를 중단하고 재개함
  async pauseConsumer(consumerId: string) {
    await this._protoo.request('pauseConsumer', { consumerId });
    useRoomStore.getState().setConsumerPaused(consumerId);
  }

  async resumeConsumer(consumerId: string) {
    await this._protoo.request('resumeConsumer', { consumerId });
    useRoomStore.getState().setConsumerResumed(consumerId);
  }

  async removeConsumer(consumerId: string) {
    await this._protoo.request('closeConsumer', { consumerId });
    useRoomStore.getState().removeConsumer(consumerId);
  }

  // DataChannel이 open 될 때까지 기다림 (타임아웃 포함)
  private async _waitForDataChannelOpen(timeoutMs = 7000): Promise<void> {
    const dp = this._dataProducer;
    if (!dp) throw new Error('DataProducer not created yet');
    if (dp.readyState === 'open') return;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onClose = () => {
        cleanup();
        reject(new Error('DataChannel closed'));
      };
      const onError = (e: any) => {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('open timeout'));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        dp.off('open', onOpen);
        dp.off('close', onClose);
        dp.off('error', onError);
      };

      dp.on('open', onOpen);
      dp.on('close', onClose);
      dp.on('error', onError);
    });
  }

  // open 대기 → 전송까지 한 번에(dataChennel 사용)
  private async _sendOverDcAsync(text: string, timeoutMs = 7000): Promise<boolean> {
    try {
      await this._waitForDataChannelOpen(timeoutMs);
      this._dataProducer!.send(text);
      return true;
    } catch (e) {
      console.warn('[RoomClient] DC send failed:', e);
      return false;
    }
  }

  // 메시지 전송
  async sendChatMessage(messageText: string): Promise<boolean> {
    return this._sendOverDcAsync(messageText);
  }

  // 메시지 전송(peer 선택)
  async sendChatMessageToPeers(targetPeerIds: string[], text: string): Promise<boolean> {
    return this._sendOverDcAsync(
      JSON.stringify({
        type: 'chat',
        targetPeerIds,
        text,
      }),
    );
  }

  // 설치 명령 (install_apk)
  async sendInstallApk(targetPeerIds: string[], apkName: string, apkUrl: string): Promise<boolean> {
    return this._sendOverDcAsync(
      JSON.stringify({ type: 'install_apk', apkName, apkUrl, targetPeerIds }),
    );
  }
  // 대상 peer에게 mp3 파일명으로 재생
  async sendAudioPlayByName(
    targetPeerIds: string[],
    filename: string,
    title?: string,
  ): Promise<boolean> {
    return this._sendOverDcAsync(
      JSON.stringify({ type: 'play_audio', targetPeerIds, filename, title }),
    );
  }

  // 대상 peer에게 URI로 재생
  async sendAudioPlayByUri(targetPeerIds: string[], uri: string, title?: string): Promise<boolean> {
    return this._sendOverDcAsync(JSON.stringify({ type: 'play_audio', targetPeerIds, uri, title }));
  }

  // 대상 peer에게 정지
  async sendAudioStop(targetPeerIds: string[]): Promise<boolean> {
    return this._sendOverDcAsync(JSON.stringify({ type: 'stop_audio', targetPeerIds }));
  }

  // 대상 peer에게 앱 실행
  async sendLaunchApp(
    targetPeerIds: string[],
    opts: { pkg?: string; label?: MaybeLabel; apkName?: string; activity?: string },
  ): Promise<boolean> {
    if (!targetPeerIds?.length) throw new Error('No target peers');

    // ✅ 라벨 정규화 (문자열만 남김)
    const labelStr =
      typeof opts.label === 'string'
        ? opts.label.trim()
        : (opts.label?.label ?? opts.label?.value ?? '').toString().trim();

    const payload = {
      type: 'launch_app',
      targetPeerIds,
      ...(labelStr ? { label: labelStr } : {}),
      ...(opts.pkg?.trim() ? { pkg: opts.pkg.trim() } : {}),
      ...(opts.apkName?.trim() ? { apkName: opts.apkName.trim() } : {}),
      ...(opts.activity?.trim() ? { activity: opts.activity.trim() } : {}),
    };

    console.log('[sendLaunchApp] payload:', payload); // 디버깅용
    return this._sendOverDcAsync(JSON.stringify(payload));
  }

  // 대상 peer 에게 뷰 가이드 전송
  async sendPointingAudio(
    targetPeerIds: string[],
    filename: string,
    title?: string,
  ): Promise<boolean> {
    return this._sendOverDcAsync(
      JSON.stringify({
        type: 'play_pointing',
        targetPeerIds,
        filename,
        title,
      }),
    );
  }

  // 단일 모니터링 consumer 재개
  async sendSingleMonitoring(targetPeerIds: string[]): Promise<boolean> {
    return this._sendOverDcAsync(JSON.stringify({ type: 'single_monitoring', targetPeerIds }));
  }

  // 중단 모니터링 consumer 중단
  async sendFullMonitoring(targetPeerIds: string | string[]): Promise<boolean> {
    const ids = typeof targetPeerIds === 'string' ? [targetPeerIds] : targetPeerIds;
    return this._sendOverDcAsync(JSON.stringify({ type: 'full_monitoring', targetPeerIds: ids }));
  }

  // dataChannel로 보내는 함수(상태(status)값)
  private _onDcText(fromPeerId: string, text: string) {
    const DEBUG_DC = false; // 디버그용 true로 하면 콘솔로그에 나옴
    const preview = (v: any, n = 200) => {
      try {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return s.length > n ? s.slice(0, n) + `…(+${s.length - n})` : s;
      } catch {
        return String(v);
      }
    };

    if (DEBUG_DC) console.log(`[RoomClient] DC raw <- ${fromPeerId}:`, preview(text));

    // 기존에는 chat/install 등 문자열/JSON이 섞여 들어올 수 있으니 안전 처리
    let obj: any;
    try {
      obj = JSON.parse(text);
    } catch {
      // 순수 채팅 같은 건 여기서 무시해도 됨 (필요하면 분기)
      if (DEBUG_DC) console.log(`[RoomClient] DC non-JSON <- ${fromPeerId}:`, preview(text));
      return;
    }

    if (DEBUG_DC)
      console.log(`[RoomClient] DC parsed <- ${fromPeerId} type=${obj?.type ?? '(none)'}`);

    // ✅ 1) 단일 스키마: { type:'status', ts, modelName, battery, storage:{}, wifi:{} }
    if (obj?.type === 'status') {
      const api = useRoomStore.getState();
      const ts = obj.ts ?? Date.now();
      // 배터리 정규화
      const clamp = (n: number) => Math.max(0, Math.min(100, n));
      const battery =
        typeof obj.battery === 'number'
          ? { level: clamp(obj.battery) }
          : obj && typeof obj.battery === 'object'
            ? {
                level: typeof obj.battery.level === 'number' ? clamp(obj.battery.level) : undefined,
                charging:
                  typeof obj.battery.charging === 'boolean' ? obj.battery.charging : undefined,
              }
            : undefined;

      if (DEBUG_DC) {
        0;
        const w = obj.wifi || {};
        const battStr = battery
          ? `${battery.level ?? '-'}${battery.charging === true ? ' (⚡)' : ''}`
          : '-';
        console.log(
          `[RoomClient] status(simple) from=${fromPeerId} model=${obj.modelName ?? '-'} ` +
            `batt=${battStr} wifi=${w.ssid ?? '-'} / ${w.bssid ?? '-'}`,
        );
      }

      api.upsertDeviceSummary(fromPeerId, {
        modelName: obj.modelName ?? undefined,
        battery,
        storage:
          obj.storage && typeof obj.storage === 'object'
            ? { total: obj.storage.total, free: obj.storage.free }
            : undefined,
        wifi:
          obj.wifi && typeof obj.wifi === 'object'
            ? {
                ssid: obj.wifi.ssid,
                bssid: obj.wifi.bssid,
                rssiDbm: obj.wifi.rssiDbm,
                linkSpeedMbps: obj.wifi.linkSpeedMbps,
              }
            : undefined,
        ip:
          typeof obj.publicIp === 'string'
            ? obj.publicIp
            : typeof obj.ip === 'string'
              ? obj.ip
              : undefined,
        lastSeen: ts,
      });

      const nextIp =
        typeof obj.publicIp === 'string'
          ? obj.publicIp
          : typeof obj.ip === 'string'
            ? obj.ip
            : undefined;

      // UI에서 바로 쓰는 top-level 필드도 갱신
      api.updatePeerFields(
        fromPeerId,
        pruneNullish({
          ssid: obj?.wifi?.ssid,
          bssid: obj?.wifi?.bssid,
          ip: nextIp, // nextIp 없으면 키 자체가 제거됨 → 기존 값 유지
          publicIp: nextIp,
          lastSeen: ts,
        }),
      );

      // ip가 바뀌었으면
      if (nextIp) {
        void useRoomStore.getState().refreshPeerGeoIfNeeded(fromPeerId, nextIp);
      }

      if (DEBUG_DC) console.log('[RoomClient] upsertDeviceSummary applied');
      return;
    }

    const t = obj?.type;

    if (t === 'device-location') {
      // 서버에서 오는 구조: { type:'device-location', peerId, pos:{lat,lon}, accuracyM }
      const { peerId, pos, accuracyM } = obj;

      const api = useRoomStore.getState();
      api.updatePeerFields(peerId, {
        geoLat: pos?.lat,
        geoLon: pos?.lon,
        geoAccuracyM: accuracyM,
        lastSeen: Date.now(),
      });

      return;
    }

    if (
      t === 'status.summary.push' ||
      t === 'status.summary.res' ||
      t === 'status.detail.res' ||
      t === 'status.heartbeat' ||
      t === 'status.enriched'
    ) {
      // 앱에서 peerId/ts가 없을 수 있으니 우리가 채워서 Envelope로 정규화
      const msg: DCMessage = {
        type: t,
        peerId: obj.peerId ?? fromPeerId,
        ts: obj.ts ?? Date.now(),
        requestId: obj.requestId,
        payload: obj.payload ?? obj, // 앱이 payload 래핑을 안 했어도 동작하게
      };

      // geo 정보가 있으면 바로 반영
      const p = msg.payload as any;

      if (p?.geo && typeof p.geo.lat === 'number' && typeof p.geo.lon === 'number') {
        const api = useRoomStore.getState();
        api.updatePeerFields(
          msg.peerId,
          pruneNullish({
            geoLat: p.geo.lat,
            geoLon: p.geo.lon,
            geoAccuracyM: p.geoAccuracy ?? null, // null이면 키 제거
            placeLabel: p.placeLabel,
            geoCity: typeof p.region === 'string' ? p.region : p.geoCity,
            lastSeen: msg.ts,
          }),
        );
      }

      const nextIp =
        typeof p?.publicIp === 'string' ? p.publicIp : typeof p?.ip === 'string' ? p.ip : undefined;

      if (nextIp) {
        const api = useRoomStore.getState();
        api.updatePeerFields(msg.peerId, {
          ip: nextIp,
          publicIp: nextIp,
          lastSeen: msg.ts,
        });
        // IP 변경시에만 내부에서 호출됨 (캐시/lastGeoResolvedIp 체크)
        void api.refreshPeerGeoIfNeeded(msg.peerId, nextIp);
      }

      if (DEBUG_DC) {
        const w = (msg.payload as any)?.wifi || {};
        console.log(
          `[RoomClient] ${t} from=${msg.peerId} ` +
            `ssid=${w.ssid ?? '-'} bssid=${w.bssid ?? '-'} geo=${(msg.payload as any)?.geoCity ?? '-'}`,
        );
        console.debug('[RoomClient] emitDc →', { ...msg, payload: preview(msg.payload) });
      }

      this._emitDc(msg);
    }
    if (DEBUG_DC) console.debug(`[RoomClient] (ignored) type=${obj?.type}`, preview(obj));
    // 그 외 type(chat, install_apk, ...)은 기존 로직대로 사용
  }

  public requestStatusSummary(targetPeerIds: string[], fields?: RequestStatusSummary['fields']) {
    const env = makeEnvelope('status.summary.req', fields ? { fields } : {}, this._peerId);
    // 앱에서 routing할 수 있게 대상 포함
    return this._sendOverDcAsync(JSON.stringify({ ...env, targetPeerIds }));
  }

  public requestStatusDetail(targetPeerId: string, scope: RequestStatusDetail['scope'] = 'all') {
    const env = makeEnvelope('status.detail.req', { scope }, this._peerId);
    return this._sendOverDcAsync(JSON.stringify({ ...env, targetPeerIds: [targetPeerId] }));
  }

  get peerId(): string {
    return this._peerId;
  }

  request(method: string, data: any = {}) {
    if (!this._protoo || !this._protoo.request) {
      throw new Error('protoo 인스턴스가 초기화되지 않았거나 request 메서드가 없습니다.');
    }

    return this._protoo.request(method, data);
  }

  private _hasAvConsumerId(id: string): boolean {
    const { peers } = useRoomStore.getState();
    // 오디오/비디오용으로 스토어에 살아있는 consumerId 인지 확인
    return peers.some((p) => p.audioConsumerId === id || p.videoConsumerId === id);
  }
}
