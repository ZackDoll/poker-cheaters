// Peer-to-peer video and voice between everyone in a room (a full mesh: at most 15
// links for 6 players). The game server only relays the small signaling messages.
//
// The first offer between two players always comes from the one with the smaller id, so
// two players never offer at once. (When both offered, one had to roll back, and Chrome
// can then stall ICE gathering on that connection.) After the first exchange, either side
// may renegotiate, using the "perfect negotiation" pattern to settle any collision.

const KINDS = ['audio', 'video']

function iceServers() {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }]
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    })
  }
  return servers
}

export function createPeerMesh({ selfId, send, onStream, onState }) {
  const peers = new Map()
  let localStream = null

  // Send our camera and mic on this connection, reusing the transceiver for that kind.
  function attachLocalTracks(peer) {
    if (!localStream) return
    for (const track of localStream.getTracks()) {
      const transceiver = peer.pc.getTransceivers().find((t) => t.receiver.track.kind === track.kind)
      if (transceiver) {
        if (transceiver.sender.track !== track) transceiver.sender.replaceTrack(track)
        if (transceiver.direction === 'recvonly') transceiver.direction = 'sendrecv'
      } else {
        peer.pc.addTrack(track, localStream)
      }
    }
  }

  async function sendOffer(peer) {
    const { pc } = peer
    try {
      peer.makingOffer = true
      await pc.setLocalDescription()
      send({ type: 'rtc', to: peer.id, data: { description: pc.localDescription } })
    } catch (error) {
      console.warn('Could not start negotiation', error)
    } finally {
      peer.makingOffer = false
    }
  }

  function createPeer(id) {
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    const peer = {
      id,
      pc,
      initiator: selfId < id,
      polite: selfId > id,
      makingOffer: false,
      ignoreOffer: false,
      remote: new MediaStream(),
    }
    peers.set(id, peer)

    pc.ontrack = ({ track }) => {
      peer.remote.addTrack(track)
      // A fresh MediaStream each time, so the page notices a track arrived.
      onStream(id, new MediaStream(peer.remote.getTracks()))
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: 'rtc', to: id, data: { candidate } })
    }
    pc.onnegotiationneeded = () => {
      // Only the initiator opens the conversation; the other side waits for its offer.
      if (peer.initiator || pc.remoteDescription) sendOffer(peer)
    }
    pc.onconnectionstatechange = () => onState(id, pc.connectionState)
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce()
    }

    if (peer.initiator) {
      // Offer to receive audio and video even when we have nothing to send yet.
      for (const kind of KINDS) pc.addTransceiver(kind, { direction: 'recvonly' })
      attachLocalTracks(peer)
    }
    return peer
  }

  return {
    // Use the camera/mic stream for every current and future connection.
    setLocalStream(stream) {
      localStream = stream
      for (const peer of peers.values()) attachLocalTracks(peer)
    },

    // Make the set of connections match who is in the room right now.
    sync(peerIds) {
      const wanted = new Set(peerIds.filter((id) => id !== selfId))
      for (const id of wanted) if (!peers.has(id)) createPeer(id)
      for (const [id, peer] of peers) {
        if (!wanted.has(id)) {
          peer.pc.close()
          peers.delete(id)
          onStream(id, null)
        }
      }
    },

    async handleSignal(from, { description, candidate }) {
      const peer = peers.get(from) || createPeer(from)
      const { pc } = peer
      try {
        if (description) {
          const collision =
            description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable')
          peer.ignoreOffer = !peer.polite && collision
          if (peer.ignoreOffer) return
          await pc.setRemoteDescription(description)
          if (description.type === 'offer') {
            attachLocalTracks(peer)
            await pc.setLocalDescription()
            send({ type: 'rtc', to: from, data: { description: pc.localDescription } })
          }
        } else if (candidate) {
          try {
            await pc.addIceCandidate(candidate)
          } catch (error) {
            if (!peer.ignoreOffer) throw error
          }
        }
      } catch (error) {
        console.warn('Signaling error', error)
      }
    },

    close() {
      for (const peer of peers.values()) peer.pc.close()
      peers.clear()
    },
  }
}
