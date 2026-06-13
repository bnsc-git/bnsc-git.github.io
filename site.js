/* ====================================================
   Site — shared JS
==================================================== */

// ---- i18n ----
const SITE_I18N = {
  ja: {
    portfolio: 'ポートフォリオ',
    blog: 'ブログ',
    appLink: '🥦 アプリを使う',
    heroEyebrow: 'WEB Developer',
    heroSub: '使いやすくて楽しいWEBアプリを作っています',
    heroBtnPortfolio: 'ポートフォリオを見る',
    heroBtnBlog: 'ブログを読む',
    featuredTitle: '注目プロジェクト',
    featuredAll: 'すべて見る →',
    featuredDesc: '食材の在庫・賞味期限をスマートに管理するPWAアプリ。食品ロスを防ぎ、毎日の献立をサポートします。在庫を消費するとレーダーチャートで栄養バランスを可視化。',
    featuredBtn: 'アプリを使う →',
    latestBlog: '最新のブログ',
    blogAll: 'すべて見る →',
    blogEmpty: 'まだ記事がありません',
    portfolioHero: 'ポートフォリオ',
    portfolioSub: 'これまでに制作したWEBアプリ・ツールの一覧です',
    portfolioDesc: '食材の在庫・賞味期限をスマートに管理するPWAアプリ。食品ロスを削減し、レシピ提案・栄養バランス可視化機能を搭載。',
    blogHero: 'ブログ',
    blogSub: '開発記録・技術メモ・お知らせを発信しています',
    langOther: 'EN',
  },
  en: {
    portfolio: 'Portfolio',
    blog: 'Blog',
    appLink: '🥦 Use App',
    heroEyebrow: 'WEB Developer',
    heroSub: 'Building fun and easy-to-use web applications',
    heroBtnPortfolio: 'View Portfolio',
    heroBtnBlog: 'Read Blog',
    featuredTitle: 'Featured Project',
    featuredAll: 'View all →',
    featuredDesc: 'A PWA for smart management of food stock and expiry dates. Helps reduce food waste and plan daily meals. Visualizes nutrition balance with a radar chart.',
    featuredBtn: 'Use App →',
    latestBlog: 'Latest Posts',
    blogAll: 'View all →',
    blogEmpty: 'No posts yet',
    portfolioHero: 'Portfolio',
    portfolioSub: 'A list of web apps and tools I have built',
    portfolioDesc: 'A PWA for smart food stock management. Reduces food waste with recipe suggestions and nutrition balance visualization.',
    blogHero: 'Blog',
    blogSub: 'Development notes, tech memos, and announcements',
    langOther: 'JA',
  }
};

let siteLang = localStorage.getItem('site_lang') || 'ja';

function st(key) {
  return (SITE_I18N[siteLang] || SITE_I18N.ja)[key] ?? key;
}

function setSiteLang(lang) {
  siteLang = lang;
  localStorage.setItem('site_lang', lang);
  applySiteI18n();
}

function applySiteI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = st(el.dataset.i18n);
  });
  document.documentElement.lang = siteLang;
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = st('langOther');
}

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
  applySiteI18n();
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
  const locale = siteLang === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
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
