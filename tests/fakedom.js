'use strict';
/* Minimal DOM + LuCI E() used only by the offline tests. */

class Node {
	constructor(tag) {
		this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {}; this.parentNode = null;
		this._text = ''; this._html = ''; this.style = {}; this.listeners = {}; this.value = ''; this.type = '';
		const self = this;
		this.classList = {
			_a() { return (self.attrs['class'] || '').split(/\s+/).filter(Boolean); },
			_s(a) { self.attrs['class'] = a.join(' '); },
			add(c) { const a = this._a(); if (!a.includes(c)) a.push(c); this._s(a); },
			remove(c) { this._s(this._a().filter(x => x !== c)); },
			contains(c) { return this._a().includes(c); },
			toggle(c, force) { const has = this.contains(c), want = force === undefined ? !has : !!force; if (want) this.add(c); else this.remove(c); return want; }
		};
	}
	get className() { return this.attrs['class'] || ''; }
	set className(v) { this.attrs['class'] = v; }
	get nodeType() { return this.tagName === '#TEXT' ? 3 : 1; }
	setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); if (k === 'type') this.type = String(v); }
	getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
	removeAttribute(k) { delete this.attrs[k]; }
	appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.children.push(n); return n; }
	insertBefore(n, ref) { if (!ref) return this.appendChild(n); if (n.parentNode) n.parentNode.removeChild(n); const i = this.children.indexOf(ref); n.parentNode = this; this.children.splice(i < 0 ? this.children.length : i, 0, n); return n; }
	removeChild(n) { const i = this.children.indexOf(n); if (i > -1) this.children.splice(i, 1); n.parentNode = null; return n; }
	set textContent(v) { this.children.forEach(c => c.parentNode = null); this.children = []; this._text = String(v); }
	get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
	set innerHTML(v) { this.children = []; this._html = String(v); }
	get innerHTML() { return this._html; }
	addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
	fire(t, ev) { (this.listeners[t] || []).forEach(f => f(Object.assign({ target: this, key: '' }, ev || {}))); }
	scrollIntoView() {}
	closest(sel) { for (let n = this; n; n = n.parentNode) if (matchSimple(n, sel)) return n; return null; }
	querySelector(sel) { return querySelectorAll(this, sel)[0] || null; }
	querySelectorAll(sel) { return querySelectorAll(this, sel); }
	walk(fn) { fn(this); this.children.forEach(c => c.walk(fn)); }
}

function textNode(s) { const n = new Node('#text'); n._text = String(s); return n; }

function matchSimple(n, sel) {
	if (n.tagName === '#TEXT') return false;
	const m = sel.match(/^([a-zA-Z0-9]*)((?:[.#][\w-]+)*)$/);
	if (!m) throw new Error('unsupported selector ' + sel);
	if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
	for (const part of m[2].match(/[.#][\w-]+/g) || []) {
		if (part[0] === '.' && !n.classList.contains(part.slice(1))) return false;
		if (part[0] === '#' && n.attrs.id !== part.slice(1)) return false;
	}
	return true;
}
function matchChain(n, tokens, root) {
	/* tokens like ['a', '>', 'b'] evaluated right to left */
	let i = tokens.length - 1;
	if (!matchSimple(n, tokens[i])) return false;
	let cur = n; i--;
	while (i >= 0) {
		const comb = tokens[i]; let sel;
		if (comb === '>') { sel = tokens[i - 1]; cur = cur.parentNode; if (!cur || !matchSimple(cur, sel)) return false; i -= 2; }
		else { sel = tokens[i]; let p = cur.parentNode, ok = false; while (p && p !== root.parentNode) { if (matchSimple(p, sel)) { ok = true; cur = p; break; } p = p.parentNode; } if (!ok) return false; i--; }
	}
	return true;
}
function querySelectorAll(root, sel) {
	const tokens = sel.trim().split(/\s+/).flatMap(t => t.includes('>') && t !== '>' ? t.split(/(>)/).filter(Boolean) : [ t ]);
	const out = [];
	root.children.forEach(c => c.walk(n => { if (n.tagName !== '#TEXT' && matchChain(n, tokens, root)) out.push(n); }));
	return out;
}

function E(tag, attrs, children) {
	if (attrs != null && (typeof attrs === 'string' || attrs instanceof Node || Array.isArray(attrs))) { children = attrs; attrs = {}; }
	const n = new Node(tag);
	Object.keys(attrs || {}).forEach(k => {
		const v = attrs[k];
		if (v == null) return;
		if (typeof v === 'function') n.addEventListener(k, v);
		else n.setAttribute(k, v);
	});
	const add = c => {
		if (c == null) return;
		if (Array.isArray(c)) c.forEach(add);
		else if (c instanceof Node) n.appendChild(c);
		else n.appendChild(textNode(c));
	};
	add(children);
	return n;
}

function createDocument(lang) {
	const html = new Node('html'); html.attrs.lang = lang || 'en';
	const body = new Node('body'); html.appendChild(body);
	const doc = {
		documentElement: html, body,
		createElement: t => new Node(t),
		querySelector: s => body.querySelector(s),
		querySelectorAll: s => body.querySelectorAll(s),
		addEventListener() {}
	};
	return doc;
}

function findAll(root, pred) { const out = []; root.walk(n => { if (pred(n)) out.push(n); }); return out; }
function byText(root, tag, text) { return findAll(root, n => n.tagName === tag.toUpperCase() && n.textContent.trim() === text)[0]; }

module.exports = { Node, E, createDocument, findAll, byText, textNode };
