# AEK Tile Studio

A static, client-side prototype for arranging and generating modular legend
tiles for the Apple Extended Keyboard II.

## Local preview

Run a static HTTP server from this directory; ES modules and SVG loading do
not work reliably through `file://` URLs.

```sh
python3 -m http.server 8080 --directory site
```

Then open <http://localhost:8080>.

## Geometry

- Tile: 17.4 × 10.2 × 1.7 mm
- Medium fit: 0.10 mm clearance per side in the rev10 frame
- Top chamfer: 0.25 mm
- Default symbol relief: 0.40 mm

The browser generator exports binary STL using Three.js. Glyph and tile meshes
overlap slightly so slicers treat them as one printable body. Validate a test
tile in your slicer before committing to a full plate.

## Publishing

The `site` directory is suitable for GitHub Pages. It has no build step and no
server-side component.
