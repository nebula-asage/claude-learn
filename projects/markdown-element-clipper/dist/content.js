"use strict";(()=>{var Me=Object.create;var U=Object.defineProperty;var Oe=Object.getOwnPropertyDescriptor;var De=Object.getOwnPropertyNames;var Be=Object.getPrototypeOf,Pe=Object.prototype.hasOwnProperty;var _e=(e,t)=>()=>{try{return t||e((t={exports:{}}).exports,t),t.exports}catch(n){throw t=0,n}};var He=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of De(t))!Pe.call(e,i)&&i!==n&&U(e,i,{get:()=>t[i],enumerable:!(r=Oe(t,i))||r.enumerable});return e};var Ie=(e,t,n)=>(n=e!=null?Me(Be(e)):{},He(t||!e||!e.__esModule?U(n,"default",{value:e,enumerable:!0}):n,e));var Ce=_e(b=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0});var le=/highlight-(?:text|source)-([a-z0-9]+)/;function fe(e){e.addRule("highlightedCodeBlock",{filter:function(t){var n=t.firstChild;return t.nodeName==="DIV"&&le.test(t.className)&&n&&n.nodeName==="PRE"},replacement:function(t,n,r){var i=n.className||"",o=(i.match(le)||[null,""])[1];return`

`+r.fence+o+`
`+n.firstChild.textContent+`
`+r.fence+`

`}})}function de(e){e.addRule("strikethrough",{filter:["del","s","strike"],replacement:function(t){return"~~"+t+"~~"}})}var mt=Array.prototype.indexOf,pt=Array.prototype.every,g={},ht={left:":---",right:"---:",center:":---:"},H=null,me=null,se=new WeakMap;function gt(e){return e?(e.getAttribute("align")||e.style.textAlign||"").toLowerCase():""}function pe(e){return e?ht[e]:"---"}function he(e,t){for(var n={left:0,right:0,center:0,"":0},r="",i=0;i<e.rows.length;++i){var o=e.rows[i];if(t<o.childNodes.length){var a=gt(o.childNodes[t]);++n[a],n[a]>n[r]&&(r=a)}}return r}g.tableCell={filter:["th","td"],replacement:function(e,t){return $(ye(t))?e:ge(e,t)}};g.tableRow={filter:"tr",replacement:function(e,t){let n=ye(t);if($(n))return e;var r="";if(vt(t)){let a=Ee(n);for(var i=0;i<a;i++){let s=i<t.childNodes.length?t.childNodes[i]:null;var o=pe(he(n,i));r+=ge(o,s,i)}}return`
`+e+(r?`
`+r:"")}};g.table={filter:function(e,t){return e.nodeName==="TABLE"},replacement:function(e,t){if(be(t,me)){let s=t.outerHTML,l=Nt(t);return l===null||!l.classList.contains("joplin-table-wrapper")?`

<div class="joplin-table-wrapper">${s}</div>

`:s}else{if($(t))return e;e=e.replace(/\n+/g,`
`);var n=e.trim().split(`
`);n.length>=2&&(n=n[1]);var r=/\| :?---/.test(n),i=Ee(t),o="";if(i&&!r){o="|"+"     |".repeat(i)+`
|`;for(var a=0;a<i;++a)o+=" "+pe(he(t,a))+" |"}let s=t.querySelector?t.querySelector("caption"):t.caption,l=s&&s.textContent||"",f=l?`${l}

`:"",p=`${o}${e}`.trimStart();return`

${f}${p}

`}}};g.tableCaption={filter:["caption"],replacement:()=>""};g.tableColgroup={filter:["colgroup","col"],replacement:()=>""};g.tableSection={filter:["thead","tbody","tfoot"],replacement:function(e){return e}};function vt(e){var t=e.parentNode;return t.nodeName==="THEAD"||t.firstChild===e&&(t.nodeName==="TABLE"||bt(t))&&pt.call(e.childNodes,function(n){return n.nodeName==="TH"})}function bt(e){var t=e.previousSibling;return e.nodeName==="TBODY"&&(!t||t.nodeName==="THEAD"&&/^\s*$/i.test(t.textContent))}function ge(e,t=null,n=null){n===null&&(n=mt.call(t.parentNode.childNodes,t));var r=" ";n===0&&(r="| ");let i=e.trim().replace(/\n\r/g,"<br>").replace(/\n/g,"<br>");for(i=i.replace(/\|+/g,"\\|");i.length<3;)i+=" ";return t&&(i=kt(i,t," ")),r+i+" |"}function ve(e){if(!e.childNodes)return!1;for(let t=0;t<e.childNodes.length;t++){let n=e.childNodes[t];if(n.nodeName==="TABLE"||ve(n))return!0}return!1}var I=(e,t)=>{if(!e.childNodes)return!1;for(let n=0;n<e.childNodes.length;n++){let r=e.childNodes[n];if(t==="code"&&H&&H(r)||t.includes(r.nodeName)||I(r,t))return!0}return!1},yt=["background-color","background","border-color","border","border-top","border-right","border-bottom","border-left","border-style","border-width","padding","padding-top","padding-right","padding-bottom","padding-left","float","margin-left","margin-right"],ce=["bgcolor","bordercolor","background"],Et=e=>{if(!e||!e.getAttribute)return!1;let t=e.getAttribute("style");if(!t)return!1;let n=t.split(";").map(r=>r.split(":")[0].trim().toLowerCase()).filter(r=>r.length>0);for(let r=0;r<n.length;r++)if(yt.includes(n[r]))return!0;return!1},ue=(e,t)=>{if(!e||!e.getAttribute)return!1;let n=e.getAttribute(t);if(n===null)return!1;let r=`${n}`.trim().toLowerCase();return!(!r||r==="0"||r==="0px")},Tt=e=>{if(!e||!e.getAttribute)return!1;for(let t=0;t<ce.length;t++){let n=e.getAttribute(ce[t]);if(n!==null&&`${n}`.trim()!=="")return!0}return!!(e.nodeName==="TABLE"&&(ue(e,"cellpadding")||ue(e,"cellspacing")))},_=e=>Et(e)||Tt(e),At=e=>{if(_(e))return!0;let t=e.rows;if(!t)return!1;for(let n=0;n<t.length;n++){let r=t[n];if(_(r))return!0;for(let i=0;i<r.childNodes.length;i++){let o=r.childNodes[i];if((o.nodeName==="TD"||o.nodeName==="TH")&&_(o))return!0}}return!1},be=(e,t)=>{let n=["UL","OL","H1","H2","H3","H4","H5","H6","HR","BLOCKQUOTE"];return t.preserveNestedTables&&n.push("TABLE"),I(e,"code")||I(e,n)||t.preserveTableStyles&&At(e)};function $(e){let t=se.get(e);if(t!==void 0)return t;let n=Ct(e);return se.set(e,n),n}function Ct(e){return!!(!e||!e.rows||e.rows.length===1&&e.rows[0].childNodes.length<=1||ve(e))}function Nt(e){let t=e.parentNode;for(;t.nodeName!=="DIV";)if(t=t.parentNode,!t)return null;return t}function ye(e){let t=e.parentNode;for(;t.nodeName!=="TABLE";)if(t=t.parentNode,!t)return null;return t}function kt(e,t,n){let r=t.getAttribute("colspan")||1;for(let i=1;i<r;i++)e+=" | "+n.repeat(3);return e}function Ee(e){let t=0;for(let n=0;n<e.rows.length;n++){let i=e.rows[n].childNodes.length;i>t&&(t=i)}return t}function Te(e){H=e.isCodeBlock,me=e.options,e.keep(function(n){return!!(n.nodeName==="TABLE"&&be(n,e.options))});for(var t in g)e.addRule(t,g[t])}function Ae(e){e.addRule("taskListItems",{filter:function(t){let n=t.parentNode,r=n.parentNode,i=!!r&&r.nodeName==="LI";return(t.type==="checkbox"||t.getAttribute("role")==="checkbox")&&(n.nodeName==="LI"||n.nodeName==="LABEL"&&i||n.nodeName==="SPAN"&&i)},replacement:function(t,n){return((n.nodeName==="INPUT"?n.checked:n.getAttribute("aria-checked")==="true")?"[x]":"[ ]")+" "}})}function wt(e){e.use([fe,de,Te,Ae])}b.gfm=wt;b.highlightedCodeBlock=fe;b.strikethrough=de;b.tables=Te;b.taskListItems=Ae});var V=["script","style","noscript","template","link","meta","iframe","object","embed","canvas","svg","video","audio","form","button","select","textarea"];var G=[/(?:^|\s)language-([\w-]+)/,/(?:^|\s)lang-([\w-]+)/,/(?:^|\s)highlight-source-([\w-]+)/];var Fe=new Set(V.map(e=>e.toUpperCase()));function W(e){let t=e.cloneNode(!0);Y(e,t),K(t),j(e,t);let n=Ge(e,t),r=document.createElement("div");return r.appendChild(n),r}function j(e,t){let n=Array.from(e.childNodes),r=Array.from(t.childNodes);for(let i=0;i<n.length;i++){let o=n[i],a=r[i];if(!a||o.nodeType!==Node.ELEMENT_NODE)continue;let s=o,l=a;if(Ue(s)){l.remove();continue}if(Ve(s)){l.remove();continue}Y(s,l),K(l),j(s,l)}}function Ue(e){return e.tagName==="INPUT"?e.type!=="checkbox":Fe.has(e.tagName)}function Ve(e){if(e.hasAttribute("hidden")||e.getAttribute("aria-hidden")==="true")return!0;let t=getComputedStyle(e);return t.display==="none"||t.visibility==="hidden"||t.visibility==="collapse"}function Y(e,t){if(e.tagName==="A"){if(e.hasAttribute("href")){let n=e.href;t.setAttribute("href",n)}return}if(e.tagName==="IMG"){let n=e,r=n.currentSrc||n.src;r&&t.setAttribute("src",r),t.removeAttribute("srcset")}}function K(e){if(e.tagName!=="IMG")return;let t=e.getAttribute("src")??"";t.startsWith("data:")&&t.length>512&&e.remove()}function Ge(e,t){let n=t.tagName;if(n==="LI"){let r=e.parentElement,i=r?.tagName==="OL",o=document.createElement(i?"ol":"ul");if(i&&r){let a=Array.prototype.indexOf.call(r.children,e),s=r.hasAttribute("start")?Number(r.getAttribute("start")):1;o.setAttribute("start",String(s+a))}return o.appendChild(t),o}if(n==="TR"){let r=document.createElement("table"),i=document.createElement("tbody");return i.appendChild(t),r.appendChild(i),r}if(n==="TD"||n==="TH"){let r=document.createElement("table"),i=document.createElement("tbody"),o=document.createElement("tr");return o.appendChild(t),i.appendChild(o),r.appendChild(i),r}if(n==="THEAD"||n==="TBODY"||n==="TFOOT"){let r=document.createElement("table");return r.appendChild(t),r}return t}function We(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}function L(e,t){return Array(t+1).join(e)}function z(e){return e.replace(/^\n*/,"")}function Q(e){for(var t=e.length;t>0&&e[t-1]===`
`;)t--;return e.substring(0,t)}function J(e){return Q(z(e))}var je=["ADDRESS","ARTICLE","ASIDE","AUDIO","BLOCKQUOTE","BODY","CANVAS","CENTER","DD","DIR","DIV","DL","DT","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","FRAMESET","H1","H2","H3","H4","H5","H6","HEADER","HGROUP","HR","HTML","ISINDEX","LI","MAIN","MENU","NAV","NOFRAMES","NOSCRIPT","OL","OUTPUT","P","PRE","SECTION","TABLE","TBODY","TD","TFOOT","TH","THEAD","TR","UL"];function M(e){return O(e,je)}var Z=["AREA","BASE","BR","COL","COMMAND","EMBED","HR","IMG","INPUT","KEYGEN","LINK","META","PARAM","SOURCE","TRACK","WBR"];function ee(e){return O(e,Z)}function Ye(e){return ne(e,Z)}var te=["A","TABLE","THEAD","TBODY","TFOOT","TH","TD","IFRAME","SCRIPT","AUDIO","VIDEO"];function Ke(e){return O(e,te)}function qe(e){return ne(e,te)}function O(e,t){return t.indexOf(e.nodeName)>=0}function ne(e,t){return e.getElementsByTagName&&t.some(function(n){return e.getElementsByTagName(n).length})}var Xe=[[/\\/g,"\\\\"],[/\*/g,"\\*"],[/^-/g,"\\-"],[/^\+ /g,"\\+ "],[/^(=+)/g,"\\$1"],[/^(#{1,6}) /g,"\\$1 "],[/`/g,"\\`"],[/^~~~/g,"\\~~~"],[/\[/g,"\\["],[/\]/g,"\\]"],[/^>/g,"\\>"],[/_/g,"\\_"],[/^(\d+)\. /g,"$1\\. "]];function re(e){return Xe.reduce(function(t,n){return t.replace(n[0],n[1])},e)}var m={};m.paragraph={filter:"p",replacement:function(e){return`

`+e+`

`}};m.lineBreak={filter:"br",replacement:function(e,t,n){return n.br+`
`}};m.heading={filter:["h1","h2","h3","h4","h5","h6"],replacement:function(e,t,n){var r=Number(t.nodeName.charAt(1));if(n.headingStyle==="setext"&&r<3){var i=L(r===1?"=":"-",e.length);return`

`+e+`
`+i+`

`}else return`

`+L("#",r)+" "+e+`

`}};m.blockquote={filter:"blockquote",replacement:function(e){return e=J(e).replace(/^/gm,"> "),`

`+e+`

`}};m.list={filter:["ul","ol"],replacement:function(e,t){var n=t.parentNode;return n.nodeName==="LI"&&n.lastElementChild===t?`
`+e:`

`+e+`

`}};m.listItem={filter:"li",replacement:function(e,t,n){var r=n.bulletListMarker+"   ",i=t.parentNode;if(i.nodeName==="OL"){var o=i.getAttribute("start"),a=Array.prototype.indexOf.call(i.children,t);r=(o?Number(o)+a:a+1)+".  "}var s=/\n$/.test(e);return e=J(e)+(s?`
`:""),e=e.replace(/\n/gm,`
`+" ".repeat(r.length)),r+e+(t.nextSibling?`
`:"")}};m.indentedCodeBlock={filter:function(e,t){return t.codeBlockStyle==="indented"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,t,n){return`

    `+t.firstChild.textContent.replace(/\n/g,`
    `)+`

`}};m.fencedCodeBlock={filter:function(e,t){return t.codeBlockStyle==="fenced"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,t,n){for(var r=t.firstChild.getAttribute("class")||"",i=(r.match(/language-(\S+)/)||[null,""])[1],o=t.firstChild.textContent,a=n.fence.charAt(0),s=3,l=new RegExp("^"+a+"{3,}","gm"),f;f=l.exec(o);)f[0].length>=s&&(s=f[0].length+1);var p=L(a,s);return`

`+p+i+`
`+o.replace(/\n$/,"")+`
`+p+`

`}};m.horizontalRule={filter:"hr",replacement:function(e,t,n){return`

`+n.hr+`

`}};m.inlineLink={filter:function(e,t){return t.linkStyle==="inlined"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,t){var n=D(t.getAttribute("href")),r=B(k(t.getAttribute("title"))),i=r?' "'+r+'"':"";return"["+e+"]("+n+i+")"}};m.referenceLink={filter:function(e,t){return t.linkStyle==="referenced"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,t,n){var r=D(t.getAttribute("href")),i=k(t.getAttribute("title"));i&&(i=' "'+B(i)+'"');var o,a;switch(n.linkReferenceStyle){case"collapsed":o="["+e+"][]",a="["+e+"]: "+r+i;break;case"shortcut":o="["+e+"]",a="["+e+"]: "+r+i;break;default:var s=this.references.length+1;o="["+e+"]["+s+"]",a="["+s+"]: "+r+i}return this.references.push(a),o},references:[],append:function(e){var t="";return this.references.length&&(t=`

`+this.references.join(`
`)+`

`,this.references=[]),t}};m.emphasis={filter:["em","i"],replacement:function(e,t,n){return e.trim()?n.emDelimiter+e+n.emDelimiter:""}};m.strong={filter:["strong","b"],replacement:function(e,t,n){return e.trim()?n.strongDelimiter+e+n.strongDelimiter:""}};m.code={filter:function(e){var t=e.previousSibling||e.nextSibling,n=e.parentNode.nodeName==="PRE"&&!t;return e.nodeName==="CODE"&&!n},replacement:function(e){if(!e)return"";e=e.replace(/\r?\n|\r/g," ");for(var t=/^`|^ .*?[^ ].* $|`$/.test(e)?" ":"",n="`",r=e.match(/`+/gm)||[];r.indexOf(n)!==-1;)n=n+"`";return n+t+e+t+n}};m.image={filter:"img",replacement:function(e,t){var n=re(k(t.getAttribute("alt"))),r=D(t.getAttribute("src")||""),i=k(t.getAttribute("title")),o=i?' "'+B(i)+'"':"";return r?"!["+n+"]("+r+o+")":""}};function k(e){return e?e.replace(/(\n+\s*)+/g,`
`):""}function D(e){var t=e.replace(/([<>()])/g,"\\$1");return t.indexOf(" ")>=0?"<"+t+">":t}function B(e){return e.replace(/"/g,'\\"')}function ie(e){this.options=e,this._keep=[],this._remove=[],this.blankRule={replacement:e.blankReplacement},this.keepReplacement=e.keepReplacement,this.defaultRule={replacement:e.defaultReplacement},this.array=[];for(var t in e.rules)this.array.push(e.rules[t])}ie.prototype={add:function(e,t){this.array.unshift(t)},keep:function(e){this._keep.unshift({filter:e,replacement:this.keepReplacement})},remove:function(e){this._remove.unshift({filter:e,replacement:function(){return""}})},forNode:function(e){if(e.isBlank)return this.blankRule;var t;return(t=S(this.array,e,this.options))||(t=S(this._keep,e,this.options))||(t=S(this._remove,e,this.options))?t:this.defaultRule},forEach:function(e){for(var t=0;t<this.array.length;t++)e(this.array[t],t)}};function S(e,t,n){for(var r=0;r<e.length;r++){var i=e[r];if(ze(i,t,n))return i}}function ze(e,t,n){var r=e.filter;if(typeof r=="string"){if(r===t.nodeName.toLowerCase())return!0}else if(Array.isArray(r)){if(r.indexOf(t.nodeName.toLowerCase())>-1)return!0}else if(typeof r=="function"){if(r.call(e,t,n))return!0}else throw new TypeError("`filter` needs to be a string, array, or function")}function Qe(e){var t=e.element,n=e.isBlock,r=e.isVoid,i=e.isPre||function(E){return E.nodeName==="PRE"};if(!(!t.firstChild||i(t))){for(var o=null,a=!1,s=null,l=q(s,t,i);l!==t;){if(l.nodeType===3||l.nodeType===4){var f=l.data.replace(/[ \r\n\t]+/g," ");if((!o||/ $/.test(o.data))&&!a&&f[0]===" "&&(f=f.substr(1)),!f){l=x(l);continue}l.data=f,o=l}else if(l.nodeType===1)n(l)||l.nodeName==="BR"?(o&&(o.data=o.data.replace(/ $/,"")),o=null,a=!1):r(l)||i(l)?(o=null,a=!0):o&&(a=!1);else{l=x(l);continue}var p=q(s,l,i);s=l,l=p}o&&(o.data=o.data.replace(/ $/,""),o.data||x(o))}}function x(e){var t=e.nextSibling||e.parentNode;return e.parentNode.removeChild(e),t}function q(e,t,n){return e&&e.parentNode===t||n(t)?t.nextSibling||t.parentNode:t.firstChild||t.nextSibling||t.parentNode}var P=typeof window<"u"?window:{};function Je(){var e=P.DOMParser,t=!1;try{new e().parseFromString("","text/html")&&(t=!0)}catch{}return t}function Ze(){var e=function(){};return et()?e.prototype.parseFromString=function(t){var n=new window.ActiveXObject("htmlfile");return n.designMode="on",n.open(),n.write(t),n.close(),n}:e.prototype.parseFromString=function(t){var n=document.implementation.createHTMLDocument("");return n.open(),n.write(t),n.close(),n},e}function et(){var e=!1;try{document.implementation.createHTMLDocument("").open()}catch{P.ActiveXObject&&(e=!0)}return e}var tt=Je()?P.DOMParser:Ze();function nt(e,t){var n;if(typeof e=="string"){var r=rt().parseFromString('<x-turndown id="turndown-root">'+e+"</x-turndown>","text/html");n=r.getElementById("turndown-root")}else n=e.cloneNode(!0);return Qe({element:n,isBlock:M,isVoid:ee,isPre:t.preformattedCode?it:null}),n}var R;function rt(){return R=R||new tt,R}function it(e){return e.nodeName==="PRE"||e.nodeName==="CODE"}function ot(e,t){return e.isBlock=M(e),e.isCode=e.nodeName==="CODE"||e.parentNode.isCode,e.isBlank=at(e),e.flankingWhitespace=lt(e,t),e}function at(e){return!ee(e)&&!Ke(e)&&/^\s*$/i.test(e.textContent)&&!Ye(e)&&!qe(e)}function lt(e,t){if(e.isBlock||t.preformattedCode&&e.isCode)return{leading:"",trailing:""};var n=st(e.textContent);return n.leadingAscii&&X("left",e,t)&&(n.leading=n.leadingNonAscii),n.trailingAscii&&X("right",e,t)&&(n.trailing=n.trailingNonAscii),{leading:n.leading,trailing:n.trailing}}function st(e){var t=e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);return{leading:t[1],leadingAscii:t[2],leadingNonAscii:t[3],trailing:t[4],trailingNonAscii:t[5],trailingAscii:t[6]}}function X(e,t,n){var r,i,o;return e==="left"?(r=t.previousSibling,i=/ $/):(r=t.nextSibling,i=/^ /),r&&(r.nodeType===3?o=i.test(r.nodeValue):n.preformattedCode&&r.nodeName==="CODE"?o=!1:r.nodeType===1&&!M(r)&&(o=i.test(r.textContent))),o}var ct=Array.prototype.reduce;function N(e){if(!(this instanceof N))return new N(e);var t={rules:m,headingStyle:"setext",hr:"* * *",bulletListMarker:"*",codeBlockStyle:"indented",fence:"```",emDelimiter:"_",strongDelimiter:"**",linkStyle:"inlined",linkReferenceStyle:"full",br:"  ",preformattedCode:!1,blankReplacement:function(n,r){return r.isBlock?`

`:""},keepReplacement:function(n,r){return r.isBlock?`

`+r.outerHTML+`

`:r.outerHTML},defaultReplacement:function(n,r){return r.isBlock?`

`+n+`

`:n}};this.options=We({},t,e),this.rules=new ie(this.options)}N.prototype={turndown:function(e){if(!dt(e))throw new TypeError(e+" is not a string, or an element/document/fragment node.");if(e==="")return"";var t=oe.call(this,new nt(e,this.options));return ut.call(this,t)},use:function(e){if(Array.isArray(e))for(var t=0;t<e.length;t++)this.use(e[t]);else if(typeof e=="function")e(this);else throw new TypeError("plugin must be a Function or an Array of Functions");return this},addRule:function(e,t){return this.rules.add(e,t),this},keep:function(e){return this.rules.keep(e),this},remove:function(e){return this.rules.remove(e),this},escape:function(e){return re(e)}};function oe(e){var t=this;return ct.call(e.childNodes,function(n,r){r=new ot(r,t.options);var i="";return r.nodeType===3?i=r.isCode?r.nodeValue:t.escape(r.nodeValue):r.nodeType===1&&(i=ft.call(t,r)),ae(n,i)},"")}function ut(e){var t=this;return this.rules.forEach(function(n){typeof n.append=="function"&&(e=ae(e,n.append(t.options)))}),e.replace(/^[\t\r\n]+/,"").replace(/[\t\r\n\s]+$/,"")}function ft(e){var t=this.rules.forNode(e),n=oe.call(this,e),r=e.flankingWhitespace;return(r.leading||r.trailing)&&(n=n.trim()),r.leading+t.replacement(n,e,this.options)+r.trailing}function ae(e,t){var n=Q(e),r=z(t),i=Math.max(e.length-n.length,t.length-r.length),o=`

`.substring(0,i);return n+o+r}function dt(e){return e!=null&&(typeof e=="string"||e.nodeType&&(e.nodeType===1||e.nodeType===9||e.nodeType===11))}var Ne=Ie(Ce(),1);function ke(){let e=new N({headingStyle:"atx",hr:"---",bulletListMarker:"-",codeBlockStyle:"fenced",fence:"```",emDelimiter:"_",strongDelimiter:"**",linkStyle:"inlined",br:"  ",preformattedCode:!0});return e.use(Ne.gfm),e.addRule("fencedCodeBlockWithLang",{filter:t=>t.nodeName==="PRE",replacement:(t,n)=>Rt(n)}),e.addRule("safeLink",{filter:t=>t.nodeName==="A"&&!St(t),replacement:t=>t}),e.addRule("imageWithoutSrc",{filter:t=>t.nodeName==="IMG"&&!t.getAttribute("src"),replacement:()=>""}),e}function St(e){let t=e.getAttribute("href");return!(!t||t.trim()===""||t.trim().toLowerCase().startsWith("javascript:"))}function xt(e){let t=e.querySelector("code"),n=[t?.className,e.className,t?.getAttribute("data-lang")??void 0,e.getAttribute("data-lang")??void 0];for(let r of n)if(r)for(let i of G){let o=r.match(i);if(o)return o[1]}return""}function Rt(e){let n=(e.querySelector("code")??e).textContent??"",r=xt(e),i=n.match(/`{3,}/g),o=i?Math.max(...i.map(s=>s.length)):2,a="`".repeat(o+1);return`

${a}${r}
${n.replace(/\n$/,"")}
${a}

`}function we(e){let t=W(e);return ke().turndown(t).replace(/\n{3,}/g,`

`).trim()}async function Se(e){if(Lt())try{return await navigator.clipboard.writeText(e),{ok:!0,method:"clipboard-api"}}catch{}return Mt(e)?{ok:!0,method:"exec-command"}:{ok:!1,method:"failed"}}function Lt(){return typeof navigator.clipboard?.writeText=="function"&&window.isSecureContext&&document.hasFocus()}function Mt(e){let t=document.createElement("textarea");t.value=e,t.setAttribute("readonly",""),t.style.cssText="position:fixed;top:0;left:0;opacity:0;pointer-events:none;";let n=document.activeElement,r=Ot();document.body.appendChild(t),t.select(),t.setSelectionRange(0,t.value.length);let i=!1;try{i=document.execCommand("copy")}catch{i=!1}return t.remove(),n?.focus?.(),Dt(r),i}function Ot(){let e=window.getSelection();return!e||e.rangeCount===0?null:e.getRangeAt(0).cloneRange()}function Dt(e){let t=window.getSelection();t&&(t.removeAllRanges(),e&&t.addRange(e))}var xe=`/* Shadow DOM内で使うため、ページ側のCSSと衝突する心配はない。 */

#box {
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
  background: rgba(59, 130, 246, 0.15);
  display: none;
  will-change: transform, width, height;
}

#label {
  position: fixed;
  top: 0;
  left: 0;
  display: none;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #3b82f6;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  will-change: transform;
}

#toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: #111827;
  color: #fff;
  padding: 8px 14px;
  border-radius: 6px;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  max-width: 80vw;
  text-align: center;
}

#toast.visible {
  opacity: 1;
}

#toast.error {
  background: #7f1d1d;
}
`;var F="markdown-element-clipper-cursor-style",Pt=1600;function Re(){let e=document.createElement("div");e.style.cssText="position:fixed;inset:0;z-index:2147483647;pointer-events:none;",document.documentElement.appendChild(e);let t=e.attachShadow({mode:"closed"}),n=document.createElement("style");n.textContent=xe,t.appendChild(n);let r=document.createElement("div");r.id="box",t.appendChild(r);let i=document.createElement("div");i.id="label",t.appendChild(i);let o=document.createElement("div");o.id="toast",t.appendChild(o);let a=null,s="",l=null;Ht();let f=requestAnimationFrame(p);function p(){if(a){let u=a.getBoundingClientRect(),v=`${u.top},${u.left},${u.width},${u.height}`;v!==s&&(s=v,E(u))}f=requestAnimationFrame(p)}function E(u){r.style.display="block",r.style.transform=`translate(${u.left}px, ${u.top}px)`,r.style.width=`${u.width}px`,r.style.height=`${u.height}px`,i.style.display="block",i.textContent=_t(a,u),w(u)}function w(u){let T=u.top-22-2;T<0&&(T=u.top+2);let h=u.left;h<0&&(h=0);let A=window.innerWidth-8;h>A&&(h=A),i.style.transform=`translate(${h}px, ${T}px)`}return{setTarget(u){a=u,u||(r.style.display="none",i.style.display="none",s="")},showToast(u,v="success"){o.textContent=u,o.className=v==="error"?"error visible":"visible",l&&clearTimeout(l),l=setTimeout(()=>{o.className=""},Pt)},destroy(){cancelAnimationFrame(f),l&&clearTimeout(l),It(),e.remove()}}}function _t(e,t){let n=e.tagName.toLowerCase(),r=e.id?`#${e.id}`:"",i=Array.from(e.classList).slice(0,2).join("."),o=i?`.${i}`:"",a=`${Math.round(t.width)} × ${Math.round(t.height)}`;return`${n}${r}${o} ${a}`}function Ht(){if(document.getElementById(F))return;let e=document.createElement("style");e.id=F,e.textContent=`
    *, *::before, *::after {
      cursor: crosshair !important;
      user-select: none !important;
    }
  `,document.head.appendChild(e)}function It(){document.getElementById(F)?.remove()}var $t=1800,Ft=["click","auxclick","dblclick","mousedown","mouseup","pointerdown","pointerup","contextmenu","submit","keydown","keyup","touchstart"];function Le(){let e=!1,t=null,n=null,r=null,i=[];function o(){if(e)return;e=!0,t=Re(),n=new AbortController;let{signal:c}=n;window.addEventListener("mousemove",f,{capture:!0,passive:!0,signal:c}),window.addEventListener("blur",s,{signal:c}),document.addEventListener("visibilitychange",E,{signal:c});for(let d of Ft)window.addEventListener(d,w,{capture:!0,passive:!1,signal:c})}function a(){e=!1,n?.abort(),n=null,r=null,i=[]}function s(){e&&(a(),t?.destroy(),t=null)}function l(){e?s():o()}function f(c){let d=c.target??document.elementFromPoint(c.clientX,c.clientY);!d||d===r||(p(d),i=[])}function p(c){r=c,t?.setTarget(c)}function E(){document.visibilityState==="hidden"&&s()}function w(c){c.type==="keydown"?u(c):c.type==="click"&&h(),c.preventDefault(),c.stopPropagation(),c.stopImmediatePropagation()}function u(c){switch(c.key){case"Escape":s();break;case"Enter":h();break;case"ArrowUp":v();break;case"ArrowDown":T();break}}function v(){if(!r||r===document.documentElement)return;let c=r.parentElement;c&&(i.push(r),p(c))}function T(){if(!r)return;let c=i.pop();if(c&&c.parentElement===r){p(c);return}let d=Array.from(r.children).find(C=>{let y=C.getBoundingClientRect();return y.width>0&&y.height>0});d&&p(d)}function h(){if(!r)return;let c=r,d=t,C;try{C=we(c)}catch(y){console.error("[markdown-element-clipper] Markdown変換に失敗しました",y),a(),t=null,d?.setTarget(null),d?.showToast("Markdown変換に失敗しました","error"),A(d);return}a(),t=null,d?.setTarget(null),Se(C).then(y=>{y.ok?d?.showToast(`Markdownをコピーしました(${C.length.toLocaleString()}文字)`):d?.showToast("コピーに失敗しました。手動でコピーしてください","error"),A(d)})}function A(c){c&&setTimeout(()=>c.destroy(),$t)}return{start:o,stop:s,toggle:l}}if(globalThis.__MD_CLIPPER__)globalThis.__MD_CLIPPER__.toggle();else{let e=Le();globalThis.__MD_CLIPPER__=e,chrome.runtime.onMessage.addListener(t=>{t?.type==="PICKER_TOGGLE"&&e.toggle()}),e.start()}})();
