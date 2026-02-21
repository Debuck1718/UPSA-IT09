Place custom background images here and reference them in `public/dashboard-ultra.css`.

Examples:
- To use a custom file `it09-bg.jpg`, set the CSS variable at the top of `dashboard-ultra.css` to:
  --bg-image: url('/public/images/it09-bg.jpg');

Notes:
- Image should be large (1200x800+) and optimized for web (jpeg/webp).
- You can set different backgrounds per course by adding inline style to `public/dashboard.html` body, e.g.:
  <body style="--bg-image: url('/public/images/it09-bg.jpg')"> ...
