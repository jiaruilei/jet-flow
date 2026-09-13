# Jet on a Vane (Week 6) · CE2134

An interactive conservation-of-momentum lab for a water jet deflected by a stationary vane. The interface follows the white-and-blue CE2134 design used in the Flowlines and hydrostatics labs.

## Learning activities

- **Explore:** vary jet speed, diameter, and deflection angle from 0° to 180°; compare horizontal, vertical, and resultant forces. Expand **Show calculations** for typeset formulas and live numerical substitutions, or **Method & assumptions** for the governing equations.
- **Quiz:** solve three cases using the displayed givens. Force magnitudes and worked solutions are revealed after checking an answer. Switching modes preserves each setup.
- **Coach:** use the embedded chat below the lab for contextual questions, suggested prompts, and typeset equations. GPT-6 Astra replies use the existing proxy, with local guidance available if it cannot connect. Settings are configured in source code and are hidden from the learning interface.

The diagram distinguishes blue velocity arrows from orange forces on the vane. Animation starts playing when the page opens and can be paused with the animation control.

## Run locally

The frontend is static; the committed MathJax browser assets need no build. With Python 3 installed, run from this folder:

```sh
python -m http.server 4175 --bind 127.0.0.1
```

Open http://127.0.0.1:4175. Any static web server can also serve this folder. Deploy the HTML, CSS, JavaScript, and `vendor/` directory together to GitHub Pages.

The API proxy runs separately with `npm install` and `npm start`; set `OPENAI_API_KEY` in the server environment with access to `gpt-6-astra`. The frontend retains the existing Render endpoint in `coach.js`. The proxy fixes the model to `gpt-6-astra` with low reasoning effort and omits unsupported sampling parameters, following the [OpenAI migration guidance](https://developers.openai.com/api/docs/guides/latest-model). Automatic local guidance and the experiment work without an API key.

Deploy `server.js` to the Render service as well as the static frontend to GitHub Pages. `/api/health` reports the configured model and Render commit; successful chat responses also report the model returned by OpenAI.

The Render service's main URL redirects to the lab on GitHub Pages. Its `/api/chat` and `/api/health` routes remain available at the Render address.

MathJax 4.1.3 and its New Computer Modern fonts are installed through the package manager and served locally. Run `pnpm install --frozen-lockfile` followed by `pnpm run prepare:mathjax` to reproduce the committed browser assets. Equation rendering does not require a CDN. See the upstream [MathJax self-hosting guide](https://docs.mathjax.org/en/latest/web/hosting.html).

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
- `app.js`: physics, canvas, and quiz
- `coach.js`: inline coach, conversation history, and local explanations
- `math.js`: local MathJax startup and queued equation rendering
- `scripts/vendor-mathjax.mjs`: copies installed MathJax browser assets for static hosting
- `server.js`: existing optional ChatGPT proxy
