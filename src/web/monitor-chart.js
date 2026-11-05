const NS = "http://www.w3.org/2000/svg";
const colors = [
  "#49728f",
  "#c97e44",
  "#658344",
  "#85679c",
  "#448d86",
  "#a64e6d",
];
function shape(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
function tick(n) {
  if (n >= 10000)
    return (n / 1000).toLocaleString("en", { maximumFractionDigits: 1 }) + "k";
  return Number(n.toPrecision(4)).toString();
}
const zoomWindows = new Map();
let chartNumber = 0;
export function curve(series, xLabel, empty, key, translate, actions) {
  const box = document.createElement("div");
  box.className = "monitor-chart";
  series = series.filter((s) => s.points.length);
  if (!series.length) {
    box.classList.add("chart-empty");
    box.textContent = empty;
    return box;
  }
  const plot = shape("svg", {
    viewBox: "0 0 600 288",
    role: "img",
    "aria-label": series.map((s) => s.label).join(" / "),
  });
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const s of series)
    for (const [x, y] of s.points) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const pad = (y1 - y0) * 0.08 || Math.max(Math.abs(y1) * 0.02, 0.01);
  y0 -= pad;
  y1 += pad;
  const xPadding = Math.max(0.5, (x1 - x0) * 0.035);
  x0 -= xPadding;
  x1 += xPadding;
  const saved=zoomWindows.get(key);
  if(saved)[x0,x1,y0,y1]=saved;
  function redraw(bounds){
    if(bounds)zoomWindows.set(key,bounds);else zoomWindows.delete(key);
    box.replaceWith(curve(series,xLabel,empty,key,translate,actions));
  }
  actions.replaceChildren();
  for(const [glyph,label,callback] of [
    ["↺",translate("复位","Reset zoom"),()=>redraw(null)]
  ]){
    const button=document.createElement("button");button.type="button";button.textContent=glyph;button.title=label;button.setAttribute("aria-label",label);button.onclick=callback;actions.append(button);
  }
  const clipId="metric-clip-"+(++chartNumber);
  const clip=shape("clipPath",{id:clipId});clip.append(shape("rect",{x:70,y:20,width:506,height:226}));plot.append(clip);
  const drawing=shape("g",{"clip-path":"url(#"+clipId+")"});
  const px = (x) => (x1 === x0 ? 450 : 70 + ((x - x0) / (x1 - x0)) * 506),
    py = (y) => 246 - ((y - y0) / (y1 - y0)) * 226;
  plot.append(shape("rect",{x:70,y:20,width:506,height:226,class:"plot-surface"}));
  const scientific=Math.max(Math.abs(y0),Math.abs(y1))<0.01 || Math.max(Math.abs(y0),Math.abs(y1))>=10000;
  for (let i = 0; i <= 4; i++) {
    const y = y0 + ((y1 - y0) * i) / 4;
    plot.append(
      shape("path", { d: "M70 " + py(y) + "H576", class: "chart-grid" }),
      shape("text", { x: 60, y: py(y) + 4, "text-anchor": "end" }, scientific?y.toExponential(2):tick(y)),
    );
  }
  const ticks = 8;
  for (let i = 0; i <= ticks; i++) {
    const x = x0 + ((x1 - x0) * i) / ticks;
    plot.append(
      shape("path",{d:"M"+px(x)+" 20V246",class:"chart-grid"}),
      ...(i%2===0 ? [shape("text", { x: px(x), y: 263, "text-anchor": "middle" }, tick(x))] : []),
    );
  }

  const legend = document.createElement("div");
  legend.className = "monitor-legend";
  series.forEach(({ label, points, dashed }, i) => {
    const c = colors[i % colors.length],
      ordered = [...points].sort((a, b) => a[0] - b[0]);
    drawing.append(
      shape("polyline", {
        points: ordered.map(([x, y]) => px(x) + "," + py(y)).join(" "),
        fill: "none",
        stroke: c,
        "stroke-width": 2.3,
        "stroke-dasharray": dashed ? "6 4" : "none",
      }),
    );
    if (ordered.length <= 50)
      for (const [x, y] of ordered) {
        const dot = shape("circle", { cx: px(x), cy: py(y), r: 3.3, fill: c });
        drawing.append(dot);
      }
    const key = document.createElement("span");
    const mark = document.createElement("i");
    mark.style.backgroundColor = c;
    if (dashed) mark.style.borderTopStyle = "dashed";
    key.append(mark, label);
    legend.append(key);
  });
  plot.append(drawing,shape("rect",{x:70,y:20,width:506,height:226,class:"plot-frame"}));
  const tip=shape("text",{x:568,y:34,"text-anchor":"end",class:"plot-tooltip","pointer-events":"none"});plot.append(tip);tip.style.visibility="hidden";
  const guides=shape("path",{class:"plot-guides",visibility:"hidden","pointer-events":"none"});
  plot.append(guides);
  const cursor=shape("circle",{r:5,stroke:"white","stroke-width":2,visibility:"hidden","pointer-events":"none"});plot.append(cursor);
  function hideTip(){guides.setAttribute("visibility","hidden");tip.style.visibility="hidden";cursor.setAttribute("visibility","hidden");}
  function hover(e){
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(plot.getScreenCTM().inverse());
    if(p.x<70||p.x>576||p.y<20||p.y>246){hideTip();return;}
    let best=null,distance=Infinity;
    series.forEach((s,i)=>{for(const [x,y] of s.points){
      if(x<x0||x>x1||y<y0||y>y1)continue;
      const d=(px(x)-p.x)**2+(py(y)-p.y)**2;
      if(d<distance){distance=d;best={x,y,label:s.label,color:colors[i%colors.length]};}
    }});
    if(!best){hideTip();return;}
    cursor.setAttribute("cx",px(best.x));cursor.setAttribute("cy",py(best.y));cursor.setAttribute("fill",best.color);cursor.setAttribute("visibility","visible");
    tip.textContent="x: "+best.x+"   y: "+best.y;
    guides.setAttribute("d", "M70 "+py(best.y)+"H576 M"+px(best.x)+" 20V246");
    guides.setAttribute("visibility","visible");
    tip.style.visibility="visible";
  }
  plot.onpointerleave=hideTip;
  let start=null;
  const selection=shape("rect",{fill:"#176b8922",stroke:"#49728f","pointer-events":"none"});
  function point(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(plot.getScreenCTM().inverse());return [Math.max(70,Math.min(576,p.x)),Math.max(20,Math.min(246,p.y))];}
  plot.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();hideTip();start=point(e);plot.setPointerCapture(e.pointerId);plot.append(selection);};
  plot.onpointermove=e=>{if(!start){hover(e);return;}const [x,y]=point(e);for(const [k,v] of Object.entries({x:Math.min(start[0],x),y:Math.min(start[1],y),width:Math.abs(x-start[0]),height:Math.abs(y-start[1])}))selection.setAttribute(k,v);};
  plot.onpointerup=e=>{if(!start)return;const [x,y]=point(e),[a,b]=start;start=null;selection.remove();
    if(Math.abs(x-a)<5||Math.abs(y-b)<5)return;
    const dataX=v=>x0+(v-70)/506*(x1-x0),dataY=v=>y1-(v-20)/226*(y1-y0);
    redraw([dataX(Math.min(x,a)),dataX(Math.max(x,a)),dataY(Math.max(y,b)),dataY(Math.min(y,b))]);};
  plot.onlostpointercapture=plot.onpointercancel=()=>{start=null;selection.remove();};
  plot.ondblclick=()=>redraw(null);
  const footer=document.createElement("div");footer.className="chart-footer";footer.append(legend);box.append(plot,footer);
  return box;
}
