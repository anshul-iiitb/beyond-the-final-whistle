import os
import glob
from PIL import Image
import numpy as np
import cv2

EMOJIS_DIR = r'c:\Users\darkh\Desktop\beyond-the-final-whistle\assets\emojis'

def process_file(p):
    im = Image.open(p).convert('RGB')
    arr = np.array(im)
    h, w = arr.shape[:2]

    corners = np.array([arr[0, 0], arr[0, w-1], arr[h-1, 0], arr[h-1, w-1]], dtype=float)
    bg = np.median(corners, axis=0)

    diff = np.linalg.norm(arr.astype(float) - bg, axis=2)
    thresh = (diff > 25).astype(np.uint8) * 255

    pad = 10 if h > 200 else 2
    thresh[:pad, :] = 0
    thresh[-pad:, :] = 0
    thresh[:, :pad] = 0
    thresh[:, -pad:] = 0

    ksize = 11 if h > 200 else 3
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros((h, w), dtype=np.uint8)
    for c in contours:
        if cv2.contourArea(c) > (500 if h > 200 else 50):
            cv2.drawContours(mask, [c], -1, 255, -1)

    mask[:pad, :] = 0
    mask[-pad:, :] = 0
    mask[:, :pad] = 0
    mask[:, -pad:] = 0

    # Gaussian blur outer border of mask by 3x3 for clean anti-aliasing
    mask_smooth = cv2.GaussianBlur(mask, (3, 3), 0)
    # Ensure center remains exactly 255 if it was 255
    mask_smooth = np.maximum(mask_smooth, mask)

    # Save RGBA
    rgba = np.dstack((arr, mask_smooth))
    out_im = Image.fromarray(rgba)
    out_im.save(p, 'PNG')

    fname = os.path.basename(p)
    print(f"[SOLID EMOJI + TRANSPARENT BG] {fname} -> Center Alpha: {out_im.getpixel((w//2, h//2))[3]}, Corner Alpha: {out_im.getpixel((0, 0))[3]}")

def main():
    pngs = glob.glob(os.path.join(EMOJIS_DIR, '*.png'))
    for p in pngs:
        if os.path.basename(p).startswith(('test_', 'openai_')):
            continue
        try:
            process_file(p)
        except Exception as e:
            print(f"Error {p}: {e}")

if __name__ == '__main__':
    main()
