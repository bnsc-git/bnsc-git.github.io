/* ====================================================
   Site — shared JS
==================================================== */

// ---- Mobile nav toggle ----
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }
  markActiveNav();
});

function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  // btn-nav はアクティブ表示の対象外（独自の背景色スタイルを維持）
  document.querySelectorAll('.nav-links a:not(.btn-nav)').forEach(a => {
    const href = a.getAttribute('href').split('/').pop() || 'index.html';
    if (href === path) a.style.color = 'var(--primary)';
  });
}

// ---- Blog helpers ----
const BLOG_DATA_URL = getRootPath() + 'blog-data.json';

function getRootPath() {
  const depth = location.pathname.replace(/\/[^/]*$/, '').split('/').length - 1;
  if (location.pathname.includes('/posts/')) return '../';
  return '';
}

let _blogCache = null;
async function fetchBlogData() {
  if (_blogCache) return _blogCache;
  try {
    const res = await fetch(BLOG_DATA_URL);
    _blogCache = await res.json();
    return _blogCache;
  } catch {
    return [];
  }
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ---- Index: blog preview (latest 3) ----
async function loadBlogPreview() {
  const el = document.getElementById('blog-preview');
  if (!el) return;
  const posts = await fetchBlogData();
  const latest = posts.slice(0, 3);
  if (!latest.length) {
    el.innerHTML = '<p class="empty-state">まだ記事がありません</p>';
    return;
  }
  el.innerHTML = latest.map(p => `
    <a class="post-card" href="posts/${escHtml(p.slug)}.html">
      <div class="post-card-date">${escHtml(formatDate(p.date))}</div>
      <h3>${escHtml(p.title)}</h3>
      <p>${escHtml(p.summary)}</p>
      <div class="post-card-tags">
        ${(p.tags || []).map(t => `<span class="post-tag">${escHtml(t)}</span>`).join('')}
      </div>
    </a>
  `).join('');
}

// ---- Blog list page ----
async function loadBlogList() {
  const el = document.getElementById('blog-list');
  if (!el) return;
  const posts = await fetchBlogData();
  if (!posts.length) {
    el.innerHTML = '<p class="empty-state">まだ記事がありません</p>';
    return;
  }
  el.innerHTML = `<div class="posts-list">` + posts.map(p => `
    <a class="post-list-item" href="posts/${escHtml(p.slug)}.html">
      <span class="post-list-date">${escHtml(formatDate(p.date))}</span>
      <div class="post-list-body">
        <h3>${escHtml(p.title)}</h3>
        <p>${escHtml(p.summary)}</p>
      </div>
    </a>
  `).join('') + `</div>`;
}
