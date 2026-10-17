import sys,glob
from PIL import Image
ep=sys.argv[1]; fs=sorted(glob.glob(f'stills/{ep}_*.png'))
if len(sys.argv)>2: fs=[f for f in fs if any(f.endswith(f'_{float(x):05.2f}.png') for x in sys.argv[2:])]
ims=[Image.open(f).convert('RGB').resize((360,640)) for f in fs]
cols=min(6,len(ims)); rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*360,rows*640),(0,0,0))
for i,im in enumerate(ims): S.paste(im,((i%cols)*360,(i//cols)*640))
S.save(f'stills/_sheet_{ep}.png'); print(len(ims))
