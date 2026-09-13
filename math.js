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
  window.renderMath = element => {
    queue = queue.then(async () => {
      if (!(await ready) || !element?.isConnected || !MathJax.typesetPromise) return;
      MathJax.typesetClear?.([element]);
      await MathJax.typesetPromise([element]);
    }).catch(error => console.warn('Equation rendering unavailable:', error));
    return queue;
  };
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
