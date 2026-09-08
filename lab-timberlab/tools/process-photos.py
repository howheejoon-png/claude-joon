"""Select, orient, resize and compress client photography for the web.
Source: public/img/projects/<client folder>/...  ->  public/img/projects/<slug>/NN.jpg
Originals are not shipped; EXIF is stripped."""
import os, sys
from PIL import Image, ImageOps
import pillow_heif; pillow_heif.register_heif_opener()

SRC = 'public/img/projects'
MAXL = 2000; HERO = 2400; Q = 80

# slug: (folder, [files in order: 00 = cover, then gallery...], hero file or None)
SEL = {
  'tampines-greenverge-fluted': ('627B TAMPINES', ['Site (4).jpg','Site (3).jpg','Site (9).jpg','Site (7).jpg','Site (2).jpg','Site (11).jpg','Site (10).jpg','Site (13).jpg','Site (14).jpg','Site (12).jpg'], 'Site (1).jpg'),
  'tampines-greenverge-stone':  ('627B TAMPINES GREENVERGE', ['Site (14).jpg','Site (11).jpg','Site (12).jpg','Site (5).jpg','Site (3).jpg','Site (7.1).jpg','Site (13).jpg','Site (6).jpg','Site (9).jpg','Site (1).jpg'], None),
  'sembawang-country-kitchen':  ('371A Sembawang Ave', ['IMG_5929.heic','IMG_6040.HEIC','CJN07803.jpg','IMG_5946.heic','CJN07828.jpg','CJN07829.jpg','IMG_5937.heic','IMG_5967.heic'], None),
  'tampines-greenglen-limewash':('663C Tampines Greenglen', ['IMG_3553.heic','CJN07852.jpg','IMG_3570.heic','IMG_3571.heic','IMG_3565.heic','IMG_3634.heic','IMG_3657.heic','IMG_3619.heic','IMG_3594.heic','IMG_3600.heic'], None),
  'rivervale-shores':           ('Rivervale Shores', ['IMG_4420.HEIC','CJN00452 2.JPG','CJN00454 2.JPG','CJN00447 2.JPG'], None),
  'tanglin-regency':            ('Tanglin Regency', ['IMG_2012.HEIC','IMG_2024.HEIC','IMG_2006.HEIC','IMG_2029.HEIC'], None),
  'varsity-park':               ('VARSITY PARK CONDO', ['Completed Site (8).jpg','Completed Site (2).jpg','Completed Site (3).jpg','Completed Site (5).jpg','Completed Site (6).jpg','Completed Site (7).jpg','Completed Site (1).jpg'], None),
  'tengah-drive':               ('125B Tengah Dr', ['PHOTO-2024-07-22-15-51-42 3.JPG','PHOTO-2024-07-22-15-51-42 7.JPG','PHOTO-2024-07-22-15-51-43 21.JPG','PHOTO-2024-07-22-15-51-43 14.JPG'], None),
  'koun-patisserie':            ('KOUN ', ['Koun (1).jpg','Koun (5).jpg','Koun (2).jpg','Koun (4).jpg'], None),
}

def save(im, path, maxl):
    im = ImageOps.exif_transpose(im).convert('RGB')
    w, h = im.size; s = min(1, maxl / max(w, h))
    if s < 1: im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
    im.save(path, 'JPEG', quality=Q, optimize=True, progressive=True)
    return im.size, os.path.getsize(path)//1024

manifest = {}
for slug, (folder, files, hero) in SEL.items():
    out = os.path.join(SRC, slug); os.makedirs(out, exist_ok=True)
    manifest[slug] = []
    for i, f in enumerate(files):
        src = os.path.join(SRC, folder, f)
        size, kb = save(Image.open(src), os.path.join(out, f'{i:02d}.jpg'), MAXL)
        manifest[slug].append((f'{i:02d}.jpg', size, kb))
        print(f'{slug}/{i:02d}.jpg  {size[0]}x{size[1]}  {kb}KB  <- {f}')
    if hero:
        size, kb = save(Image.open(os.path.join(SRC, folder, hero)), os.path.join(out, 'hero.jpg'), HERO)
        print(f'{slug}/hero.jpg  {size[0]}x{size[1]}  {kb}KB  <- {hero}')
print('done')
