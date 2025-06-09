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
      console.log('request 값 확인 : ', request);
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

          accept();
        } catch (err) {
          reject(err);
        }
      } else {
        reject(404, 'not handled');
      }
    });

    this._protoo.on('open', async () => {
      useRoomStore.getState().setPeerId(this._peerId);

      const peers = await this._joinRoom();

      // ✅ 기존에 참여 중인 peer들 등록
      if (Array.isArray(peers)) {
        const { addPeer } = useRoomStore.getState();
        peers
          .filter((peer) => peer.id !== this._peerId)
          .forEach((peer: { id: string; displayName: string }) => {
            addPeer({ id: peer.id, displayName: peer.displayName });
          });
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
        console.log('여기 엘스 이프 문 왜 안걸려?');
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

      const sendTransportInfo = await this._protoo.request('createWebRtcTransport', {
        forceTcp: this._forceTcp,
        producing: true,
        consuming: false,
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

      const { peers } = await this._protoo.request('join', {
        displayName: this._displayName,
        device: { flag: 'custom-client' },
        rtpCapabilities: this._mediasoupDevice.rtpCapabilities,
      });

      if (Array.isArray(peers)) {
        const { addPeer } = useRoomStore.getState();
        console.log('디스 피얼 아이디가 뭔데?', this._peerId);

        peers
          .filter((peer) => peer.id !== this._peerId)
          .forEach((peer) => {
            addPeer({ id: peer.id, displayName: peer.displayName });
            console.log('필터로 걸린거 맞음? ', peer);
          });
      }

      const recvTransportInfo = await this._protoo.request('createWebRtcTransport', {
        forceTcp: this._forceTcp,
        producing: false,
        consuming: true,
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

      logger.debug('Successfully joined room');
      return peers;
    } catch (err) {
      logger.error('Failed to join room:', err);
      this.close();
      return [];
    }
  }

  async enableMic(): Promise<void> {
    if (this._micProducer || !this._mediasoupDevice?.canProduce('audio')) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    this._micProducer = await this._sendTransport!.produce({ track });

    // ✅ 상태 업데이트 여기서 직접
    const { setMicTrack, setMicEnabled } = useRoomStore.getState();
    setMicTrack(track);
    setMicEnabled(true);
  }

  async enableWebcam(): Promise<void> {
    if (this._webcamProducer || !this._mediasoupDevice?.canProduce('video')) return;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    this._webcamProducer = await this._sendTransport!.produce({ track });

    // ✅ 상태 업데이트 여기서 직접
    const { setWebcamTrack, setWebcamEnabled } = useRoomStore.getState();
    setWebcamTrack(track);
    setWebcamEnabled(true);
  }

  async disableMic(): Promise<void> {
    if (!this._micProducer) return;
    this._micProducer.close();
    this._micProducer = null;
    0;

    // ✅ 상태 업데이트
    const { setMicTrack, setMicEnabled } = useRoomStore.getState();
    setMicTrack(null);
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
