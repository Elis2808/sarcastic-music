import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const conversion = formData.get("conversion") as string;
    
    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const file = files[0];
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Word to PDF (convert to HTML first, then client can print to PDF)
    if (conversion === "doc-pdf") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ buffer });
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${file.name}</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
              h1, h2, h3 { color: #333; }
              p { line-height: 1.6; }
            </style>
          </head>
          <body>
            ${result.value}
          </body>
          </html>
        `;
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `attachment; filename="${file.name.replace(/\.docx?$/i, ".html")}"`,
          },
        });
      } catch (e) {
        return NextResponse.json({ error: "Failed to convert Word document" }, { status: 500 });
      }
    }

    // For audio/video conversions, we need ffmpeg which requires external service
    // For now, provide a helpful message about using external tools
    if (["mp3-wav", "wav-mp3", "m4a-mp3", "flac-mp3", "ogg-mp3", "any-mp3", "compress-mp3", "extract-audio",
         "mp4-gif", "gif-mp4", "mp4-mov", "mov-mp4", "avi-mp4", "wmv-mp4", "video-mp3", "compress-video"].includes(conversion)) {
      
      const conversionInfo: Record<string, string> = {
        "mp3-wav": "ffmpeg -i input.mp3 output.wav",
        "wav-mp3": "ffmpeg -i input.wav -b:a 192k output.mp3",
        "m4a-mp3": "ffmpeg -i input.m4a -b:a 192k output.mp3",
        "flac-mp3": "ffmpeg -i input.flac -b:a 320k output.mp3",
        "ogg-mp3": "ffmpeg -i input.ogg -b:a 192k output.mp3",
        "any-mp3": "ffmpeg -i input -b:a 192k output.mp3",
        "compress-mp3": "ffmpeg -i input.mp3 -b:a 96k output_compressed.mp3",
        "extract-audio": "ffmpeg -i input.mp4 -vn -acodec copy output.mp3",
        "mp4-gif": "ffmpeg -i input.mp4 -vf fps=10,scale=480:-1:flags=lanczos output.gif",
        "gif-mp4": "ffmpeg -i input.gif -movflags faststart -pix_fmt yuv420p output.mp4",
        "mp4-mov": "ffmpeg -i input.mp4 -c copy output.mov",
        "mov-mp4": "ffmpeg -i input.mov -c copy output.mp4",
        "avi-mp4": "ffmpeg -i input.avi -c:v libx264 -crf 23 -c:a aac -b:a 192k output.mp4",
        "wmv-mp4": "ffmpeg -i input.wmv -c:v libx264 -crf 23 -c:a aac -b:a 192k output.mp4",
        "video-mp3": "ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3",
        "compress-video": "ffmpeg -i input.mp4 -vcodec h264 -acodec aac -strict -2 output_compressed.mp4",
      };

      return NextResponse.json({ 
        error: "Audio/Video conversions require ffmpeg",
        message: "This conversion requires server-side ffmpeg which needs to be installed separately.",
        command: conversionInfo[conversion] || "ffmpeg conversion needed",
        note: "For production deployment, install ffmpeg on your server or use a cloud conversion service."
      }, { status: 501 });
    }

    // PDF to Word (extract text)
    if (conversion === "pdf-doc") {
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const data = await pdfParse(buffer);
        
        // Create a simple HTML document with the extracted text
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${file.name.replace(/\.pdf$/i, "")}</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
              h1 { color: #333; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; }
              p { line-height: 1.6; margin-bottom: 1em; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>${file.name.replace(/\.pdf$/i, "")}</h1>
            <p>${data.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </body>
          </html>
        `;
        
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `attachment; filename="${file.name.replace(/\.pdf$/i, ".html")}"`,
          },
        });
      } catch (e) {
        return NextResponse.json({ error: "Failed to extract PDF text" }, { status: 500 });
      }
    }

    // HTML to PDF - Convert to styled HTML that can be printed to PDF
    if (conversion === "html-pdf") {
      try {
        const cheerio = await import("cheerio");
        const html = buffer.toString("utf-8");
        const $ = cheerio.load(html);
        
        // Add print-friendly styles
        const styledHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${file.name.replace(/\.html?$/i, "")}</title>
            <style>
              @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              }
              body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 40px auto; 
                padding: 20px;
                line-height: 1.6;
                color: #333;
              }
              h1, h2, h3 { color: #C9A84C; }
              a { color: #C9A84C; text-decoration: none; }
              img { max-width: 100%; height: auto; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            ${$.html()}
            <script>
              // Auto-trigger print dialog when opened
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
          </html>
        `;
        
        return new NextResponse(styledHtml, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `attachment; filename="${file.name.replace(/\.html?$/i, "_print.html")}"`,
          },
        });
      } catch (e) {
        return NextResponse.json({ error: "Failed to process HTML" }, { status: 500 });
      }
    }

    // Default: return file as-is
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name}"`,
      },
    });
    
  } catch (error) {
    console.error("File conversion error:", error);
    return NextResponse.json({ error: "Failed to process files" }, { status: 500 });
  }
}
