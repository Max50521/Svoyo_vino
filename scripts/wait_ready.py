import argparse,json,time,urllib.request
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8080');p.add_argument('--timeout',type=int,default=180);a=p.parse_args()
deadline=time.monotonic()+a.timeout
while time.monotonic()<deadline:
    try:
        with urllib.request.urlopen(a.url+'/ready',timeout=5) as r:body=json.load(r)
        if body.get('ready'):
            print(json.dumps(body));print('Open '+a.url);break
    except Exception:pass
    time.sleep(1)
else:raise SystemExit('Readiness failed. Inspect data/runtime/ml.log and web.log')
