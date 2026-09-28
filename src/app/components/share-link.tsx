'use client';
import { useState } from 'react';
export function ShareLink({path}:{path:string}){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(window.location.origin+path);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{setCopied(false)}}
 return <div className="sharebox"><a className="sharelink" href={path} target="_blank" rel="noopener noreferrer">Open client view ↗</a><p className="hint mono share-url">{path}</p><button className="secondary" type="button" onClick={copy}>{copied?'Copied':'Copy client link'}</button></div>
}
