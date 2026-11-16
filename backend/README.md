# Backend deployment notes

## Photobooth camera relay

The photobooth uses WebRTC. For players behind restrictive NATs or firewalls,
configure a TURN service on the backend deployment; STUN-only connections may
not work across every network pair. Set `WEBRTC_ICE_SERVERS` to a JSON array
using the TURN URLs and credentials from your provider, then redeploy the API.
The frontend fetches this configuration from `/webrtc/ice-servers`, so TURN
credentials do not need to be committed to the repository or frontend bundle.

Example shape (replace the placeholders with real provider values):

```json
[
  {
    "urls": ["turn:turn.example.com:3478", "turns:turn.example.com:443"],
    "username": "<turn-username>",
    "credential": "<turn-password>"
  }
]
```

The API also includes Google STUN servers when `WEBRTC_ICE_SERVERS` is unset.
