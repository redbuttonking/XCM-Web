// src/RoomClient.js
import * as protoo from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';

export function connectAndJoinProtoo({
  wsUrl,
  displayName,
  device,
  onOpen,
  onClose,
  onNotification,
}) {
  const transport = new protoo.WebSocketTransport(wsUrl);
  const peer = new protoo.Peer(transport);

  peer.on('open', async () => {
    console.log('🟢 Connected to protoo-server!');
    try {
      // 1. getRouterRtpCapabilities 요청
      const routerRtpCapabilities = await peer.request('getRouterRtpCapabilities');
      // 2. mediasoup Device 준비
      const msDevice = new mediasoupClient.Device();
      await msDevice.load({ routerRtpCapabilities });

      // 3. join payload 실제 구조!
      const payload = {
        displayName,
        device,
        rtpCapabilities: msDevice.rtpCapabilities,
      };

      // 4. join 요청
      const resp = await peer.request('join', payload);
      console.log('✅ join 성공:', resp);
      if (onOpen) onOpen(resp);
    } catch (err) {
      console.error('❌ join 실패:', err);
    }
  });

  peer.on('close', () => {
    console.log('❌ Connection closed');
    if (onClose) onClose();
  });

  peer.on('notification', (notification) => {
    console.log('🔔 Notification from server:', notification);
    if (onNotification) onNotification(notification);
  });

  return peer;
}
