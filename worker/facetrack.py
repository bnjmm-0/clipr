"""Suivi du visage principal pour le recadrage 9:16.
Usage : python3 facetrack.py video.mp4 start end
Sortie JSON : [{"t": secondes relatives, "x": centre horizontal 0..1}, ...]
Aucune donnée biométrique n'est stockée : seules des positions horizontales sortent du script.
"""
import json, sys
import cv2

path, start, end = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
step = 0.5
points, t, last = [], start, 0.5
while t < end:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        break
    h, w = frame.shape[:2]
    scale = 480 / w
    small = cv2.resize(frame, (480, int(h * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    faces = casc.detectMultiScale(gray, 1.15, 5, minSize=(30, 30))
    if len(faces):
        # Visage le plus grand = locuteur le plus probable (approximation simple).
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        last = (x + fw / 2) / 480
    points.append({"t": round(t - start, 2), "x": round(float(last), 4)})
    t += step

# Lissage (moyenne exponentielle) + zone morte pour éviter les tremblements.
smoothed, cur = [], None
for p in points:
    cur = p["x"] if cur is None else cur * 0.7 + p["x"] * 0.3
    if not smoothed or abs(cur - smoothed[-1]["x"]) > 0.04:
        smoothed.append({"t": p["t"], "x": round(cur, 4)})
print(json.dumps(smoothed[:40]))
