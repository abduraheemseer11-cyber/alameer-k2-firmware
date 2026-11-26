/* AlMakhdhi SoftWare — LuCI navigation shell (OpenWrt 24.10 Bootstrap)
 * Moves the top-level menu (Status / System / Network / Log out) that LuCI
 * renders into #modemenu, plus all sub-pages, into a slide-out sidebar. */
(()=>{
  'use strict';
  const T=s=>(typeof _==='function'?_(s):s);
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
  const url=(...p)=>(window.L&&L.url)?L.url.apply(L,p):'/cgi-bin/luci/'+p.join('/');
  const dpath=()=>((window.L&&L.env&&L.env.dispatchpath)||[]);

  const isLeaf=n=>{const t=n&&n.action&&n.action.type;return !!t&&t!=='firstchild'};

  function renderLevel(ui,node,path,depth){
    const ul=el('ul','am-list am-l'+depth);
    const kids=ui.menu.getChildren(node);
    kids.forEach(k=>{
      const p=path.concat(k.name);
      const sub=(!isLeaf(k)&&depth<3)?ui.menu.getChildren(k):[];
      const li=el('li','am-item');
      const active=dpath().slice(0,p.length).join('/')===p.join('/');
      if(sub.length){
        li.classList.add('am-group');
        const b=el('button','am-gbtn',T(k.title));b.type='button';
        b.setAttribute('aria-expanded',active?'true':'false');
        const car=el('span','am-caret','▾');b.appendChild(car);
        b.addEventListener('click',()=>{const o=li.classList.toggle('am-open');b.setAttribute('aria-expanded',o?'true':'false')});
        li.appendChild(b);
        li.appendChild(renderLevel(ui,k,p,depth+1));
        if(active)li.classList.add('am-open','am-active');
      }else{
        const a=el('a','am-link',T(k.title));a.href=url.apply(null,p);
        if(active)li.classList.add('am-active');
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function findTop(tree){
    if(!tree||!tree.children)return null;
    if(tree.children.admin)return {node:tree.children.admin,path:['admin']};
    return {node:tree,path:[]};
  }

  function fromDom(nav,stock){
    /* Fallback: reuse links LuCI already rendered in the stock menus. */
    const ul=el('ul','am-list am-l1');
    stock.forEach(root=>root.querySelectorAll('a[href]').forEach(a=>{
      if(a.getAttribute('href')==='#')return;
      const li=el('li','am-item'),l=el('a','am-link',a.textContent.trim());l.href=a.href;li.appendChild(l);ul.appendChild(li);
    }));
    nav.appendChild(ul);
  }

  const start=()=>{
    if(document.getElementById('alameer-shell'))return;
    
    // [FIX] منع السكربت من العمل في صفحة تسجيل الدخول
    if (!document.getElementById('mainmenu') && !document.getElementById('modemenu')) return;

    const shell=el('div');shell.id='alameer-shell';
    const bar=el('header','alameer-topbar');
    const toggle=el('button','alameer-toggle');toggle.type='button';
    toggle.setAttribute('aria-label','فتح القائمة الجانبية');toggle.setAttribute('aria-expanded','false');
    for(let i=0;i<3;i++)toggle.appendChild(document.createElement('span'));
    const brand=el('div','alameer-brand');
    const logo=el('img');logo.src='/luci-static/resources/logo.png';logo.alt='Alameer Software';logo.width=42;logo.height=42;
    brand.append(logo,el('strong',null,'AlMakhdhi SoftWare'));
    bar.append(toggle,brand);

    /* Keep LuCI's "unsaved changes / apply" indicator visible. */
    const ind=document.getElementById('indicators');
    if(ind){ind.classList.add('am-indicators');bar.appendChild(ind)}

    const shade=el('button','alameer-shade');shade.type='button';shade.setAttribute('aria-label','إغلاق القائمة');
    const drawer=el('aside','alameer-drawer');drawer.id='alameer-drawer';drawer.setAttribute('aria-label','قائمة إعدادات الراوتر');
    const head=el('div','alameer-drawer-head');
    const close=el('button','alameer-close','×');close.type='button';close.setAttribute('aria-label','إغلاق القائمة');
    head.append(el('strong',null,'لوحة التحكم'),close);
    const nav=el('nav','alameer-nav');nav.setAttribute('aria-label','OpenWrt');
    const loading=el('p','alameer-menu-note','...');nav.appendChild(loading);
    drawer.append(head,nav);shell.append(bar,shade,drawer);
    document.body.insertBefore(shell,document.body.firstChild);
    document.body.classList.add('alameer-ui');

    const stock=Array.from(document.querySelectorAll('#modemenu,#mainmenu'));

    const fill=()=>{
      const fb=()=>{nav.textContent='';
        if(stock.some(s=>s.querySelector('a')))fromDom(nav,stock);
        else nav.appendChild(el('p','alameer-menu-note','تعذر تحميل القائمة. أعد تحميل الصفحة.'))};
      if(!(window.L&&L.require)){fb();return}
      L.require('ui').then(ui=>ui.menu.load().then(tree=>{
        const top=findTop(tree);
        if(!top||!top.node){fb();return}
        const ul=renderLevel(ui,top.node,top.path,1);
        if(!ul.children.length){fb();return}
        nav.textContent='';nav.appendChild(ul);
      })).catch(fb);
    };
    fill();

    const setOpen=o=>{document.body.classList.toggle('alameer-drawer-open',o);
      toggle.setAttribute('aria-expanded',o?'true':'false');
      drawer.setAttribute('aria-hidden',o?'false':'true');shade.setAttribute('aria-hidden',o?'false':'true')};
    toggle.addEventListener('click',()=>setOpen(!document.body.classList.contains('alameer-drawer-open')));
    close.addEventListener('click',()=>setOpen(false));shade.addEventListener('click',()=>setOpen(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
