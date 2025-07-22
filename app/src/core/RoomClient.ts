// src/core/RoomClient.js (Minimal version)

// RoomClient.ts
import * as mediasoupClient from 'mediasoup-client';

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
          const dataConsumer = await this._recvTransport!.consumeData({
            id,
            dataProducerId,
            sctpStreamParameters,
            label,
            protocol,
            appData,
          });

          console.log(`[RoomClient] ✅ DataConsumer created from peer ${peerId}`);

          dataConsumer.on('open', () => {
            console.log(`[RoomClient] 📡 DataConsumer open: ${label}`);
          });

          dataConsumer.on('message', (message: string | Buffer) => {
            const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
            console.log(`[RoomClient] 💬 메시지 수신 from ${peerId}:`, text);
          });

          dataConsumer.on('close', () => {
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

  // 메시지 전송
  async sendChatMessage(messageText: string) {
    if (!this._dataProducer) {
      console.warn('[RoomClient] 아직 채널이 연결되지 않았습니다.');
      return;
    }

    if (this._dataProducer.readyState === 'open') {
      this._dataProducer.send(messageText);
    } else {
      console.warn('[RoomClient] 아직 채널이 연결되지 않았습니다.');
    }
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
