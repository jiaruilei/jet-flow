# Jet on a Vane · CE2134

An interactive conservation-of-momentum lab for a water jet deflected by a stationary vane. The interface follows the white-and-blue CE2134 design used in the Flowlines and hydrostatics labs.

## Learning activities

- **Explore:** vary jet speed, diameter, and deflection angle; compare horizontal, vertical, and resultant forces with a live calculation trail.
- **Quiz:** solve ten cases using the displayed givens. Force magnitudes and worked solutions are revealed after checking an answer. Switching modes preserves each setup.
- **Coach:** use local hints and explanations, or enable the existing ChatGPT proxy in Coach settings.

The diagram distinguishes blue velocity arrows from orange forces on the vane. Animation can be paused and respects the device's reduced-motion preference.

## Run locally

The frontend is static and requires no build. With Python 3 installed, run from this folder:

```sh
python -m http.server 4175 --bind 127.0.0.1
```

Open http://127.0.0.1:4175. Any static web server can also serve this folder. Keep `index.html`, `styles.css`, and `app.js` together when deploying to GitHub Pages.

The optional existing API proxy runs separately with `npm install` and `npm start`; set `OPENAI_API_KEY` in the server environment. The frontend's Coach settings retain the existing Render endpoint. Local coaching and the experiment work without an API key. MathJax is loaded from a CDN for optional coach equation rendering.

## Physical model

Water density is 1000 kg/m³. Flow is steady; inlet and outlet speed are equal; jet pressure is atmospheric; gravity and losses are neglected. Deflection is downward, with +x rightward and +y upward.

```text
A = πD²/4                    (D in metres)
ṁ = ρVA
Fx on vane = ṁV(1 − cos θ)
Fy on vane = ṁV sin θ
|F| = √(Fx² + Fy²)
```

The force on the fluid is opposite to the force on the vane. Diagram geometry and arrow lengths are schematic; numerical results follow the momentum balance.

## Files

- `index.html`: accessible learning interface and coach controls
- `styles.css`: responsive CE2134 theme
- `app.js`: physics, canvas, quiz, and coach behavior
- `server.js`: existing optional ChatGPT proxy
