import React, { useEffect, useState } from "react";
import * as io from 'socket.io-client';
import { values } from 'lodash';

const socket = io.connect("http://localhost:8080/");

// ice server's configuration
const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302',
        }, {
            urls: 'stun:stun.xten.com',
        }],
};
const Demo = () => {
    const [localStream, setLocalStream] = useState(undefined)
    const [remoteList, setRemoteList] = useState([])
    const [pcPeers, setPcPeers] = useState({})
    const join = async () => {
        let callback = socketIds => {
            values(socketIds).forEach(socketId => {
                createPC(socketId, true);
            });
        };
        socket.emit('join', "testRoom", callback);
    };
    const exchangePowerCall = async data => {
        const fromId = data.from;
        let pc;
        if (fromId in pcPeers) {
            pc = pcPeers[fromId];
        } else {
            pc = createPC(fromId, false);
        }
        try {
            if (data.sdp) {
                let sdp = new RTCSessionDescription(data.sdp);
                await pc.setRemoteDescription(sdp);
                if (pc.remoteDescription.type === 'offer') {
                    const description = await pc.createAnswer();
                    await pc.setLocalDescription(description);
                    socket.emit('exchange', { to: fromId, sdp: pc.localDescription });
                }
            } else if (data.candidate) {
                try {
                    await pc.addIceCandidate(data.candidate);
                } catch (e) {
                    console.error(e);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };
    const createPC = async (socketId) => {
        const peer = new RTCPeerConnection(configuration);
        pcPeers[socketId] = peer;
        setPcPeers(pcPeers)
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
        peer.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socket.emit('exchange', {
                    to: socketId, candidate,
                });
            }
        };
        peer.onnegotiationneeded = async () => {
            try {
                await peer.setLocalDescription(await peer.createOffer());
                socket.emit('exchange', { to: socketId, sdp: peer.localDescription });
            } catch (err) {
                console.error(err);
            }

        };
        peer.ontrack = ({ streams }) => {
            remoteList[socketId]=streams[0]
            setRemoteList(remoteList)
        };
        return peer;
    };
    useEffect(() => {
        (async () => {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(localStream)
            socket.on('exchange', data => {
                exchangePowerCall(data);
            });

        })()

    }, [])
    return (
        <div className={"container"}>
            <div>
                <button onClick={() => {
                    join()
                }}>Join
                </button>
            </div>
            <div className={"video-container"}>
                <video
                    ref={video => {
                        if (video) {
                            video.srcObject = localStream;
                        }
                    }}
                    autoPlay
                    playsInline
                    muted={true}
                />
            </div>
            <div className={"video-container"}>
                {!!Object.keys(remoteList).length && (
                    Object.keys(remoteList).map((key, index) => {
                        const stream = remoteList[key];
                        return (
                            <video
                                ref={video => {
                                    if (video) {
                                        video.srcObject = stream;
                                    }
                                }}
                                autoPlay
                                playsInline
                                muted={true}
                            />
                        )
                    }))
                }

            </div>
        </div>
    );
};

export default Demo;

