'use client';
import { useState } from 'react';
function useCopy(path:string){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(window.location.origin+path);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{setCopied(false)}}
 return {copied,copy};
}
export function ShareLink({path,project}:{path:string;project:string}){
 const {copied,copy}=useCopy(path);
 const [messageCopied,setMessageCopied]=useState(false);
 const [shareError,setShareError]=useState(false);
 function message(){return `Please review the scope for ${project} and let me know if anything needs changing: ${window.location.origin+path}`;}
 async function copyMessage(){try{await navigator.clipboard.writeText(message());setMessageCopied(true);setShareError(false);setTimeout(()=>setMessageCopied(false),2200)}catch{setShareError(true)}}
 async function share(){
  if(!navigator.share){await copyMessage();return;}
  try{await navigator.share({text:message()});setShareError(false)}
  catch(error){if((error as Error).name!=='AbortError') setShareError(true)}
 }
 return <div className="sharebox"><a className="sharelink" href={path} target="_blank" rel="noopener noreferrer">Open client view ↗</a><p className="hint mono share-url">{path}</p><button className="secondary" type="button" onClick={copy}>{copied?'Copied':'Copy client link'}</button><button className="secondary" type="button" onClick={share}>Share quote</button><button className="secondary" type="button" onClick={copyMessage}>{messageCopied?'Copied':'Copy WhatsApp message'}</button><p className="hint">The share sheet lets you choose WhatsApp where available. Review the message and recipient before sending; only the client link is included.</p>{shareError&&<p role="alert" className="hint">Sharing was unavailable. Copy the message and paste it into WhatsApp instead.</p>}</div>
}
export function EditorLink({path}:{path:string}){
 const {copied,copy}=useCopy(path);
 const [shown,setShown]=useState(false);
 return <div className="sharebox"><p className="hint mono share-url">{shown?path:path.replace(/key=.*/,'key=••••••••')}</p><button className="secondary" type="button" onClick={()=>setShown(!shown)}>{shown?'Hide':'Show'}</button><button className="secondary" type="button" onClick={copy}>{copied?'Copied':'Copy private editor link'}</button></div>
}
