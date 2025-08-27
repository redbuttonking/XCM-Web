// src/core/RoomClient.js (Minimal version)

// RoomClient.ts
import * as mediasoupClient from 'mediasoup-client';
// import type { EnhancedEventEmitter } from 'mediasoup-client/lib/EnhancedEventEmitter';
import protooClient from 'protoo-client';
import { getProtooUrl } from '@/core/urlFactory';
import Logger from '@/lib/Logger';
import { useRoomStore } from '../store/useRoomStore'; // ✅ 상태 관리 불러오기

const logger = new Logger('RoomClient');

interface RoomClientOptions {
  roomId: string;
  peerId: string;
  displayName: string;
  forceTcp?: boolean;
}

type MaybeLabel = string | { label?: string; value?: string } | null | undefined;

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
        const { peerId, producerId, id, kind, rtpParameters, appData } = request.data;
        try {
          const consumer = await this._recvTransport!.consume({
            id,
            producerId,
            kind,
            rtpParameters,
            appData: { ...appData, peerId },
          });

          const { updatePeerTrack } = useRoomStore.getState();
          updatePeerTrack(peerId, kind, consumer.track);

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

          rawConsumer.on('open', () => {
            console.log(`[RoomClient] 📡 DataConsumer open: ${label}`);
          });

          rawConsumer.on('message', (message: string | Buffer) => {
            const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
            console.log(`[RoomClient] 💬 메시지 수신 from ${peerId}:`, text);
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
            addPeer({ id: peer.id, displayName: peer.displayName });
          });
      }
      // 임시로 웹켐 주석 처리
      //  방에 입장 완료 후 내 미디어 자동 연결 (카메라 on , 마이크 off)
      // await this.enableMic();
      // await this.enableWebcam();

      // room 입장시 상대 peer 미디어 연결
      try {
        await this.request('resyncMedia');
        console.log('[RoomClient] 미디어 자동 연결 성공');
      } catch (err) {
        console.error('[RoomClient] 미디어 자동 연결 실패:', err);
      }
    });

    this._protoo.on('close', () => this.close());

    this._protoo.on('notification', (notification: any) => {
      // 서버에서 이벤트(method)가 일어난 것을 받고 data를 받음
      const { method, data } = notification;

      if (notification.method === 'newPeer') {
        const { id, displayName } = notification.data;

        if (id === this._peerId) return;

        console.log('[RoomClient] 새로운 peer 입장:', id, displayName);
        console.log('notification.data: ', notification.data);

        const { addPeer } = useRoomStore.getState();
        addPeer({ id, displayName });
      } // 퇴실한 peer 제거 처리 (서버에서 상대 peer이 나갔을 때 알려주는 이벤트)
      else if (method === 'peerClosed' || method === 'peerDisconnected') {
        const { peerId } = data;
        console.log('[RoomClient] peer 퇴실 알림:', peerId);
        const { removePeer } = useRoomStore.getState();
        removePeer(peerId);
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

  // open 대기 → 전송까지 한 번에
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
  // async sendLaunchApp(
  //   targetPeerIds: string[],
  //   opts: { pkg?: string; label?: string; apkName?: string; activity?: string },
  // ): Promise<boolean> {
  //   if (!targetPeerIds?.length) throw new Error('No target peers');
  //   const payload = {
  //     type: 'launch_app',
  //     targetPeerIds,
  //     ...(opts.pkg ? { pkg: opts.pkg } : {}),
  //     ...(opts.label ? { label: opts.label } : {}),
  //     ...(opts.apkName ? { apkName: opts.apkName } : {}),
  //     ...(opts.activity ? { activity: opts.activity } : {}),
  //   };
  //   return this._sendOverDcAsync(JSON.stringify(payload));
  // }
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

  get peerId(): string {
    return this._peerId;
  }

  request(method: string, data: any = {}) {
    if (!this._protoo || !this._protoo.request) {
      throw new Error('protoo 인스턴스가 초기화되지 않았거나 request 메서드가 없습니다.');
    }

    return this._protoo.request(method, data);
  }
}
