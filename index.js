const fs = require('fs');
const path = require('path');
const util = require('util');
const syzojRenderer = require('syzoj-renderer');
const hexoUtil = require('hexo-util');
const objectDeepAssign = require('object-deep-assign');
const JSDOM = require('jsdom').JSDOM;

// The cache passed to syzoj-renderer.
const cache = {
  data: {},
  cachePath: '',
  loaded: false,
  load(configCacheFile) {
    this.cachePath = path.resolve(hexo.base_dir, configCacheFile);
    try {
      this.data = JSON.parse(fs.readFileSync(this.cachePath).toString());
    } catch (e) {}

    if (typeof this.data !== 'object') this.data = {};
  },
  save() {
    if (!this.loaded) return;

    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.data));
    } catch (e) {
      console.error(`hexo-renderer-syzoj-renderer: Failed to save cache to ${util.inspect(this.cachePath)}: ${e.toString()}`);
    }
  },
  set(key, value) {
    this.data[key] = value;
  },
  get(key) {
    return this.data[key];
  }
};

// Save cache to file on exit.
process.on('exit', () => cache.save());

async function render(data, options) {
  // Retrieve config from Hexo.
  const config = objectDeepAssign({
    cache_file: 'cache.json',
    highlighter: 'prism'
  }, this.config.syzoj_renderer);

  // Load cache from file if not loaded.
  if (!cache.loaded) {
    cache.load(config.cache_file);
    cache.loaded = true;
  }

  let syzojRendererOptions = objectDeepAssign({
    highlight: {}
  }, config.options);
  if (config.highlighter === 'hexo') {
    // Use Hexo's highlighter instead of prism'.
    syzojRendererOptions.highlight.highlighter = (code, language) => hexoUtil.highlight(code, objectDeepAssign({}, options, {
      lang: language
    }));
  }

  const result = await syzojRenderer.markdown(data.text, cache, html => {
    // Add anchors to headings for Hexo.
    const document = new JSDOM().window.document,
          body = document.body;
    body.innerHTML = html;

    const headingId = {},
          headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (let heading of headings) {
      // Skip if it may be not generated by markdown.
      if (heading.hasAttribute('id')) continue;

      // Skip if it has any child element.
      if (heading.childElementCount) continue;

      const text = heading.textContent.trim();

      let id = hexoUtil.slugize(text);

      // Add a number after id if repeated.
      if (headingId[id]) {
        id += '-' + headingId[id]++;
      } else {
        headingId[id] = 1;
      }

      heading.id = id;

      const anchor = document.createElement('a');
      anchor.href = '#' + id;
      anchor.className = 'headerlink';
      anchor.title = text;

      heading.prepend(anchor);
    }

    return body.innerHTML;
  }, syzojRendererOptions);

  return result;
}

if (hexo.config.highlight) hexo.config.highlight.enable = false;
render.disableNunjucks = true;

hexo.extend.renderer.register('md', 'html', render);
hexo.extend.renderer.register('markdown', 'html', render);
hexo.extend.renderer.register('mkd', 'html', render);
hexo.extend.renderer.register('mkdn', 'html', render);
hexo.extend.renderer.register('mdwn', 'html', render);
hexo.extend.renderer.register('mdtxt', 'html', render);
hexo.extend.renderer.register('mdtext', 'html', render);
