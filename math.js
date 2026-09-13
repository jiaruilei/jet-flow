/* Locally hosted MathJax; equation loading never blocks the experiment. */
(() => {
  const root = new URL('vendor/mathjax/', document.baseURI).href;
  const fonts = `${root}fonts/mathjax-newcm-font`;
  let resolveReady;
  let settled = false;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const settle = available => { if (!settled) { settled = true; resolveReady(available); } };
  window.mathJaxReady = ready;
  window.MathJax = {
    loader: { load: ['ui/safe'], paths: { mathjax: root.replace(/\/$/, ''), fonts: `${root}fonts`, 'mathjax-newcm': fonts, sre: `${root}sre`, mathmaps: `${root}sre/mathmaps` } },
    tex: { inlineMath: [['\\(', '\\)'], ['$', '$']], displayMath: [['\\[', '\\]'], ['$$', '$$']], processEscapes: true },
    output: { font: 'mathjax-newcm', fontPath: `${root}fonts/%%FONT%%-font` },
    chtml: { fontURL: `${fonts}/chtml/woff2`, dynamicPrefix: `${fonts}/chtml/dynamic`, displayAlign: 'left', displayIndent: '0' },
    startup: {
      typeset: false,
      pageReady() {
        return MathJax.startup.defaultPageReady().then(() => { settle(true); });
      }
    }
  };
  let queue = Promise.resolve();
  const jobs = new WeakMap();
  function enqueue(element, job) {
    if (job.queued) return;
    job.queued = true;
    queue = queue.then(async () => {
      const available = await ready;
      job.queued = false;
      clearTimeout(job.timer);
      job.timer = null;
      const request = job.latest;
      try {
        if (!element.isConnected || (request.when && !request.when())) return;
        // Clear the old MathJax registry before replacing any rendered nodes.
        // All mutations share this queue with typesetting, including coach math.
        if (request.update !== undefined || job.markup !== element.innerHTML) {
          if (available) MathJax.typesetClear?.([element]);
          if (typeof request.update === 'function') request.update(element);
          else if (typeof request.update === 'string') element.textContent = request.update;
          if (available && MathJax.typesetPromise) await MathJax.typesetPromise([element]);
          job.markup = element.innerHTML;
        }
      } catch (error) {
        console.warn('Equation rendering unavailable:', error);
      } finally {
        if (job.latest === request) {
          job.resolvers.splice(0).forEach(resolve => resolve());
        } else if (!job.timer && !job.queued) {
          enqueue(element, job);
        }
      }
    });
  }
  function scheduleMath(element, update, { delay = 0, when } = {}) {
    if (!element) return Promise.resolve();
    let job = jobs.get(element);
    if (!job) {
      job = { latest: null, queued: false, timer: null, markup: null, resolvers: [] };
      jobs.set(element, job);
    }
    job.latest = { update, when };
    clearTimeout(job.timer);
    job.timer = null;
    const completion = new Promise(resolve => job.resolvers.push(resolve));
    if (delay > 0) {
      job.timer = setTimeout(() => { job.timer = null; enqueue(element, job); }, delay);
    } else {
      enqueue(element, job);
    }
    return completion;
  }
  window.renderMath = element => scheduleMath(element);
  // Debounced updates retain only the latest writer for an element. The optional
  // guard is checked just before mutation so hidden or replaced quiz states stay safe.
  window.updateMath = (element, update, options) => scheduleMath(element, update, options);
  const script = document.createElement('script');
  script.id = 'MathJax-script';
  script.async = true;
  script.src = `${root}tex-chtml.js`;
  script.onerror = () => settle(false);
  // Leave formulas as readable text if optional rendering cannot initialise.
  const timeout = setTimeout(() => settle(false), 15000);
  ready.then(() => clearTimeout(timeout));
  document.head.appendChild(script);
})();
