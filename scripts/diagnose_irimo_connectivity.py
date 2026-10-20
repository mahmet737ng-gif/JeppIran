#!/usr/bin/env python3
"""Public HTTP connectivity checks; diagnostic only, never republish proxy data.
No credentials, no cookies, no TLS bypass.
"""
import concurrent.futures,urllib.parse,urllib.request,datetime,html.parser,re, json
endpoint="https://www.irimo.ir/far/index.php?module=pmk&type=user&func=showBlock&bid=601&standalone=1"
aliases=[
("direct-www",endpoint),
("direct-root",endpoint.replace("www.irimo.ir","irimo.ir")),
("direct-http",endpoint.replace("https://","http://")),
("google-translate","https://www-irimo-ir.translate.goog/far/index.php?module=pmk&type=user&func=showBlock&bid=601&standalone=1&_x_tr_sl=fa&_x_tr_tl=en&_x_tr_hl=en"),
("jina-ai","https://r.jina.ai/"+endpoint),
("allorigins","https://api.allorigins.win/raw?url="+urllib.parse.quote(endpoint,safe="")),
("corsproxy","https://corsproxy.io/?url="+urllib.parse.quote(endpoint,safe="")),
]
def attempt(spec):
    label,url=spec
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"text/html,*/*"})
        with urllib.request.urlopen(req,timeout=7) as rsp:
            text=rsp.read(1000000).decode("utf-8","replace")
            parsed=re.findall(r"METAR\s+OIMM\s+\d{6}Z.{5,180}",text,re.I)
            return dict(provider=label,code=rsp.status,bytes=len(text),has_html_weather="stat_info_601_" in text,has_OIMM=bool(parsed),oimm_sample=parsed[0][:120] if parsed else "",snippet=text[:90].replace("\n"," "))
    except Exception as ex:
        return dict(provider=label,error=type(ex).__name__+": "+str(ex)[:115])
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
    for result in pool.map(attempt,aliases):
        print(json.dumps(result,ensure_ascii=False),flush=True)
