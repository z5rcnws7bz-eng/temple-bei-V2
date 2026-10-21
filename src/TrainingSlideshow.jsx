import React,{useState} from 'react';
import studentInfo from './bei-student-info.json';
export function trainingSlideshow(resourceUrl){
 try{const url=new URL(resourceUrl);return url.origin==='https://temple-bei-v2.vercel.app'&&url.pathname===studentInfo.pptx?studentInfo:null;}catch{return null;}
}
export function TrainingSlideshow({material}){
 const [index,setIndex]=useState(0),[failed,setFailed]=useState(false);
 const slide=material.slides[index];
 const move=next=>{setIndex(Math.max(0,Math.min(material.slides.length-1,next)));setFailed(false);};
 return <section className="training-slideshow" aria-label={`${material.title} slideshow`}>
 <div className="slideshow-controls"><button type="button" className="secondary" disabled={index===0} onClick={()=>move(index-1)}>Previous slide</button><label><span className="sr-only">Choose slide</span><select aria-label="Choose slide" value={index} onChange={e=>move(Number(e.target.value))}>{material.slides.map((s,i)=><option key={s.src} value={i}>Slide {i+1} of {material.slides.length}</option>)}</select></label><button type="button" className="secondary" disabled={index===material.slides.length-1} onClick={()=>move(index+1)}>Next slide</button></div>
 <div className="slide-stage" role="group" aria-label="Slide viewer. Use left and right arrow keys to navigate." tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();move(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();move(index-1);}}}>
 {failed?<p role="alert">The slide image could not load. You can open the PDF or download the PowerPoint below.</p>:<img src={slide.src} alt={`Slide ${index+1}: ${slide.title}`} onError={()=>setFailed(true)}/>}</div>
 <p className="muted slide-caption" role="status">Slide {index+1} of {material.slides.length} · {slide.title}</p>
 <details className="slide-transcript"><summary>Read slide text</summary><p>{slide.text||'This slide contains visual content. See the slide image or download the presentation.'}</p></details>
 <div className="button-group training-downloads"><a className="primary" href={material.pptx} download="BEI Presentation (Students).pptx">Download PowerPoint</a><a className="secondary" href={material.pdf} target="_blank" rel="noopener noreferrer">Open PDF ↗</a><a className="secondary" href={material.pdf} download="BEI (Student Info).pdf">Download PDF</a></div>
 </section>;
}
