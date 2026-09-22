'use strict';

// Full-text search across all pages of a school year.
// Implementation: a small in-memory inverted index rebuilt from the markdown
// files whenever content changes (content store calls invalidate()). For
// handbook-sized corpora the rebuild takes milliseconds, so this stays simple
// and dependency-free.

const content = require('./content');

let index = { yearId: null, docs: [] };

// Rebuild lazily whenever any content write happens.
content.onContentChanged(() => invalidate());

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildIndex(yearId) {
  const docs = [];
  for (const [handbookId, handbook] of Object.entries(content.HANDBOOKS)) {
    for (const page of content.listPages(yearId, handbookId)) {
      docs.push({
        pageId: page.id,
        slug: page.slug,
        title: page.title,
        handbookId,
        handbookName: handbook.name,
        handbookEmoji: handbook.emoji,
        text: `${page.title}\n${page.body}`,
      });
    }
  }

  const postings = new Map(); // token -> Set<docIndex>
  docs.forEach((doc, i) => {
    for (const token of tokenize(doc.text)) {
      if (!postings.has(token)) postings.set(token, new Set());
      postings.get(token).add(i);
    }
  });

  return { yearId, docs, postings };
}

function ensureIndex(yearId) {
  if (index.yearId !== yearId) index = buildIndex(yearId);
  return index;
}

function invalidate() {
  index = { yearId: null, docs: [] };
}

// Strip markdown syntax so excerpts read like prose, not source.
function plainText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>|]/g, ' ')
    .replace(/\s+/g, ' ');
}

function makeExcerpt(doc, queryTokens) {
  const flat = plainText(doc.text);
  for (const token of queryTokens) {
    const pos = flat.toLowerCase().indexOf(token);
    if (pos !== -1) {
      const start = Math.max(0, pos - 70);
      const end = Math.min(flat.length, pos + token.length + 110);
      return (start > 0 ? '…' : '') + flat.slice(start, end).trim() + (end < flat.length ? '…' : '');
    }
  }
  return flat.slice(0, 140) + (flat.length > 140 ? '…' : '');
}

// Returns results ordered by simple term-frequency relevance.
function searchYear(yearId, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const idx = ensureIndex(yearId);

  const scores = new Map();
  for (const token of tokens) {
    const exact = idx.postings.get(token);
    if (exact) {
      for (const docIdx of exact) scores.set(docIdx, (scores.get(docIdx) || 0) + 2);
    }
    // Prefix match so "attend" finds "attendance".
    for (const [key, set] of idx.postings) {
      if (key.startsWith(token) && key !== token) {
        for (const docIdx of set) scores.set(docIdx, (scores.get(docIdx) || 0) + 1);
      }
    }
  }

  // Title hits count extra — searching "attendance" should surface the
  // Attendance Policy page above pages that merely mention it.
  for (const [docIdx, score] of scores) {
    const titleTokens = new Set(tokenize(idx.docs[docIdx].title));
    if (tokens.some((t) => titleTokens.has(t) || [...titleTokens].some((tt) => tt.startsWith(t)))) {
      scores.set(docIdx, score + 3);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || idx.docs[a[0]].title.localeCompare(idx.docs[b[0]].title))
    .map(([docIdx, score]) => {
      const doc = idx.docs[docIdx];
      return {
        slug: doc.slug,
        title: doc.title,
        handbookId: doc.handbookId,
        handbookName: doc.handbookName,
        handbookEmoji: doc.handbookEmoji,
        excerpt: makeExcerpt(doc, tokens),
        score,
      };
    });
}

module.exports = { searchYear, invalidate };
