# Calendar Server

This repository contains the source code for the DaySift.net back-end server.

DaySift is a full-stack calendar service with a single-page app frontend. Users can instantly update their schedules from anywhere through a snappy drag-and-drop interface.

## Features

- Instant interactions, achieved via optimistic updates to a mutation buffer. The update algorithm is fault-tolerant, and will store updates indefinitely until the server can be reached. Network race conditions are recognized and handled appropriately. Concurrency conflicts are resolved automatically in favor of recent data without requiring user interaction.
- A managed local cache enables the front-end to serve queries from subsets or composite supersets of previously accessed data views. Staleness is tracked appropriately per view, and the application will only incur network activity when necessary, reducing server traffic and improving responsiveness for users.
- Intuitive, fluid interface makes it easy for users to reschedule their calendars without a lot of unnecessary actions, whether on desktop or mobile.

### Built with:
React 18, React Router, TanStack Query, PostgreSQL, Material UI, and lots of custom code.

---

Copyright © 2024 Bryan Rauen.
