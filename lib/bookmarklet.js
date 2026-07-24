/**
 * Código do bookmarklet "Enviar para o Serjohn".
 *
 * Corre dentro da página do mobile.de (é por isso que funciona: o mobile.de
 * bloqueia pedidos vindos de servidores, mas não bloqueia o browser da pessoa).
 * Lê o anúncio e envia-o, por postMessage, para /importar/receber no CRM —
 * que está protegido pela sessão normal. Não há segredos dentro do bookmarklet.
 */

const FONTE = `(function(){
try{
var O=__ORIGIN__;
if(!/(^|\\.)mobile\\.de$/i.test(location.hostname)){alert('Abra primeiro o anúncio no mobile.de.');return;}
var H=document.documentElement.outerHTML;
function num(v){if(v==null)return null;if(typeof v==='number')return isFinite(v)?Math.round(v):null;var s0=String(v).replace(/[\\s\\u00a0\\u202f]/g,'');var m=s0.match(/-?\\d[\\d.,]*/);if(!m)return null;var s=m[0];var d=s.match(/^(-?[\\d.,]*?)([.,])(\\d{1,2})$/);if(d&&/^\\d{1,3}([.,]\\d{3})*$|^\\d+$/.test(d[1].replace(/^-/,'')))s=d[1].replace(/[.,]/g,'')+'.'+d[3];else s=s.replace(/[.,]/g,'');var n=Math.round(parseFloat(s));return isFinite(n)?n:null;}
function ld(){var o=[];var n=document.querySelectorAll('script[type="application/ld+json"]');for(var i=0;i<n.length;i++){try{var j=JSON.parse(n[i].textContent);if(Array.isArray(j))o=o.concat(j);else o.push(j);}catch(e){}}var x=[];for(var k=0;k<o.length;k++){if(o[k]&&Array.isArray(o[k]['@graph']))x=x.concat(o[k]['@graph']);else x.push(o[k]);}return x;}
function tipo(n){var t=n&&n['@type'];t=Array.isArray(t)?t:[t];for(var i=0;i<t.length;i++){if(/^(Car|Vehicle|Product|IndividualProduct)$/i.test(String(t[i]||'')))return true;}return false;}
function fuel(s){if(!s)return null;s=String(s);
if(/plug.?in|steckdose/i.test(s))return 'Híbrido Plug-In';
if(/hybrid|h[ií]brid/i.test(s))return 'Híbrido';
if(/elektro|electric|el[eé]tric|el[eé]ctric/i.test(s))return 'Elétrico';
if(/diesel|gas[oó]leo/i.test(s))return 'Gasóleo';
if(/benzin|petrol|gasolin/i.test(s))return 'Gasolina';
if(/lpg|autogas/i.test(s))return 'GPL';
if(/cng|erdgas/i.test(s))return 'GNC';
return s.slice(0,40);}
var C={marca:null,modelo:null,ano:null,kms:null,combustivel:null,valorVenda:null,extras:null,photos:[],mobileDeUrl:location.href,titulo:null};
var ns=ld();var no=null;for(var i=0;i<ns.length;i++){if(tipo(ns[i])){no=ns[i];break;}}
if(no){
C.titulo=no.name||null;
var b=no.brand&&no.brand.name?no.brand.name:(typeof no.brand==='string'?no.brand:null);
if(b)C.marca=String(b).trim();
if(typeof no.model==='string'&&no.model.trim())C.modelo=no.model.trim();
var d=no.vehicleModelDate||no.productionDate||no.modelDate;if(d)C.ano=num(String(d).slice(0,4));
var mm=no.mileageFromOdometer;C.kms=num(mm&&typeof mm==='object'?mm.value:mm);
var f=no.fuelType;C.combustivel=fuel(f&&typeof f==='object'?f.name:f);
var of=Array.isArray(no.offers)?no.offers[0]:no.offers;
if(of)C.valorVenda=num(of.price!=null?of.price:(of.priceSpecification&&of.priceSpecification.price));
if(typeof no.description==='string')C.extras=no.description.trim();
var im=no.image?(Array.isArray(no.image)?no.image:[no.image]):[];
for(var j=0;j<im.length;j++){var u=typeof im[j]==='object'?(im[j].url||im[j].contentUrl):im[j];if(u)C.photos.push(u);}
}
if(!C.titulo){var h=document.querySelector('h1');if(h)C.titulo=h.textContent.replace(/\\s+/g,' ').trim();}
if(C.titulo&&(!C.marca||!C.modelo)){
var MB=['Alfa Romeo','Aston Martin','Land Rover','Mercedes-Benz','Rolls-Royce','Great Wall','DS Automobiles'];
var t=C.titulo,br=null;
for(var m0=0;m0<MB.length;m0++){if(t.toLowerCase().indexOf(MB[m0].toLowerCase())===0){br=MB[m0];break;}}
if(!br)br=t.split(' ')[0];
if(!C.marca)C.marca=br;
if(!C.modelo)C.modelo=t.slice(br.length).trim();
}
var TX=(document.body.innerText||'').replace(/[\\s\\u00a0]+/g,' ');
function et(labels,jan){for(var i2=0;i2<labels.length;i2++){var r=new RegExp(labels[i2]+'[^A-Za-z0-9€]{0,4}([^|]{0,'+(jan||40)+'})','i');var mm2=TX.match(r);if(mm2&&mm2[1])return mm2[1].trim();}return null;}
if(C.ano==null){var a=et(['Erstzulassung','First Registration','Matr[ií]cula']);var ma=a&&a.match(/(19|20)\\d{2}/);if(ma)C.ano=parseInt(ma[0],10);}
if(C.kms==null){var kk=et(['Kilometerstand','Mileage','Quil[óo]metros']);if(kk)C.kms=num(kk.replace(/km[\\s\\S]*/i,''));}
if(!C.combustivel){C.combustivel=fuel(et(['Kraftstoffart','Kraftstoff','Fuel type','Combust[ií]vel']));}
if(C.valorVenda==null){var mp=TX.match(/(?:€|EUR)\\s?([\\d.\\s\\u00a0]{4,12})/)||TX.match(/([\\d.\\s\\u00a0]{4,12})\\s?(?:€|EUR)/);if(mp){var pv=num(mp[1]);if(pv&&pv>500&&pv<5000000)C.valorVenda=pv;}}
if(!C.extras){var dm=document.querySelector('[data-testid="vehicle-description"],#vehicle-description,[class*="description"]');if(dm)C.extras=dm.innerText.trim().slice(0,4000);}
var seen={},out=[],re=/https?:\\/\\/[^"'\\s\\\\)]*(?:classistatic\\.de|s\\.mobile\\.de)[^"'\\s\\\\)]*/gi,mx;
var todas=C.photos.slice();
var HL=H.replace(/\\\\\\//g,'/');
while((mx=re.exec(HL))!==null)todas.push(mx[0]);
for(var p=0;p<todas.length;p++){
var u2=todas[p];if(u2.indexOf('//')===0)u2='https:'+u2;
if(!/^https?:\\/\\//i.test(u2))continue;
if(!/\\/(images|api)\\//i.test(u2)&&!/\\.(jpe?g|png)/i.test(u2))continue;
if(/logo|icon|sprite|placeholder|dealer|handler|avatar/i.test(u2))continue;
u2=u2.replace(/rule=[a-z0-9-]+\\.(jpg|jpeg|png)/i,'rule=mo-1600.jpg').replace(/\\/\\$_\\d+(\\.[A-Za-z]+)?$/,'/$_57.JPG');
var kx=u2.split('?')[0].replace(/\\/\\$_\\d+(\\.[A-Za-z]+)?$/,'');
if(seen[kx])continue;seen[kx]=1;out.push(u2);
}
C.photos=out.slice(0,40);
var w=window.open(O+'/importar/receber','_blank');
if(!w){alert('O browser bloqueou a janela. Permita pop-ups em mobile.de e tente outra vez.');return;}
var tries=0;
var iv=setInterval(function(){tries++;try{w.postMessage({type:'serjohn-anuncio',car:C},O);}catch(e){}if(tries>60)clearInterval(iv);},400);
window.addEventListener('message',function(ev){if(ev.origin===O&&ev.data&&ev.data.type==='serjohn-ok')clearInterval(iv);});
}catch(err){alert('Não consegui ler este anúncio: '+err.message);}
})();`;

/** Devolve o href javascript: pronto a usar, com a origem do CRM embutida. */
export function bookmarkletHref(origin) {
  const js = FONTE.replace('__ORIGIN__', JSON.stringify(origin));
  return 'javascript:' + encodeURIComponent(js);
}
