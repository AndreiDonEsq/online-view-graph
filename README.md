# Mentoring Activities 2D Matrix (Impactful vs Fun)

A fast, interactive web application designed for facilitators running mentoring trainings and workshops. It allows participants to evaluate and discuss different mentoring activities across two key dimensions:
- **X-Axis**: **Impactful to Mentee** (Scale 1 – 10)
- **Y-Axis**: **Fun for Mentor** (Scale 1 – 10)

The application produces a clean, presentation-ready overview grid of coordinate graphs—one per activity prompt—with colored letter avatars for each participant and an organic enclosing cluster shape ("bubble") showing group alignment or divergence.

---

## 🎨 Visual Layout (Matches Training Workshop Sketch)
```
          Fun for Mentor ↑
                         |       [AND] [3-Letter Badges]
                         |    [MAR]   [ELE]
                         |   ╭──────────────╮
                         |   │    Cluster   │
                         |   ╰──────────────╯
                         +-------------------> Impactful to Mentee
```

---

## ✨ Features

- **No Presets Required**: Start fresh by typing or pasting your own custom mentoring activity prompts and participant names.
- **Ultra-Fast Facilitator Entry**:
  - **Direct 2D Click-to-Place**: Tap or click directly on the coordinate plane to drop a participant's vote in 1 second.
  - **Drag & Drop**: Reposition dots smoothly in real-time.
  - **Precise Sliders**: Adjust Good/Useful and Fun ratings with 0.5-step numeric range sliders.
- **Participant Letter Badges**: Each participant is identified by their first letter (e.g. `A` for Andrei, `E` for Elena) in their own consistent vibrant color across every graph.
- **Cluster Enclosing Shape**: Generates a smooth, rounded convex hull bubble around all group answers for each prompt, visually demonstrating team consensus vs dispersion.
- **Overview Grid (Reproducing the Workshop Sketch)**: View all activity prompts side-by-side in a responsive grid. Click any card to edit ratings.
- **Presentation Mode**: Fullscreen clean view optimized for projector displays with headers hidden.
- **Persistent Storage**: Auto-saves locally in browser `localStorage`.
- **JSON Backup / Restore**: Export and import session data for safe archiving or sharing.
- **Print / PDF Ready**: Clean print stylesheet for workshop summary hand-outs.

---

## 📁 Code Structure (Human-Readable & Modular)

The project is intentionally written in clean, modern, zero-dependency ES6:

```text
├── index.html          # Clean semantic layout (Setup, Interactive Rating, All-Graphs Grid)
├── css/
│   └── styles.css      # Custom design system, responsive grid & presentation mode styles
├── js/
│   ├── geometry.js     # Andrew's Monotone Chain 2D convex hull & rounded bubble spline math
│   ├── graph.js        # Pure SVG graph generator (axes, arrows, letter badges, tooltips)
│   ├── state.js        # Centralized state management & localStorage synchronization
│   └── app.js          # Controller connecting UI interactions, SVG events, and navigation
└── README.md
```

---

## 🚀 How to Run Locally

Because the application is built with standard web standards and zero compilation dependencies, you can run it immediately:

```bash
# Option 1: Python's built-in HTTP server
python3 -m http.server 3000

# Option 2: Node npx serve
npx serve .
```

Open `http://localhost:3000` in your web browser.

---

## 🌐 Deployment Options

### 1. GitHub Pages (Recommended)
1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** → **Pages**.
3. Under **Branch**, select `main` and root `/` folder, then click **Save**.
4. Your app is live within seconds at `https://<username>.github.io/<repo-name>/`.

### 2. Vercel / Netlify
- Connect your GitHub repository to Vercel or Netlify.
- Deploy with default settings (zero configuration required).


## Live rooms: limits and troubleshooting

The current static site uses ntfy.sh as a public message relay. The facilitator's
browser owns the room state and must stay open during voting. Refreshing the
same facilitator tab restores its room connection, participants, ratings, and
current activity. The connection metadata is saved in sessionStorage and ratings
in localStorage; closing the tab or clearing browser storage is not a supported
room recovery path. Locally saved graphs are not a persistent online room.

The most likely causes of room failures are:

- Shared service limits: ntfy documents 30 simultaneous subscriptions per visitor
  (IP address) and 250 messages per day on ntfy.sh. Phones on workshop Wi-Fi can
  share these limits. Recreating a room does not reset the IP's quota.
- Full state size: prompts, participants, and all ratings are broadcast together.
  Snapshots now use a compact wire format that indexes ratings by participant and
  prompt instead of repeating IDs and field names. A regression fixture with 15
  participants and six fully rated activities fits under 4,096 bytes. Larger
  updates are rejected explicitly because ntfy would convert them into attachments.
- Interrupted delivery: a successful publish only means the relay accepted the
  message. The app now marks a vote received only when the facilitator sends it
  back in a state update. Unconfirmed votes can be sent again.

Reconnection belongs to the native `EventSource`; there is no second reconnect
loop. Participant joins wait until the subscription is open and retry until the
facilitator acknowledges them. Joins and navigation are combined over 200 ms;
vote acknowledgments share a snapshot over two seconds. Snapshots are sent
sequentially to reduce bursts and prevent overlapping snapshot requests.

Errors appear above every screen. Inspect the browser Network panel for the
`ntfy.sh/.../sse` response: HTTP 429 suggests a service limit, while a pending or
failed connection without a status can indicate network filtering or an outage.
A live probe during the October 30 investigation timed out without an HTTP
response; it did not establish a particular server error.

For the intended one-day workshop with 10–15 participants, keep GitHub Pages
and this relay rather than adding a hosted backend. Use one facilitator tab and
one tab per participant. With six activities and one submission per activity,
15 participants produce 90 vote messages. A conservative unbatched estimate
including joins, host replies, navigation, and room creation is about 217
published messages, below the documented 250-message daily limit. Batching
usually lowers this, but retries, updates, prior testing, and other users on
the same public IP consume the same allowance. Bursts also have request limits;
this is not a guarantee of service availability. Leave time between activities.

Before the workshop, test a phone on the actual venue network. The host should
stay awake with the page open. GitHub Pages only serves the files: live voting
still needs access to ntfy.sh. If that service is blocked or already rate
limited on the venue network, changing the room code will not fix it.

Service reference: [ntfy publishing limits](https://docs.ntfy.sh/publish/#limitations)
and [subscription API](https://docs.ntfy.sh/subscribe/api/).

Run room regression checks with Node.js:

```bash
node --test tests/room.test.mjs
```

These use a simulated transport; they do not assert live service availability.
