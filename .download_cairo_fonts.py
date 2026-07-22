import re
import pathlib
import urllib.request
import urllib.parse

url = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap'
print('Downloading CSS from', url)
resp = urllib.request.urlopen(url)
css = resp.read().decode('utf-8')
urls = list(dict.fromkeys(re.findall(r'url\(([^)]+)\)', css)))
folder = pathlib.Path('public/fonts/cairo')
folder.mkdir(parents=True, exist_ok=True)
print('Found URLs:', urls)
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
