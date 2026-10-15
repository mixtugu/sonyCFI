Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class CreatureAlpha {
  public static void Extract(string input, string output) {
    using (var image = new Bitmap(input))
    using (var result = new Bitmap(image.Width, image.Height, PixelFormat.Format32bppArgb)) {
      int w = image.Width, h = image.Height;
      var scores = new double[w * h];
      var seen = new bool[w * h];
      var best = new List<int>();
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
        Color c = image.GetPixel(x, y);
        scores[y * w + x] = Math.Max(c.R, c.G * .86);
      }
      for (int n = 0; n < scores.Length; n++) {
        if (seen[n] || scores[n] < 57) continue;
        var component = new List<int>();
        var queue = new Queue<int>();
        queue.Enqueue(n); seen[n] = true;
        while (queue.Count > 0) {
          int a = queue.Dequeue(); component.Add(a);
          int x = a % w, y = a / w;
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            int nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            int b = ny * w + nx;
            if (!seen[b] && scores[b] >= 57) { seen[b] = true; queue.Enqueue(b); }
          }
        }
        if (component.Count > best.Count) best = component;
      }
      var mask = new bool[w * h];
      foreach (int n in best) mask[n] = true;
      // Preserve dark eyes and markings enclosed within the creature.
      var outside = new bool[w * h];
      var flood = new Queue<int>();
      for (int n = 0; n < mask.Length; n++) {
        int x = n % w, y = n / w;
        if ((x == 0 || y == 0 || x == w - 1 || y == h - 1) && !mask[n]) { outside[n] = true; flood.Enqueue(n); }
      }
      while (flood.Count > 0) {
        int a = flood.Dequeue();
        foreach (int b in new int[] { a % w > 0 ? a - 1 : -1, a % w < w - 1 ? a + 1 : -1, a >= w ? a - w : -1, a < w * (h - 1) ? a + w : -1 }) {
          if (b >= 0 && !mask[b] && !outside[b]) { outside[b] = true; flood.Enqueue(b); }
        }
      }
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
        int n = y * w + x;
        Color c = image.GetPixel(x, y);
        double alpha = !outside[n] ? 1 : 0;
        if (mask[n]) {
          bool border = false;
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            int nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || outside[ny * w + nx]) border = true;
          }
          if (border) alpha = Math.Max(.12, Math.Min(1, (scores[n] - 50) / 40));
        }
        result.SetPixel(x, y, Color.FromArgb((int)Math.Round(alpha * 255), c.R, c.G, c.B));
      }
      result.Save(output, ImageFormat.Png);
    }
  }
}
'@
$source = Join-Path (Get-Location) 'src\assets\creatures'
$destination = Join-Path $source 'transparent'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Get-ChildItem -LiteralPath $source -Filter '*.png' -File | ForEach-Object {
  [CreatureAlpha]::Extract($_.FullName, (Join-Path $destination $_.Name))
  Write-Output $_.Name
}
