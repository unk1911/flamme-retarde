import sys
from PIL import Image, ImageEnhance
tag = sys.argv[1]
gain = float(sys.argv[2]) if len(sys.argv) > 2 else 2.6
names = ['0p00', '0p60', '0p95', '1p35', '1p90', '2p40', '2p90', '3p40', '3p90', '4p40']
for cam in ['q', 'side', 'back']:
    ims = [Image.open('%s_%s_%s.png' % (tag, cam, n)).convert('RGB') for n in names]
    ims = [ImageEnhance.Brightness(i).enhance(gain) for i in ims]
    w, h = ims[0].size
    sheet = Image.new('RGB', (w // 2 * 5, h // 2 * 2))
    for i, im in enumerate(ims):
        sheet.paste(im.resize((w // 2, h // 2)), ((i % 5) * (w // 2), (i // 5) * (h // 2)))
    sheet.save('sheet_%s_%s.png' % (tag, cam))
print('ok')
