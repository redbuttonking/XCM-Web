const rooms = new Map();

// 새로운 방을 만들거나 있는 방이 있다면 가져오는 함수
const getOrCreateRoom = (roomId) => {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }
  const newRoom = {
    peers: new Map(),
    addPeer({ peerId, transport }) {
      newRoom.peers.set(peerId, transport);
      console.log(`peer 룸에 합류함 ㅇㅇ${peerId}`);
    },
  };

  rooms.set(roomId, newRoom);
  return newRoom;
};

module.exports = {
  getOrCreateRoom,
};
