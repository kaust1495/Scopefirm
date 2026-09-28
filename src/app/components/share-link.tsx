'use client';
import { useState } from 'react';
function useCopy(path:string){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(window.location.origin+path);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{setCopied(false)}}
 return {copied,copy};
}
export function ShareLink({path}:{path:string}){
 const {copied,copy}=useCopy(path);
 return <div className="sharebox"><a className="sharelink" href={path} target="_blank" rel="noopener noreferrer">Open client view ↗</a><p className="hint mono share-url">{path}</p><button className="secondary" type="button" onClick={copy}>{copied?'Copied':'Copy client link'}</button></div>
}
export function EditorLink({path}:{path:string}){
 const {copied,copy}=useCopy(path);
 const [shown,setShown]=useState(false);
 return <div className="sharebox"><p className="hint mono share-url">{shown?path:path.replace(/key=.*/,'key=••••••••')}</p><button className="secondary" type="button" onClick={()=>setShown(!shown)}>{shown?'Hide':'Show'}</button><button className="secondary" type="button" onClick={copy}>{copied?'Copied':'Copy private editor link'}</button></div>
}
