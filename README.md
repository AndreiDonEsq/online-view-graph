# Mentoring Activities 2D Matrix (Useful vs Fun)

A fast, interactive web application designed for facilitators running mentoring trainings and workshops. It allows participants to evaluate and discuss different mentoring activities across two key dimensions:
- **X-Axis**: **GOOD / USEFUL** (Scale 1 – 10)
- **Y-Axis**: **FUN** (Scale 1 – 10)

The application produces a clean, presentation-ready overview grid of coordinate graphs—one per activity prompt—with colored letter avatars for each participant and an organic enclosing cluster shape ("bubble") showing group alignment or divergence.

---

## 🎨 Visual Layout (Matches Training Workshop Sketch)
```
          FUN ↑
              |       (A) [Initial badges]
              |    (M)   (E)
              |   ╭──────────╮
              |   │ Cluster  │
              |   ╰──────────╯
              +-------------------> GOOD (USEFUL)
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
