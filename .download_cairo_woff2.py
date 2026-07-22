import re
import pathlib
import urllib.request
import urllib.parse

url = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'})
print('Downloading CSS from', url)
resp = urllib.request.urlopen(req)
css = resp.read().decode('utf-8')
print(css)
urls = list(dict.fromkeys(re.findall(r'url\(([^)]+)\)', css)))
print('Found URLs:', urls)
folder = pathlib.Path('public/fonts/cairo')
folder.mkdir(parents=True, exist_ok=True)
for u in urls:
    if u.startswith('data:'):
        continue
    if u.startswith('//'):
        u = 'https:' + u
    elif u.startswith('/'):
        u = 'https://fonts.googleapis.com' + u
    name = pathlib.Path(urllib.parse.urlparse(u).path).name
    out = folder / name
    print('Downloading', u, '->', out)
    urllib.request.urlretrieve(u, out)
print('Done.')
