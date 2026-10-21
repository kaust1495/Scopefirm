'use client';

import Script from 'next/script';

// Microsoft Clarity session analytics. lazyOnload loads the tag during
// browser idle time, after the page is interactive: no first-paint or
// layout impact. The CSP in src/proxy.ts allows www.clarity.ms as a script
// source and *.clarity.ms for its beacons.
export default function Clarity() {
  return (
    <Script id="microsoft-clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "z12or8gvwp");`}
    </Script>
  );
}
