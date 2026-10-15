param([Parameter(Mandatory = $true)][string]$InputPath)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class ExplorerAlpha {
  static PointF[] Points(float[] coordinates) {
    var points = new PointF[coordinates.Length / 2];
    for (int i = 0; i < points.Length; i++) points[i] = new PointF(coordinates[i * 2], coordinates[i * 2 + 1]);
    return points;
  }
  public static void Extract(string input, string directory) {
    var outlines = new float[][] {
      new float[] {
        65,170, 71,168, 76,161, 85,156, 88,151, 94,149, 102,149,
        108,153, 115,157, 122,164, 125,170, 130,172, 133,178,
        133,187, 130,193, 125,195, 123,202, 116,207, 120,208,
        123,213, 122,219, 118,222, 114,220, 113,234, 110,241,
        110,248, 105,253, 100,251, 97,246, 90,245, 86,251,
        78,250, 77,241, 79,232, 78,220, 74,222, 68,221, 64,217,
        64,212, 69,207, 76,204, 73,198, 67,197, 63,192, 62,183, 63,175
      },
      new float[] {
        78,246, 83,245, 89,249, 89,256, 87,265, 84,272,
        80,274, 73,273, 68,271, 67,267, 70,258, 74,251
      },
      new float[] {
        101,249, 107,249, 111,253, 115,260, 119,270,
        123,279, 122,283, 115,285, 108,285, 104,281,
        102,273, 100,264, 99,256
      }
    };
    string[] names = { "body", "fin-far", "fin-near" };
    using (var source = new Bitmap(input)) {
      for (int part = 0; part < outlines.Length; part++) {
        using (var mask = new Bitmap(82, 143, PixelFormat.Format32bppArgb))
        using (var result = new Bitmap(82, 143, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(mask))
        using (var path = new GraphicsPath(FillMode.Alternate)) {
          graphics.SmoothingMode = SmoothingMode.AntiAlias;
          graphics.TranslateTransform(-58, -146);
          path.AddPolygon(Points(outlines[part]));
          graphics.FillPath(Brushes.White, path);
          for (int y = 0; y < result.Height; y++) for (int x = 0; x < result.Width; x++) {
            int alpha = mask.GetPixel(x, y).A;
            if (alpha == 0) continue;
            var pixel = source.GetPixel(x + 58, y + 146);
            result.SetPixel(x, y, Color.FromArgb(alpha, pixel.R, pixel.G, pixel.B));
          }
          result.Save(System.IO.Path.Combine(directory, names[part] + ".png"), ImageFormat.Png);
        }
      }
    }
  }
}
'@
$output = Join-Path (Get-Location) 'src\assets\explorer'
New-Item -ItemType Directory -Force -Path $output | Out-Null
[ExplorerAlpha]::Extract((Resolve-Path -LiteralPath $InputPath).Path, $output)
