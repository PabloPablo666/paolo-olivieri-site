ESP32 Offline Chat
Campers Anonymous (Operation Houghton)

------------------------------------------------------------

This project implements a fully offline local chat system
running on an ESP32.

The device creates its own Wi-Fi access point (SoftAP) and
hosts a local web interface accessible from any connected
device (phone, laptop, tablet).

No internet connection is required.

------------------------------------------------------------
Wi-Fi access
------------------------------------------------------------

SSID:
ESP32 Offline Chat

Password:
local-access

Once connected to the network, open a browser and navigate to:

http://192.168.4.1

------------------------------------------------------------
Technical overview
------------------------------------------------------------

• ESP32 runs in Wi-Fi SoftAP mode
• Embedded HTTP server on port 80
• Single shared chat log stored in RAM (volatile)
• Messages are cleared on reboot
• Log is trimmed to ~3000 characters to bound memory usage
• Clients refresh via polling (1 second interval)
• No WebSockets
• No encryption layer
• No authentication

------------------------------------------------------------
HTTP endpoints
------------------------------------------------------------

GET  /          → chat interface
POST /send      → submit message (user, msg)
GET  /chatlog   → plain-text message log

------------------------------------------------------------
Hardware
------------------------------------------------------------

• Status LED on GPIO4
• Two-blink boot sequence used as an alive indicator

------------------------------------------------------------
Notes
------------------------------------------------------------

This system is intentionally minimal and designed for
temporary, local communication where infrastructure is
unavailable or unwanted.

The static HTML demo included on the website reproduces
the UI and interaction model, but it is NOT networked:
it stores messages in localStorage and does not replicate
the ESP32 shared multi-client RAM log.

------------------------------------------------------------
