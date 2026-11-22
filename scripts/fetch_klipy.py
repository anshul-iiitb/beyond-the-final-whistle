import urllib.request
import re

url = 'https://klipy.com/gifs/adidas-18'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        matches = re.findall(r'https://static\.klipy\.com/[^\"]+\.(?:gif|mp4|webp)', html)
        print('Direct static URLs found:', set(matches))
except Exception as e:
    print('Klipy fetch error:', e)
